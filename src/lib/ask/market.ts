import { z } from "zod";
import { fetchWithRetry } from "@/lib/http/fetch-with-retry";

const quoteCache = new Map<string, { value: MarketQuote; expiresAt: number }>();
const seriesCache = new Map<string, { value: MarketSeries; expiresAt: number }>();
const instrumentCache = new Map<string, { value: MarketInstrument; expiresAt: number }>();

const cacheTtlMs = 60_000;

type MarketInstrument = {
  asset: string;
  symbol: string;
  exchange?: string;
  proxyAssumption?: string;
};

const supportedAssets = {
  gold: { asset: "GOLD / XAUUSD", symbol: "XAU/USD" },
  goldxauusd: { asset: "GOLD / XAUUSD", symbol: "XAU/USD" },
  xau: { asset: "GOLD / XAUUSD", symbol: "XAU/USD" },
  xauusd: { asset: "GOLD / XAUUSD", symbol: "XAU/USD" },
  oil: {
    asset: "OIL / WTI",
    symbol: "USO",
    exchange: "NYSE",
    proxyAssumption: "Using USO ETF as a live WTI crude proxy.",
  },
  oilwti: {
    asset: "OIL / WTI",
    symbol: "USO",
    exchange: "NYSE",
    proxyAssumption: "Using USO ETF as a live WTI crude proxy.",
  },
  wti: {
    asset: "OIL / WTI",
    symbol: "USO",
    exchange: "NYSE",
    proxyAssumption: "Using USO ETF as a live WTI crude proxy.",
  },
  silver: {
    asset: "SILVER",
    symbol: "SLV",
    proxyAssumption: "Using SLV as a live Silver proxy.",
  },
  silverxagusd: {
    asset: "SILVER",
    symbol: "SLV",
    proxyAssumption: "Using SLV as a live Silver proxy.",
  },
  xagusd: {
    asset: "SILVER",
    symbol: "SLV",
    proxyAssumption: "Using SLV as a live Silver proxy.",
  },
  bitcoin: { asset: "BITCOIN / USD", symbol: "BTC/USD" },
  bitcoinusd: { asset: "BITCOIN / USD", symbol: "BTC/USD" },
  btc: { asset: "BITCOIN / USD", symbol: "BTC/USD" },
  ethereum: { asset: "ETHEREUM / USD", symbol: "ETH/USD" },
  ethereumusd: { asset: "ETHEREUM / USD", symbol: "ETH/USD" },
  eth: { asset: "ETHEREUM / USD", symbol: "ETH/USD" },
  eurusd: { asset: "EUR/USD", symbol: "EUR/USD" },
  eu: { asset: "EUR/USD", symbol: "EUR/USD" },
  gbpusd: { asset: "GBP/USD", symbol: "GBP/USD" },
  gu: { asset: "GBP/USD", symbol: "GBP/USD" },
  nasdaq: {
    asset: "NASDAQ",
    symbol: "QQQ",
    proxyAssumption: "Using QQQ as a live Nasdaq proxy.",
  },
  nas: {
    asset: "NASDAQ",
    symbol: "QQQ",
    proxyAssumption: "Using QQQ as a live Nasdaq proxy.",
  },
  nas100: {
    asset: "NASDAQ",
    symbol: "QQQ",
    proxyAssumption: "Using QQQ as a live Nasdaq proxy.",
  },
  dow: {
    asset: "DOW JONES",
    symbol: "DIA",
    proxyAssumption: "Using DIA as a live Dow Jones proxy.",
  },
  dowjones: {
    asset: "DOW JONES",
    symbol: "DIA",
    proxyAssumption: "Using DIA as a live Dow Jones proxy.",
  },
  us30: {
    asset: "DOW JONES",
    symbol: "DIA",
    proxyAssumption: "Using DIA as a live Dow Jones proxy.",
  },
} as const satisfies Record<string, MarketInstrument>;

function collapseAssetText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function inferMarketAssetFromText(text: string): string | null {
  const collapsed = collapseAssetText(text);
  const tokenized = text
    .toLowerCase()
    .split(/[^a-z0-9/]+/)
    .map((token) => collapseAssetText(token))
    .filter(Boolean);

  const matches = Object.entries(supportedAssets)
    .filter(([key]) => {
      if (key.length <= 3) {
        return tokenized.includes(key);
      }

      return collapsed.includes(key);
    })
    .sort((left, right) => right[0].length - left[0].length);

  return matches[0]?.[1].asset ?? null;
}

export const getMarketQuoteInputSchema = z.object({
  asset: z.string().min(1).describe("Market name or symbol such as Gold, Ethereum, EUR/USD, Nasdaq, AAPL, or TSLA."),
});

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
 * Builds a quote from time-series closes so the Markets dashboard can use a single `time_series`
 * call per asset (half the Twelve Data credits vs quote + series).
 */
export function deriveQuoteFromSeries(series: MarketSeries): MarketQuote {
  const { closeValues } = series;
  if (closeValues.length < 2) {
    throw new Error("Twelve Data time series did not include enough close values.");
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
    direction: changePercent >= 0 ? "up" : "down",
    isMarketOpen: null,
  };
}

function normalizeAssetKey(asset: string) {
  return asset.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
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

function setCached<T>(cache: Map<string, { value: T; expiresAt: number }>, key: string, value: T) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + cacheTtlMs,
  });
}

function buildInstrumentLabel(name: string | undefined, symbol: string) {
  const normalizedName = name?.trim();
  const normalizedSymbol = symbol.trim().toUpperCase();

  if (!normalizedName) {
    return normalizedSymbol;
  }

  if (normalizeAssetKey(normalizedName) === normalizeAssetKey(normalizedSymbol)) {
    return normalizedSymbol;
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
    instrumentType?: string;
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

  const instrumentType = (candidate.instrumentType ?? "").toLowerCase();
  if (instrumentType.includes("digital currency") || instrumentType.includes("physical currency")) {
    score += 40;
  } else if (instrumentType.includes("etf")) {
    score += 30;
  } else if (instrumentType.includes("common stock")) {
    score += 20;
  }

  const exchange = (candidate.exchange ?? "").toUpperCase();
  if (exchange === "NASDAQ" || exchange === "NYSE" || exchange === "NYSE ARCA") {
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

/** Twelve Data `time_series` rows include `datetime` (or `date`); sort ascending for correct range % and sparklines. */
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
      const close = parseNumericValue(row.close);
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
    return [...rows]
      .sort((a, b) => (a.ts as number) - (b.ts as number))
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
 * Maps UI timeframes to Twelve Data `time_series` params. Uses **trading-day** counts for
 * multi-day ranges so labels match user expectations (avoids e.g. 42×4h spanning many calendar weeks).
 */
function formatTimeframe(timeframe: MarketSeries["timeframe"]) {
  switch (timeframe) {
    case "1D":
      // ~24 hourly bars (24/5 FX/crypto; US equities get session hours only).
      return { interval: "1h", outputsize: "24" };
    case "1W":
      // One trading week (Mon–Fri week of daily closes).
      return { interval: "1day", outputsize: "5" };
    case "1M":
      // ~1 calendar month of trading sessions (~22 US equity sessions).
      return { interval: "1day", outputsize: "22" };
    case "3M":
      // ~3 calendar months of trading sessions (~63 sessions).
      return { interval: "1day", outputsize: "63" };
    case "1Y":
      // ~1 US trading year of daily closes.
      return { interval: "1day", outputsize: "252" };
  }
}

async function fetchTwelveData(endpoint: string, params: Record<string, string>) {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    throw new Error("TWELVE_DATA_API_KEY is not configured.");
  }

  const url = new URL(`https://api.twelvedata.com/${endpoint}`);
  Object.entries({ ...params, apikey: apiKey }).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetchWithRetry(url, {
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    throw new Error(`Twelve Data request failed with ${response.status}.`);
  }

  const json = (await response.json()) as Record<string, unknown>;
  if (json.status === "error") {
    throw new Error(String(json.message ?? "Twelve Data returned an error."));
  }

  return json;
}

async function searchMarketInstrument(asset: string): Promise<MarketInstrument | null> {
  const cacheKey = normalizeAssetKey(asset);
  const cached = getCached(instrumentCache, cacheKey);
  if (cached) {
    return cached;
  }

  const json = await fetchTwelveData("symbol_search", {
    symbol: asset,
    outputsize: "5",
  });
  const data = Array.isArray(json.data) ? json.data : [];

  const bestMatch = data
    .map((entry) => {
      const candidate = entry as Record<string, unknown>;
      if (typeof candidate.symbol !== "string" || candidate.symbol.trim().length === 0) {
        return null;
      }

      return {
        symbol: candidate.symbol.trim(),
        instrumentName:
          typeof candidate.instrument_name === "string" ? candidate.instrument_name.trim() : undefined,
        exchange: typeof candidate.exchange === "string" ? candidate.exchange.trim() : undefined,
        instrumentType:
          typeof candidate.instrument_type === "string"
            ? candidate.instrument_type.trim()
            : undefined,
      };
    })
    .filter((value): value is NonNullable<typeof value> => value !== null)
    .sort((left, right) => scoreInstrumentMatch(asset, right) - scoreInstrumentMatch(asset, left))[0];

  if (!bestMatch) {
    return null;
  }

  const instrument: MarketInstrument = {
    asset: buildInstrumentLabel(bestMatch.instrumentName, bestMatch.symbol),
    symbol: bestMatch.symbol,
    ...(bestMatch.exchange ? { exchange: bestMatch.exchange } : {}),
  };

  setCached(instrumentCache, cacheKey, instrument);
  return instrument;
}

async function resolveMarketInstrument(asset: string): Promise<MarketInstrument> {
  const resolved = resolveSupportedAsset(asset);
  if (resolved) {
    return resolved;
  }

  const searched = await searchMarketInstrument(asset);
  if (searched) {
    return searched;
  }

  throw new Error(`Unsupported asset: ${asset}`);
}

export async function getMarketQuote(asset: string): Promise<MarketQuote> {
  const resolved = await resolveMarketInstrument(asset);

  const cacheKey = resolved.exchange ? `${resolved.symbol}:${resolved.exchange}` : resolved.symbol;
  const cached = getCached(quoteCache, cacheKey);
  if (cached) {
    return cached;
  }

  const json = await fetchTwelveData("quote", {
    symbol: resolved.symbol,
    ...(resolved.exchange ? { exchange: resolved.exchange } : {}),
  });
  const price = requireNumericValue(
    parseNumericValue(json.close) ??
    parseNumericValue(json.price) ??
    parseNumericValue(json.last),
    "Twelve Data quote did not include a valid price.",
  );
  const changePercent = requireNumericValue(
    parseNumericValue(json.percent_change) ??
    parseNumericValue(json.change_percent) ??
    parseNumericValue(json.change),
    "Twelve Data quote did not include a valid percentage change.",
  );

  const quote: MarketQuote = {
    asset: resolved.asset,
    symbol: resolved.symbol,
    price,
    changePercent,
    direction: changePercent >= 0 ? "up" : "down",
    isMarketOpen:
      typeof json.is_market_open === "boolean"
        ? json.is_market_open
        : typeof json.is_market_open === "string"
          ? json.is_market_open === "true"
          : null,
    ...(resolved.proxyAssumption ? { proxyAssumption: resolved.proxyAssumption } : {}),
  };

  setCached(quoteCache, cacheKey, quote);
  return quote;
}

export async function getMarketSeries(
  asset: string,
  timeframe: MarketSeries["timeframe"] = "1W",
): Promise<MarketSeries> {
  const resolved = await resolveMarketInstrument(asset);

  const cacheKey = `${resolved.exchange ? `${resolved.symbol}:${resolved.exchange}` : resolved.symbol}:${timeframe}`;
  const cached = getCached(seriesCache, cacheKey);
  if (cached) {
    return cached;
  }

  const window = formatTimeframe(timeframe);
  const json = await fetchTwelveData("time_series", {
    symbol: resolved.symbol,
    ...(resolved.exchange ? { exchange: resolved.exchange } : {}),
    interval: window.interval,
    outputsize: window.outputsize,
    format: "JSON",
  });

  const values = Array.isArray(json.values) ? json.values : [];
  const closeValues = parseTimeSeriesCloseValues(values);

  if (closeValues.length < 2) {
    throw new Error("Twelve Data time series did not include enough close values.");
  }

  const series: MarketSeries = {
    asset: resolved.asset,
    symbol: resolved.symbol,
    timeframe,
    closeValues,
    resistance: Math.max(...closeValues),
    support: Math.min(...closeValues),
    ...(resolved.proxyAssumption ? { proxyAssumption: resolved.proxyAssumption } : {}),
  };

  setCached(seriesCache, cacheKey, series);
  return series;
}
