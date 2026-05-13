import { NextResponse } from "next/server";

import {
  fetchMarketSeries,
  fetchMarketState,
  fetchQuotes,
  MARKET_CATEGORIES,
  type MarketSeriesTimeframe,
  readCacheRow,
  type TwelveDataQuote,
  upsertCache,
} from "@/lib/markets/twelve-data-adapter";
import { getMarketIntelligenceSnapshot } from "@/lib/markets/newsdata-market-intelligence";
import {
  DAILY_MARKET_BRIEF_CACHE_KEY,
  generateDailyMarketBrief,
  shouldRefreshDailyMarketBrief,
} from "@/lib/markets/daily-brief";
import type { DailyMarketBrief } from "@/lib/markets/market-intelligence";
import type { EconomicCalendarSnapshot } from "@/lib/markets/economic-calendar";
import {
  ECONOMIC_CALENDAR_CACHE_KEY,
  getEconomicCalendarWeekSnapshot,
  shouldRefreshEconomicCalendar,
} from "@/lib/markets/rapidapi-economic-calendar";
import { logger } from "@/lib/observability/logger";

/**
 * Markets cron: runs every 5 minutes to fetch Twelve Data market snapshots.
 * Credit budget (55/min):
 * - Base: Quotes (18) + Market State (1) = 19 credits
 * - One selected-detail timeframe run (+18): 37 credits
 */

const ALL_SYMBOLS = Object.values(MARKET_CATEGORIES).flatMap((c) => c.symbols);
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
  skipReason?: string;
  nextSeries?: string;
  error?: string;
};

function getRunNumber(timestampMs = Date.now()): number {
  return Math.floor(timestampMs / (5 * 60 * 1000));
}

function getFetchedAtRunNumber(fetchedAt: string | null | undefined): number | null {
  if (!fetchedAt) {
    return null;
  }
  const fetchedAtMs = new Date(fetchedAt).getTime();
  return Number.isFinite(fetchedAtMs) ? getRunNumber(fetchedAtMs) : null;
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
  skipReason,
  error,
}: {
  ok: boolean;
  startedAt: Date;
  results: MarketsCronResults;
  nextSeries?: string;
  skipReason?: string;
  error?: string;
}): MarketsCronRunPayload {
  const finishedAt = new Date();
  return {
    ok,
    ...results,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    ...(skipReason ? { skipReason } : {}),
    ...(nextSeries ? { nextSeries } : {}),
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

  const startedAt = new Date(Date.now());
  const run = getRunNumber();
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

  logger.info("markets cron started", { run, detailTimeframe });

  try {
    const [previousRunLog, quotesCacheRow] = await Promise.all([
      readCacheRow<MarketsCronRunPayload>(MARKETS_CRON_RUN_CACHE_KEY),
      readCacheRow<{ quotes?: Record<string, TwelveDataQuote> }>("quotes:all"),
    ]);
    const quotesCacheRun = quotesCacheRow?.payload?.quotes ? getFetchedAtRunNumber(quotesCacheRow.fetchedAt) : null;
    const previousLogRun = previousRunLog?.payload?.run ?? null;
    if (previousLogRun === run || quotesCacheRun === run) {
      const skipReason = previousLogRun === run ? "run-log-current-window" : "quotes-cache-current-window";
      const action = `skipped:${skipReason}`;
      results.actions.push(action);
      const payload = buildRunPayload({
        ok: true,
        startedAt,
        results,
        skipReason,
      });
      await writeRunLog(payload);
      logger.info("markets cron skipped duplicate run", {
        ...payload,
        previousRunLogFetchedAt: previousRunLog?.fetchedAt ?? null,
        quotesCacheFetchedAt: quotesCacheRow?.fetchedAt ?? null,
      });
      return NextResponse.json(payload);
    }

    // 1. Market state (1 credit — always fetch)
    const marketState = await fetchMarketState();
    const majorOpen = marketState.filter((m) =>
      ["NASDAQ", "NYSE", "FOREX", "CRYPTO"].some((code) => m.code?.includes(code) || m.name?.toUpperCase().includes(code))
    );
    await upsertCache("market:state", { markets: marketState, majorOpen });
    recordAction(`marketState:${marketState.length}`, { majorOpen: majorOpen.length });

    // 2. Quotes
    const quotes = await fetchQuotes(ALL_SYMBOLS);
    const quotesMap = Object.fromEntries(quotes.map((q) => [q.symbol, q]));
    await upsertCache("quotes:all", { quotes: quotesMap });
    recordAction(`quotes:${quotes.length}/${Object.keys(quotesMap).length}`, {
      requested: ALL_SYMBOLS.length,
    });

    // 3. Selected-detail chart series (one timeframe per run to stay under Grow 55/min)
    const seriesCache = await readCacheRow<{ series?: Record<string, number[]> }>(`series:${detailTimeframe}`);
    const existingSeries = seriesCache?.payload.series ?? {};
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

    // 4. Economic calendar (RapidAPI: shared weekly cache, refresh at most hourly)
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

    // 5. Market intelligence (NewsData free tier: keep shared cache, refresh at most hourly)
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

    // 6. Daily market brief (Claude: daily after 07:00 Europe/London, cached for the UI)
    try {
      const dailyBriefCache = await readCacheRow<DailyMarketBrief>(DAILY_MARKET_BRIEF_CACHE_KEY);
      if (shouldRefreshDailyMarketBrief(dailyBriefCache?.payload ?? null, dailyBriefCache?.fetchedAt ?? null, startedAt)) {
        const brief = await generateDailyMarketBrief(startedAt);
        await upsertCache(DAILY_MARKET_BRIEF_CACHE_KEY, brief);
        recordAction(`dailyBrief:${brief.date}`);
      } else {
        recordAction("dailyBrief:cached", {
          fetchedAt: dailyBriefCache?.fetchedAt ?? null,
          date: dailyBriefCache?.payload?.date ?? null,
        });
      }
    } catch (error) {
      recordAction("dailyBrief:error");
      recordError("dailyBrief", error, "Daily market brief refresh failed.");
    }

    const payload = buildRunPayload({
      ok: true,
      startedAt,
      results,
      nextSeries: `${detailTimeframe} refreshed`,
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
