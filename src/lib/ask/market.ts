import { z } from "zod";
import { fetchWithRetry } from "@/lib/http/fetch-with-retry";

const quoteCache = new Map<string, { value: MarketQuote; expiresAt: number }>();
const seriesCache = new Map<string, { value: MarketSeries; expiresAt: number }>();
const instrumentCache = new Map<string, { value: MarketInstrument; expiresAt: number }>();

const cacheTtlMs = 60_000;

type MarketInstrument = {
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
  btc: { asset: "BITCOIN / USD", symbol: "BTCUSD" },
  ethereum: { asset: "ETHEREUM / USD", symbol: "ETHUSD" },
  ethereumusd: { asset: "ETHEREUM / USD", symbol: "ETHUSD" },
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

function collapseAssetText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function inferMarketAssetFromText(text: string): string | null {
  return inferMarketAssetsFromText(text)[0] ?? null;
}

export function inferMarketAssetsFromText(text: string): string[] {
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

  return [...new Set(matches.map((match) => match[1].asset))];
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

async function fetchFmpData(pathname: string, params: Record<string, string>) {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) {
    throw new Error("FMP_API_KEY is not configured.");
  }

  const url = new URL(`https://financialmodelingprep.com/${pathname}`);
  Object.entries({ ...params, apikey: apiKey }).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetchWithRetry(url, {
    next: { revalidate: 60 },
  });

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

async function searchMarketInstrument(asset: string): Promise<MarketInstrument | null> {
  const cacheKey = normalizeAssetKey(asset);
  const cached = getCached(instrumentCache, cacheKey);
  if (cached) {
    return cached;
  }

  const [symbolMatches, nameMatches] = await Promise.all([
    fetchFmpData("stable/search-symbol", {
      query: asset,
    }).catch(() => []),
    fetchFmpData("stable/search-name", {
      query: asset,
    }).catch(() => []),
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

  const bestMatch = uniqueCandidates
    .map((entry) => {
      const candidate = entry as Record<string, unknown>;
      if (typeof candidate.symbol !== "string" || candidate.symbol.trim().length === 0) {
        return null;
      }

      return {
        symbol: candidate.symbol.trim(),
        instrumentName:
          typeof candidate.name === "string" ? candidate.name.trim() : undefined,
        exchange: typeof candidate.exchange === "string" ? candidate.exchange.trim() : undefined,
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

  const cacheKey = resolved.symbol;
  const cached = getCached(quoteCache, cacheKey);
  if (cached) {
    return cached;
  }

  const json = await fetchFmpData("stable/quote", {
    symbol: resolved.symbol,
  });
  const row = Array.isArray(json) ? (json[0] as Record<string, unknown> | undefined) : undefined;
  if (!row) {
    throw new Error(`FMP quote did not return data for ${resolved.symbol}.`);
  }

  const price = requireNumericValue(
    parseNumericValue(row.close) ??
    parseNumericValue(row.price) ??
    parseNumericValue(row.last),
    "FMP quote did not include a valid price.",
  );
  const changePercent = requireNumericValue(
    parseNumericValue(row.changePercentage) ??
    parseNumericValue(row.percent_change) ??
    parseNumericValue(row.change_percent) ??
    parseNumericValue(row.change),
    "FMP quote did not include a valid percentage change.",
  );

  const quote: MarketQuote = {
    asset: resolved.asset,
    symbol: resolved.symbol,
    price,
    changePercent,
    direction: changePercent >= 0 ? "up" : "down",
    isMarketOpen: null,
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
  const window = formatTimeframe(timeframe);

  const cacheKey = `${resolved.symbol}:${timeframe}`;
  const cached = getCached(seriesCache, cacheKey);
  if (cached) {
    const closeValues = trimCloseValues(cached.closeValues, window.points);
    return {
      ...cached,
      closeValues,
      support: Math.min(...closeValues),
      resistance: Math.max(...closeValues),
    };
  }

  const json = await fetchFmpData("stable/historical-price-eod/light", {
    symbol: resolved.symbol,
    limit: window.limit,
  });

  const values = Array.isArray(json) ? json : [];
  const closeValues = trimCloseValues(parseTimeSeriesCloseValues(values), window.points);

  if (closeValues.length < 2) {
    throw new Error("FMP historical prices did not include enough close values.");
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
