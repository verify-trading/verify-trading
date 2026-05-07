import { NextResponse } from "next/server";

import {
  fetchDividendsCalendar,
  fetchMarketSeries,
  fetchMarketState,
  fetchQuotes,
  MARKET_CATEGORIES,
  type MarketSeriesTimeframe,
  readCache,
  readCacheRow,
  type TwelveDataQuote,
  upsertCache,
} from "@/lib/markets/twelve-data-adapter";
import { getMarketIntelligenceSnapshot } from "@/lib/markets/newsdata-market-intelligence";
import type { EconomicCalendarSnapshot } from "@/lib/markets/economic-calendar";
import {
  ECONOMIC_CALENDAR_CACHE_KEY,
  getEconomicCalendarWeekSnapshot,
  shouldRefreshEconomicCalendar,
} from "@/lib/markets/rapidapi-economic-calendar";

/**
 * Vercel Cron: runs every 5 minutes to fetch Twelve Data market snapshots.
 * Credit budget (55/min):
 * - Base: Quotes (18) + Market State (1) = 19 credits
 * - One selected-detail timeframe run (+18): 37 credits
 * - Dividend run (+40): 59 credits → SKIP sparklines, refresh priority quotes, keep cached remainder = 47 credits
 */

const ALL_SYMBOLS = Object.values(MARKET_CATEGORIES).flatMap((c) => c.symbols);
const PRIORITY_SYMBOLS = ["EUR/USD", "GBP/USD", "USD/JPY", "XAU/USD", "BTC/USD", "ETH/USD"];
const DETAIL_TIMEFRAMES: MarketSeriesTimeframe[] = ["1D", "1W", "1M", "3M"];
const INTELLIGENCE_CACHE_KEY = "intelligence:news";
const INTELLIGENCE_REFRESH_MS = 60 * 60 * 1000;

function getRunNumber(): number {
  const now = Date.now();
  return Math.floor(now / (5 * 60 * 1000));
}

function shouldRefreshIntelligence(fetchedAt: string | null | undefined): boolean {
  if (!fetchedAt) {
    return true;
  }
  const fetchedAtMs = new Date(fetchedAt).getTime();
  if (!Number.isFinite(fetchedAtMs)) {
    return true;
  }
  return Date.now() - fetchedAtMs >= INTELLIGENCE_REFRESH_MS;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;
  if (expected && authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const run = getRunNumber();
  const isDividendRun = run % 6 === 0; // Every 30 min
  const detailTimeframe = DETAIL_TIMEFRAMES[run % DETAIL_TIMEFRAMES.length] ?? "1D";

  const results: { run: number; actions: string[] } = { run, actions: [] };

  try {
    // 1. Market state (1 credit — always fetch)
    const marketState = await fetchMarketState();
    const majorOpen = marketState.filter((m) =>
      ["NASDAQ", "NYSE", "FOREX", "CRYPTO"].some((code) => m.code?.includes(code) || m.name?.toUpperCase().includes(code))
    );
    await upsertCache("market:state", { markets: marketState, majorOpen });
    results.actions.push(`marketState:${marketState.length}`);

    // 2. Quotes (use priority list on dividend runs to stay under 55 credits)
    const symbolsToFetch = isDividendRun ? PRIORITY_SYMBOLS : ALL_SYMBOLS;
    const existingQuotes = isDividendRun
      ? ((await readCache<{ quotes?: Record<string, TwelveDataQuote> }>("quotes:all"))?.quotes ?? {})
      : {};
    const quotes = await fetchQuotes(symbolsToFetch);
    const quotesMap = {
      ...existingQuotes,
      ...Object.fromEntries(quotes.map((q) => [q.symbol, q])),
    };
    await upsertCache("quotes:all", { quotes: quotesMap });
    results.actions.push(`quotes:${quotes.length}/${Object.keys(quotesMap).length}`);

    // 3. Selected-detail chart series (one timeframe per non-dividend run to stay under Grow 55/min)
    if (!isDividendRun) {
      const existingSeries =
        (await readCache<{ series?: Record<string, number[]> }>(`series:${detailTimeframe}`))?.series ?? {};
      const series: Record<string, number[]> = {};
      for (const sym of ALL_SYMBOLS) {
        try {
          const data = await fetchMarketSeries(sym, detailTimeframe);
          series[sym] = data.values;
        } catch {
          // Keep the existing cached series for this symbol instead of replacing it with a failed fetch.
        }
      }
      const mergedSeries = {
        ...existingSeries,
        ...series,
      };
      if (Object.keys(series).length > 0) {
        await upsertCache(`series:${detailTimeframe}`, { timeframe: detailTimeframe, series: mergedSeries });
        if (detailTimeframe === "1D") {
          await upsertCache("sparklines:all", { sparklines: mergedSeries });
        }
      }
      results.actions.push(`series:${detailTimeframe}:${Object.keys(series).length}/${Object.keys(mergedSeries).length}`);
    }

    // 4. Dividends calendar (every 30 min, 40 credits)
    if (isDividendRun) {
      const today = new Date().toISOString().slice(0, 10);
      const nextWeek = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
      const dividends = await fetchDividendsCalendar(today, nextWeek);
      await upsertCache("events:dividends", { items: dividends });
      results.actions.push(`dividends:${dividends.length}`);
    }

    // 5. Economic calendar (RapidAPI: shared weekly cache, refresh at most every 2 hours)
    try {
      const economicCalendarCache = await readCacheRow<EconomicCalendarSnapshot>(ECONOMIC_CALENDAR_CACHE_KEY);
      if (shouldRefreshEconomicCalendar(economicCalendarCache?.fetchedAt)) {
        const calendar = await getEconomicCalendarWeekSnapshot(economicCalendarCache?.payload ?? null);
        await upsertCache(ECONOMIC_CALENDAR_CACHE_KEY, calendar);
        results.actions.push(`economicCalendar:${calendar.items.length}`);
      } else {
        results.actions.push("economicCalendar:cached");
      }
    } catch {
      results.actions.push("economicCalendar:error");
    }

    // 6. Market intelligence (NewsData free tier: keep shared cache, refresh at most hourly)
    const intelligenceCache = await readCacheRow(INTELLIGENCE_CACHE_KEY);
    if (shouldRefreshIntelligence(intelligenceCache?.fetchedAt)) {
      const intelligence = await getMarketIntelligenceSnapshot();
      await upsertCache(INTELLIGENCE_CACHE_KEY, intelligence);
      results.actions.push(`intelligence:${intelligence.items.length}`);
    } else {
      results.actions.push("intelligence:cached");
    }

    return NextResponse.json({
      ok: true,
      ...results,
      nextSeries: isDividendRun ? "5 min" : `${detailTimeframe} refreshed`,
      nextDividend: isDividendRun ? "30 min" : `${(6 - (run % 6)) * 5} min`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cron failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
