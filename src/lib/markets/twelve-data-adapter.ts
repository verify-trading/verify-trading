import { fetchWithRetry } from "@/lib/http/fetch-with-retry";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const API_KEY = process.env.TWELVE_DATA_API_KEY ?? "";
const API_BASE = "https://api.twelvedata.com";

export const MARKET_CATEGORIES = {
  major_pairs: {
    label: "Major Pairs",
    symbols: ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD", "USD/CHF"],
  },
  commodities: {
    label: "Commodities",
    symbols: ["XAU/USD", "XAG/USD", "WTI/USD", "XBR/USD", "XPT/USD", "XPD/USD"],
  },
  crypto: {
    label: "Crypto",
    symbols: ["BTC/USD", "ETH/USD", "SOL/USD", "XRP/USD", "BNB/USD", "ADA/USD"],
  },
  indices: {
    label: "Indices",
    symbols: ["QQQ", "DIA", "EWU", "EWG", "EWJ", "EWH"],
  },
} as const;

export type MarketCategory = keyof typeof MARKET_CATEGORIES;

export type TwelveDataQuote = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  percent_change: number;
  open: number;
  high: number;
  low: number;
  previous_close: number;
  is_market_open: boolean;
  exchange: string;
};

export type TwelveDataSparkline = {
  symbol: string;
  values: number[]; // closing prices, oldest first
};

export type MarketSeriesTimeframe = "1D" | "1W" | "1M" | "3M";

const MARKET_SERIES_TIMEFRAME_CONFIG: Record<MarketSeriesTimeframe, { interval: string; outputsize: string }> = {
  "1D": { interval: "1h", outputsize: "24" },
  "1W": { interval: "1day", outputsize: "7" },
  "1M": { interval: "1day", outputsize: "30" },
  "3M": { interval: "1day", outputsize: "90" },
};

function buildUrl(endpoint: string, params: Record<string, string>): string {
  if (!API_KEY) {
    throw new Error("TWELVE_DATA_API_KEY is not set");
  }
  const qs = new URLSearchParams({ ...params, apikey: API_KEY }).toString();
  return `${API_BASE}/${endpoint}?${qs}`;
}

function parseFiniteNumber(value: unknown): number {
  const parsed = parseFloat(String(value ?? 0));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return ["true", "1", "yes", "open"].includes(value.trim().toLowerCase());
  }
  return Boolean(value);
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetchWithRetry(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from Twelve Data`);
  }
  const data = (await res.json()) as Record<string, unknown>;
  if (data.status === "error") {
    throw new Error(`Twelve Data error: ${data.message}`);
  }
  return data;
}

/** Batch-fetch quotes for up to ~12 symbols in a single call (1 credit each). */
export async function fetchQuotes(symbols: readonly string[]): Promise<TwelveDataQuote[]> {
  const url = buildUrl("quote", { symbol: symbols.join(",") });
  const data = (await fetchJson(url)) as Record<string, Record<string, unknown>>;

  // Single-symbol requests return the quote fields at the top level instead of
  // keyed by symbol; normalize so both shapes parse identically.
  const bySymbol: Record<string, Record<string, unknown>> =
    symbols.length === 1 && !data[symbols[0]] && ("close" in data || "symbol" in data)
      ? { [symbols[0]]: data as Record<string, unknown> }
      : data;

  const results: TwelveDataQuote[] = [];
  for (const sym of symbols) {
    const raw = bySymbol[sym];
    if (!raw || typeof raw !== "object") continue;

    results.push({
      symbol: sym,
      name: String(raw.name ?? sym),
      price: parseFiniteNumber(raw.close ?? raw.price),
      change: parseFiniteNumber(raw.change),
      percent_change: parseFiniteNumber(raw.percent_change),
      open: parseFiniteNumber(raw.open),
      high: parseFiniteNumber(raw.high),
      low: parseFiniteNumber(raw.low),
      previous_close: parseFiniteNumber(raw.previous_close),
      is_market_open: parseBoolean(raw.is_market_open),
      exchange: String(raw.exchange ?? ""),
    });
  }

  return results;
}

/** Fetch close values for the selected-market detail chart. */
export async function fetchMarketSeries(symbol: string, timeframe: MarketSeriesTimeframe): Promise<TwelveDataSparkline> {
  const config = MARKET_SERIES_TIMEFRAME_CONFIG[timeframe];
  const url = buildUrl("time_series", {
    symbol,
    interval: config.interval,
    outputsize: config.outputsize,
  });
  const data = (await fetchJson(url)) as { values?: Array<{ close: string }> };
  const values = [];
  for (const point of data.values ?? []) {
    const close = parseFloat(point.close);
    if (Number.isFinite(close)) {
      values.push(close);
    }
  }
  values.reverse(); // oldest first

  return { symbol, values };
}

/** Fetch market state for all exchanges (1 credit per request). */
export async function fetchMarketState(): Promise<Array<{
  name: string;
  code: string;
  is_market_open: boolean;
  current_time: string;
}>> {
  const url = buildUrl("market_state", {});
  const data = (await fetchJson(url)) as Array<Record<string, unknown>>;
  if (!Array.isArray(data)) return [];

  return data.map((m) => ({
    name: String(m.name ?? ""),
    code: String(m.code ?? ""),
    is_market_open: parseBoolean(m.is_market_open),
    current_time: String(m.current_time ?? ""),
  }));
}

/** Upsert a JSONB payload into the single market_cache table. */
export async function upsertCache(key: string, payload: unknown) {
  const admin = getSupabaseAdminClient();
  if (!admin) throw new Error("Supabase admin client not available");

  const { error } = await admin
    .from("market_cache")
    .upsert(
      { cache_key: key, payload: payload as Record<string, unknown>, fetched_at: new Date().toISOString() },
      { onConflict: "cache_key" },
    );

  if (error) throw new Error(`Cache upsert failed: ${error.message}`);
}

/** True when a cache row's fetchedAt is within ttlMs of now — pairs with readCacheRow. */
export function isCacheFresh(fetchedAt: string | null | undefined, ttlMs: number): boolean {
  if (!fetchedAt) return false;
  const at = Date.parse(fetchedAt);
  return Number.isFinite(at) && Date.now() - at < ttlMs;
}

export async function readCacheRow<T>(key: string): Promise<{ payload: T; fetchedAt: string | null } | null> {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("market_cache")
    .select("payload,fetched_at")
    .eq("cache_key", key)
    .single();

  if (error || !data) return null;
  return {
    payload: data.payload as T,
    fetchedAt: typeof data.fetched_at === "string" ? data.fetched_at : null,
  };
}
