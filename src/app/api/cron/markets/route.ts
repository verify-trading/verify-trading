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
import { logger } from "@/lib/observability/logger";

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
const MARKETS_CRON_RUN_CACHE_KEY = "cron:markets:last-run";

type MarketsCronResults = {
  run: number;
  actions: string[];
  errors: string[];
};

type MarketsCronRunPayload = MarketsCronResults & {
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  nextSeries?: string;
  nextDividend?: string;
  error?: string;
};

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

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function buildRunPayload({
  ok,
  startedAt,
  results,
  nextSeries,
  nextDividend,
  error,
}: {
  ok: boolean;
  startedAt: Date;
  results: MarketsCronResults;
  nextSeries?: string;
  nextDividend?: string;
  error?: string;
}): MarketsCronRunPayload {
  const finishedAt = new Date();
  return {
    ok,
    ...results,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    ...(nextSeries ? { nextSeries } : {}),
    ...(nextDividend ? { nextDividend } : {}),
    ...(error ? { error } : {}),
  };
}

async function writeRunLog(payload: MarketsCronRunPayload) {
  try {
    await upsertCache(MARKETS_CRON_RUN_CACHE_KEY, payload);
  } catch (error) {
    logger.warn("markets cron run log write failed", {
      error: errorMessage(error, "Failed to write markets cron run log."),
    });
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;
  if (expected && authHeader !== expected) {
    logger.warn("markets cron unauthorized", {
      hasAuthorizationHeader: Boolean(authHeader),
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  const run = getRunNumber();
  const isDividendRun = run % 6 === 0; // Every 30 min
  const detailTimeframe = DETAIL_TIMEFRAMES[run % DETAIL_TIMEFRAMES.length] ?? "1D";

  const results: MarketsCronResults = { run, actions: [], errors: [] };
  const recordAction = (action: string, meta?: Record<string, unknown>) => {
    results.actions.push(action);
    logger.info("markets cron action", { action, run, ...meta });
  };
  const recordError = (action: string, error: unknown, fallback: string, meta?: Record<string, unknown>) => {
    const message = errorMessage(error, fallback);
    results.errors.push(`${action}:${message}`);
    logger.error("markets cron action failed", { action, run, error: message, ...meta });
  };

  logger.info("markets cron started", { run, isDividendRun, detailTimeframe });

  try {
    // 1. Market state (1 credit — always fetch)
    const marketState = await fetchMarketState();
    const majorOpen = marketState.filter((m) =>
      ["NASDAQ", "NYSE", "FOREX", "CRYPTO"].some((code) => m.code?.includes(code) || m.name?.toUpperCase().includes(code))
    );
    await upsertCache("market:state", { markets: marketState, majorOpen });
    recordAction(`marketState:${marketState.length}`, { majorOpen: majorOpen.length });

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
    recordAction(`quotes:${quotes.length}/${Object.keys(quotesMap).length}`, {
      requested: symbolsToFetch.length,
      retained: Object.keys(quotesMap).length - quotes.length,
    });

    // 3. Selected-detail chart series (one timeframe per non-dividend run to stay under Grow 55/min)
    if (!isDividendRun) {
      const existingSeries =
        (await readCache<{ series?: Record<string, number[]> }>(`series:${detailTimeframe}`))?.series ?? {};
      const series: Record<string, number[]> = {};
      for (const sym of ALL_SYMBOLS) {
        try {
          const data = await fetchMarketSeries(sym, detailTimeframe);
          series[sym] = data.values;
        } catch (error) {
          recordError("series-symbol", error, "Temporary symbol series failure.", {
            symbol: sym,
            timeframe: detailTimeframe,
          });
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
      recordAction(`series:${detailTimeframe}:${Object.keys(series).length}/${Object.keys(mergedSeries).length}`);
    }

    // 4. Dividends calendar (every 30 min, 40 credits)
    if (isDividendRun) {
      const today = new Date().toISOString().slice(0, 10);
      const nextWeek = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
      const dividends = await fetchDividendsCalendar(today, nextWeek);
      await upsertCache("events:dividends", { items: dividends });
      recordAction(`dividends:${dividends.length}`, { from: today, to: nextWeek });
    }

    // 5. Economic calendar (RapidAPI: shared weekly cache, refresh at most every 2 hours)
    try {
      const economicCalendarCache = await readCacheRow<EconomicCalendarSnapshot>(ECONOMIC_CALENDAR_CACHE_KEY);
      if (shouldRefreshEconomicCalendar(economicCalendarCache?.fetchedAt, economicCalendarCache?.payload?.from ?? null)) {
        const calendar = await getEconomicCalendarWeekSnapshot(economicCalendarCache?.payload ?? null);
        await upsertCache(ECONOMIC_CALENDAR_CACHE_KEY, calendar);
        recordAction(`economicCalendar:${calendar.items.length}`, {
          from: calendar.from,
          to: calendar.to,
        });
      } else {
        recordAction("economicCalendar:cached", {
          fetchedAt: economicCalendarCache?.fetchedAt ?? null,
          from: economicCalendarCache?.payload?.from ?? null,
        });
      }
    } catch (error) {
      recordAction("economicCalendar:error");
      recordError("economicCalendar", error, "Economic calendar refresh failed.");
    }

    // 6. Market intelligence (NewsData free tier: keep shared cache, refresh at most hourly)
    const intelligenceCache = await readCacheRow(INTELLIGENCE_CACHE_KEY);
    if (shouldRefreshIntelligence(intelligenceCache?.fetchedAt)) {
      const intelligence = await getMarketIntelligenceSnapshot();
      await upsertCache(INTELLIGENCE_CACHE_KEY, intelligence);
      recordAction(`intelligence:${intelligence.items.length}`);
    } else {
      recordAction("intelligence:cached", {
        fetchedAt: intelligenceCache?.fetchedAt ?? null,
      });
    }

    const nextSeries = isDividendRun ? "5 min" : `${detailTimeframe} refreshed`;
    const nextDividend = isDividendRun ? "30 min" : `${(6 - (run % 6)) * 5} min`;
    const payload = buildRunPayload({
      ok: true,
      startedAt,
      results,
      nextSeries,
      nextDividend,
    });
    await writeRunLog(payload);
    logger.info("markets cron completed", payload);

    return NextResponse.json(payload);
  } catch (error) {
    const message = errorMessage(error, "Cron failed");
    recordError("fatal", error, "Cron failed");
    const payload = buildRunPayload({
      ok: false,
      startedAt,
      results,
      error: message,
    });
    await writeRunLog(payload);
    logger.error("markets cron failed", payload);
    return NextResponse.json(payload, { status: 500 });
  }
}
