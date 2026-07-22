import { z } from "zod";
import { fetchWithRetry } from "@/lib/http/fetch-with-retry";
import {
  fetchMarketSeries,
  fetchQuotes,
  isCacheFresh,
  readCacheRow,
  upsertCache,
  type MarketSeriesTimeframe,
} from "@/lib/markets/twelve-data-adapter";
import {
  toTwelveDataSymbol,
  twelveDataQuoteToMarketQuote,
  twelveDataSparklineToCloseValues,
} from "./market-providers";

const quoteCache = new Map<string, { value: MarketQuote; expiresAt: number }>();
const seriesCache = new Map<string, { value: MarketSeries; expiresAt: number }>();
const instrumentCache = new Map<string, { value: MarketInstrument; expiresAt: number }>();

/** Server-side TTLs for the shared Supabase cache (and the in-process L1 in front of it). */
const QUOTE_TTL_MS = 60_000;
const SERIES_TTL_MS = 300_000;
const INSTRUMENT_TTL_MS = 60_000;

/** Timeframes Twelve Data's adapter can serve; anything else (e.g. 1Y) falls through to FMP. */
const TWELVE_DATA_TIMEFRAMES: readonly MarketSeriesTimeframe[] = ["1D", "1W", "1M", "3M"];

export type MarketInstrument = {
  asset: string;
  symbol: string;
  proxyAssumption?: string;
};

const supportedAssets = {
  gold: { asset: "GOLD", symbol: "GCUSD" },
  goldxauusd: { asset: "GOLD", symbol: "GCUSD" },
  xau: { asset: "GOLD", symbol: "GCUSD" },
  xauusd: { asset: "GOLD", symbol: "GCUSD" },
  oil: {
    asset: "OIL / WTI",
    symbol: "BZUSD",
    proxyAssumption: "Using Brent crude futures as the free-plan oil proxy.",
  },
  oilwti: {
    asset: "OIL / WTI",
    symbol: "BZUSD",
    proxyAssumption: "Using Brent crude futures as the free-plan oil proxy.",
  },
  wti: {
    asset: "OIL / WTI",
    symbol: "BZUSD",
    proxyAssumption: "Using Brent crude futures as the free-plan oil proxy.",
  },
  silver: {
    asset: "SILVER",
    symbol: "SIUSD",
    proxyAssumption: "Using silver futures as the live silver proxy.",
  },
  silverxagusd: {
    asset: "SILVER",
    symbol: "SIUSD",
    proxyAssumption: "Using silver futures as the live silver proxy.",
  },
  xagusd: {
    asset: "SILVER",
    symbol: "SIUSD",
    proxyAssumption: "Using silver futures as the live silver proxy.",
  },
  bitcoin: { asset: "BITCOIN / USD", symbol: "BTCUSD" },
  bitcoinusd: { asset: "BITCOIN / USD", symbol: "BTCUSD" },
  btcusd: { asset: "BITCOIN / USD", symbol: "BTCUSD" },
  btc: { asset: "BITCOIN / USD", symbol: "BTCUSD" },
  ethereum: { asset: "ETHEREUM / USD", symbol: "ETHUSD" },
  ethereumusd: { asset: "ETHEREUM / USD", symbol: "ETHUSD" },
  ethusd: { asset: "ETHEREUM / USD", symbol: "ETHUSD" },
  eth: { asset: "ETHEREUM / USD", symbol: "ETHUSD" },
  eurusd: { asset: "EUR/USD", symbol: "EURUSD" },
  eu: { asset: "EUR/USD", symbol: "EURUSD" },
  gbpusd: { asset: "GBP/USD", symbol: "GBPUSD" },
  gu: { asset: "GBP/USD", symbol: "GBPUSD" },
  nasdaq: {
    asset: "NASDAQ",
    symbol: "^IXIC",
  },
  nas: {
    asset: "NASDAQ",
    symbol: "^IXIC",
  },
  nas100: {
    asset: "NASDAQ",
    symbol: "^IXIC",
  },
  dow: {
    asset: "DOW JONES",
    symbol: "^DJI",
  },
  dowjones: {
    asset: "DOW JONES",
    symbol: "^DJI",
  },
  us30: {
    asset: "DOW JONES",
    symbol: "^DJI",
  },
} as const satisfies Record<string, MarketInstrument>;

export const getMarketSeriesInputSchema = z.object({
  asset: z.string().min(1).describe("Market name or symbol such as Gold, Ethereum, EUR/USD, Nasdaq, AAPL, or TSLA."),
  timeframe: z.enum(["1D", "1W", "1M", "3M", "1Y"]).optional().default("1W").describe("Chart window for the briefing."),
});

export interface MarketQuote extends MarketInstrument {
  price: number;
  changePercent: number;
  direction: "up" | "down";
  isMarketOpen: boolean | null;
}

export interface MarketSeries extends MarketInstrument {
  timeframe: "1D" | "1W" | "1M" | "3M" | "1Y";
  closeValues: number[];
  resistance: number;
  support: number;
}

/**
 * `{ live: true }` skips the TTL cache *reads* (always refetches) but still writes the
 * fresh value back to the cache. Omit (default) for the normal two-provider + TTL cache
 * path used by the Ask tab and landing hero.
 */
export type MarketDataOptions = {
  live?: boolean;
};

/** Builds a quote from historical closes so the dashboard can reuse one series response when needed. */
export function deriveQuoteFromSeries(series: MarketSeries): MarketQuote {
  const { closeValues } = series;
  if (closeValues.length < 2) {
    throw new Error("FMP historical prices did not include enough close values.");
  }

  const first = closeValues[0];
  const last = closeValues[closeValues.length - 1];
  const changePercent = first !== 0 ? ((last - first) / first) * 100 : 0;

  return {
    asset: series.asset,
    symbol: series.symbol,
    ...(series.proxyAssumption ? { proxyAssumption: series.proxyAssumption } : {}),
    price: last,
    changePercent,
    direction: directionFromChange(changePercent),
    isMarketOpen: null,
  };
}

function normalizeAssetKey(asset: string) {
  return asset.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}

function formatCompactForexLabel(value: string) {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{6}$/.test(normalized)) {
    return null;
  }

  return `${normalized.slice(0, 3)}/${normalized.slice(3, 6)}`;
}

export function resolveSupportedAsset(asset: string) {
  return (
    supportedAssets[normalizeAssetKey(asset) as keyof typeof supportedAssets] ?? null
  ) as MarketInstrument | null;
}

export function clearMarketCaches() {
  quoteCache.clear();
  seriesCache.clear();
  instrumentCache.clear();
}

function getCached<T>(cache: Map<string, { value: T; expiresAt: number }>, key: string) {
  const cached = cache.get(key);
  if (!cached || cached.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }

  return cached.value;
}

function setCached<T>(cache: Map<string, { value: T; expiresAt: number }>, key: string, value: T, ttlMs: number) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

// L2 cache: the shared Supabase market_cache row (survives across serverless invocations,
// unlike the in-process Maps). Resilient — a cache miss/hiccup is never allowed to break the
// data path, so read failures read as a miss and writes are fire-and-forget.
async function readServerCache<T>(key: string, ttlMs: number): Promise<T | null> {
  try {
    const row = await readCacheRow<T>(key);
    return row && isCacheFresh(row.fetchedAt, ttlMs) ? row.payload : null;
  } catch {
    return null;
  }
}

function writeServerCache(key: string, payload: unknown): void {
  void upsertCache(key, payload).catch(() => undefined);
}

function directionFromChange(changePercent: number): "up" | "down" {
  return changePercent >= 0 ? "up" : "down";
}

function buildInstrumentLabel(name: string | undefined, symbol: string) {
  const normalizedName = name?.trim();
  const normalizedSymbol = symbol.trim().toUpperCase();
  const forexLabelFromName = normalizedName ? formatCompactForexLabel(normalizedName) : null;
  const forexLabelFromSymbol = formatCompactForexLabel(normalizedSymbol);

  if (!normalizedName) {
    return forexLabelFromSymbol ?? normalizedSymbol;
  }

  if (normalizeAssetKey(normalizedName) === normalizeAssetKey(normalizedSymbol)) {
    return forexLabelFromName ?? forexLabelFromSymbol ?? normalizedSymbol;
  }

  if (normalizedName.length <= 26) {
    return `${normalizedName.toUpperCase()} (${normalizedSymbol})`;
  }

  return normalizedSymbol;
}

function scoreInstrumentMatch(
  query: string,
  candidate: {
    symbol: string;
    instrumentName?: string;
    exchange?: string;
  },
) {
  const normalizedQuery = normalizeAssetKey(query);
  const normalizedSymbol = normalizeAssetKey(candidate.symbol);
  const normalizedName = normalizeAssetKey(candidate.instrumentName ?? "");
  let score = 0;

  if (normalizedSymbol === normalizedQuery) {
    score += 600;
  }

  if (normalizedName === normalizedQuery) {
    score += 500;
  }

  if (normalizedSymbol.startsWith(normalizedQuery) || normalizedQuery.startsWith(normalizedSymbol)) {
    score += 220;
  }

  if (
    normalizedName.includes(normalizedQuery) ||
    (normalizedName.length > 0 && normalizedQuery.includes(normalizedName))
  ) {
    score += 180;
  }

  const exchange = (candidate.exchange ?? "").toUpperCase();
  if (exchange === "FOREX" || exchange === "CRYPTO" || exchange === "COMMODITY" || exchange === "INDEX") {
    score += 40;
  } else if (exchange === "NASDAQ" || exchange === "NYSE" || exchange === "AMEX") {
    score += 10;
  }

  return score;
}

function parseNumericValue(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

/** FMP historical rows include `date`; sort ascending for correct range % and sparklines. */
function parseTimestampFromSeriesRow(row: Record<string, unknown>): number | null {
  const raw = row.datetime ?? row.date;
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return null;
  }

  const trimmed = raw.trim();
  const normalized = /\dT\d/.test(trimmed) ? trimmed : trimmed.replace(" ", "T");
  const ms = Date.parse(normalized);
  return Number.isFinite(ms) ? ms : null;
}

function parseTimeSeriesCloseValues(values: unknown[]): number[] {
  const rows = values
    .map((entry) => {
      const row = entry as Record<string, unknown>;
      const close = parseNumericValue(row.close) ?? parseNumericValue(row.price);
      if (close === null) {
        return null;
      }

      return { close, ts: parseTimestampFromSeriesRow(row) };
    })
    .filter((row): row is { close: number; ts: number | null } => row !== null);

  if (rows.length < 2) {
    return [];
  }

  const allHaveTs = rows.every((row) => row.ts !== null);

  if (allHaveTs) {
    return rows
      .toSorted((a, b) => (a.ts as number) - (b.ts as number))
      .map((row) => row.close);
  }

  return rows.map((row) => row.close).reverse();
}

function requireNumericValue(value: number | null, message: string) {
  if (value === null) {
    throw new Error(message);
  }

  return value;
}

/**
 * FMP free-plan history is daily, so even `1D` uses recent daily closes instead of intraday bars.
 * The goal here is consistent recent context, not fake sub-day precision.
 */
function formatTimeframe(timeframe: MarketSeries["timeframe"]) {
  switch (timeframe) {
    case "1D":
      return { limit: "5", points: 5 };
    case "1W":
      return { limit: "7", points: 7 };
    case "1M":
      return { limit: "22", points: 22 };
    case "3M":
      return { limit: "63", points: 63 };
    case "1Y":
      return { limit: "252", points: 252 };
  }
}

function trimCloseValues(closeValues: number[], points: number): number[] {
  if (closeValues.length <= points) {
    return closeValues;
  }

  return closeValues.slice(-points);
}

async function fetchFmpData(
  pathname: string,
  params: Record<string, string>,
  options?: MarketDataOptions,
) {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) {
    throw new Error("FMP_API_KEY is not configured.");
  }

  const url = new URL(`https://financialmodelingprep.com/${pathname}`);
  Object.entries({ ...params, apikey: apiKey }).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const live = options?.live === true;
  const response = await fetchWithRetry(
    url,
    live
      ? { cache: "no-store" }
      : {
          next: { revalidate: 60 },
        },
  );

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`FMP request failed with ${response.status}.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(text.trim() || "FMP returned a non-JSON response.");
  }

  if (typeof parsed === "string") {
    throw new Error(parsed);
  }

  if (
    parsed &&
    typeof parsed === "object" &&
    "Error Message" in parsed &&
    typeof parsed["Error Message"] === "string"
  ) {
    throw new Error(parsed["Error Message"]);
  }

  return parsed;
}

async function searchMarketInstrument(
  asset: string,
  options?: MarketDataOptions,
): Promise<MarketInstrument | null> {
  const live = options?.live === true;
  const cacheKey = normalizeAssetKey(asset);
  if (!live) {
    const cached = getCached(instrumentCache, cacheKey);
    if (cached) {
      return cached;
    }
  }

  const [symbolMatches, nameMatches] = await Promise.all([
    fetchFmpData("stable/search-symbol", { query: asset }, options).catch(() => []),
    fetchFmpData("stable/search-name", { query: asset }, options).catch(() => []),
  ]);
  const data = [...(Array.isArray(symbolMatches) ? symbolMatches : []), ...(Array.isArray(nameMatches) ? nameMatches : [])];
  const uniqueCandidates = Array.from(
    new Map(
      data.map((entry) => {
        const candidate = entry as Record<string, unknown>;
        return [`${candidate.symbol ?? ""}:${candidate.exchange ?? ""}`, candidate];
      }),
    ).values(),
  );

  let bestMatch: {
    symbol: string;
    instrumentName?: string;
    exchange?: string;
  } | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const entry of uniqueCandidates) {
    const candidate = entry as Record<string, unknown>;
    if (typeof candidate.symbol !== "string" || candidate.symbol.trim().length === 0) {
      continue;
    }
    const match = {
      symbol: candidate.symbol.trim(),
      instrumentName: typeof candidate.name === "string" ? candidate.name.trim() : undefined,
      exchange: typeof candidate.exchange === "string" ? candidate.exchange.trim() : undefined,
    };
    const score = scoreInstrumentMatch(asset, match);
    if (score > bestScore) {
      bestMatch = match;
      bestScore = score;
    }
  }

  if (!bestMatch) {
    return null;
  }

  const instrument: MarketInstrument = {
    asset: buildInstrumentLabel(bestMatch.instrumentName, bestMatch.symbol),
    symbol: bestMatch.symbol,
  };

  if (!live) {
    setCached(instrumentCache, cacheKey, instrument, INSTRUMENT_TTL_MS);
  }
  return instrument;
}

async function resolveMarketInstrument(
  asset: string,
  options?: MarketDataOptions,
): Promise<MarketInstrument> {
  const resolved = resolveSupportedAsset(asset);
  if (resolved) {
    return resolved;
  }

  const searched = await searchMarketInstrument(asset, options);
  if (searched) {
    return searched;
  }

  throw new Error(`Unsupported asset: ${asset}`);
}

async function fetchFmpQuote(resolved: MarketInstrument, live: boolean): Promise<MarketQuote> {
  const json = await fetchFmpData("stable/quote", { symbol: resolved.symbol }, { live });
  const row = Array.isArray(json) ? (json[0] as Record<string, unknown> | undefined) : undefined;
  if (!row) {
    throw new Error(`FMP quote did not return data for ${resolved.symbol}.`);
  }

  const price = requireNumericValue(
    parseNumericValue(row.close) ?? parseNumericValue(row.price) ?? parseNumericValue(row.last),
    "FMP quote did not include a valid price.",
  );
  const changePercent = requireNumericValue(
    parseNumericValue(row.changePercentage) ??
      parseNumericValue(row.percent_change) ??
      parseNumericValue(row.change_percent) ??
      parseNumericValue(row.change),
    "FMP quote did not include a valid percentage change.",
  );

  return {
    asset: resolved.asset,
    symbol: resolved.symbol,
    price,
    changePercent,
    direction: directionFromChange(changePercent),
    isMarketOpen: null,
    ...(resolved.proxyAssumption ? { proxyAssumption: resolved.proxyAssumption } : {}),
  };
}

// Twelve Data first — it covers Gold/commodities that FMP's plan blocks and matches the
// Markets tab, so both surfaces agree — then FMP as the fallback for anything it can't serve.
async function fetchQuoteFromProviders(resolved: MarketInstrument, live: boolean): Promise<MarketQuote> {
  const tdSymbol = toTwelveDataSymbol(resolved.symbol);
  if (tdSymbol) {
    try {
      const [td] = await fetchQuotes([tdSymbol]);
      if (td && Number.isFinite(td.price) && td.price > 0) {
        return twelveDataQuoteToMarketQuote(resolved, td);
      }
    } catch {
      // Twelve Data unavailable (rate limit, missing key, unsupported symbol) — fall through.
    }
  }
  return fetchFmpQuote(resolved, live);
}

export async function getMarketQuote(asset: string, options?: MarketDataOptions): Promise<MarketQuote> {
  const live = options?.live === true;
  const resolved = await resolveMarketInstrument(asset, options);

  const cacheKey = resolved.symbol;
  const serverKey = `ask:quote:${cacheKey}`;
  if (!live) {
    const l1 = getCached(quoteCache, cacheKey);
    if (l1) return l1;
    const l2 = await readServerCache<MarketQuote>(serverKey, QUOTE_TTL_MS);
    if (l2) {
      setCached(quoteCache, cacheKey, l2, QUOTE_TTL_MS);
      return l2;
    }
  }

  const quote = await fetchQuoteFromProviders(resolved, live);
  setCached(quoteCache, cacheKey, quote, QUOTE_TTL_MS);
  writeServerCache(serverKey, quote);
  return quote;
}

function buildSeries(
  resolved: MarketInstrument,
  timeframe: MarketSeries["timeframe"],
  closeValues: number[],
): MarketSeries {
  return {
    asset: resolved.asset,
    symbol: resolved.symbol,
    timeframe,
    closeValues,
    resistance: Math.max(...closeValues),
    support: Math.min(...closeValues),
    ...(resolved.proxyAssumption ? { proxyAssumption: resolved.proxyAssumption } : {}),
  };
}

async function fetchFmpSeries(
  resolved: MarketInstrument,
  timeframe: MarketSeries["timeframe"],
  window: ReturnType<typeof formatTimeframe>,
  live: boolean,
): Promise<MarketSeries> {
  const json = await fetchFmpData(
    "stable/historical-price-eod/light",
    { symbol: resolved.symbol, limit: window.limit },
    { live },
  );
  const values = Array.isArray(json) ? json : [];
  const closeValues = trimCloseValues(parseTimeSeriesCloseValues(values), window.points);
  if (closeValues.length < 2) {
    throw new Error("FMP historical prices did not include enough close values.");
  }
  return buildSeries(resolved, timeframe, closeValues);
}

// Twelve Data first (covers the commodities FMP's plan blocks), FMP fallback. Twelve Data
// only serves the four adapter timeframes; anything else (e.g. 1Y) goes straight to FMP.
async function fetchSeriesFromProviders(
  resolved: MarketInstrument,
  timeframe: MarketSeries["timeframe"],
  window: ReturnType<typeof formatTimeframe>,
  live: boolean,
): Promise<MarketSeries> {
  const tdSymbol = toTwelveDataSymbol(resolved.symbol);
  if (tdSymbol && (TWELVE_DATA_TIMEFRAMES as readonly string[]).includes(timeframe)) {
    try {
      const sparkline = await fetchMarketSeries(tdSymbol, timeframe as MarketSeriesTimeframe);
      const closeValues = trimCloseValues(twelveDataSparklineToCloseValues(sparkline), window.points);
      if (closeValues.length >= 2) {
        return buildSeries(resolved, timeframe, closeValues);
      }
    } catch {
      // Twelve Data unavailable — fall through to FMP.
    }
  }
  return fetchFmpSeries(resolved, timeframe, window, live);
}

export async function getMarketSeries(
  asset: string,
  timeframe: MarketSeries["timeframe"] = "1W",
  options?: MarketDataOptions,
): Promise<MarketSeries> {
  const live = options?.live === true;
  const resolved = await resolveMarketInstrument(asset, options);
  const window = formatTimeframe(timeframe);

  // The cache stores the fetched window; a read re-trims to the requested points (idempotent).
  const trimToWindow = (series: MarketSeries): MarketSeries => {
    if (series.closeValues.length <= window.points) return series; // cached at this window — nothing to trim
    const closeValues = trimCloseValues(series.closeValues, window.points);
    return { ...series, closeValues, support: Math.min(...closeValues), resistance: Math.max(...closeValues) };
  };

  const cacheKey = `${resolved.symbol}:${timeframe}`;
  const serverKey = `ask:series:${cacheKey}`;
  if (!live) {
    const l1 = getCached(seriesCache, cacheKey);
    if (l1) return trimToWindow(l1);
    const l2 = await readServerCache<MarketSeries>(serverKey, SERIES_TTL_MS);
    if (l2) {
      setCached(seriesCache, cacheKey, l2, SERIES_TTL_MS);
      return trimToWindow(l2);
    }
  }

  const series = await fetchSeriesFromProviders(resolved, timeframe, window, live);
  setCached(seriesCache, cacheKey, series, SERIES_TTL_MS);
  writeServerCache(serverKey, series);
  return series;
}
