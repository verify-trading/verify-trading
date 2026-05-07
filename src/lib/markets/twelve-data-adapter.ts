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
  const res = await fetch(url, { cache: "no-store" });
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

  const results: TwelveDataQuote[] = [];
  for (const sym of symbols) {
    const raw = data[sym];
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

/** Fetch 24 hourly closes for sparkline charts (1 credit per symbol). */
export async function fetchSparkline(symbol: string): Promise<TwelveDataSparkline> {
  return fetchMarketSeries(symbol, "1D");
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
  const values = (data.values ?? [])
    .map((v) => parseFloat(v.close))
    .filter(Number.isFinite)
    .reverse(); // oldest first

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

/** Fetch earnings history for a symbol (20 credits per symbol). */
export async function fetchEarnings(symbol: string): Promise<Array<{
  fiscal_date: string | null;
  eps_actual: number | null;
  eps_estimate: number | null;
  surprise_prc: number | null;
}>> {
  const url = buildUrl("earnings", { symbol });
  const data = (await fetchJson(url)) as { earnings?: Array<Record<string, unknown>> };
  if (!data.earnings) return [];

  return data.earnings.map((e) => ({
    fiscal_date: e.fiscal_date ? String(e.fiscal_date) : null,
    eps_actual: e.eps_actual ? parseFloat(String(e.eps_actual)) : null,
    eps_estimate: e.eps_estimate ? parseFloat(String(e.eps_estimate)) : null,
    surprise_prc: e.surprise_prc ? parseFloat(String(e.surprise_prc)) : null,
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

/** Read a cached payload by key. */
export async function readCache<T>(key: string): Promise<T | null> {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("market_cache")
    .select("payload")
    .eq("cache_key", key)
    .single();

  if (error || !data) return null;
  return data.payload as T;
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

/** ─── Verification ─── */

export async function verifyTwelveData(): Promise<{
  quotes: Record<string, TwelveDataQuote[]>;
  sparklines: Record<string, TwelveDataSparkline>;
  creditUsage: { current: number; limit: number };
}> {
  console.log("\n🔍 Verifying Twelve Data API...\n");

  // 1. Fetch quotes for all categories
  const quotes: Record<string, TwelveDataQuote[]> = {};
  for (const [cat, { label, symbols }] of Object.entries(MARKET_CATEGORIES)) {
    console.log(`Fetching ${label} (${symbols.length} symbols)...`);
    try {
      const data = await fetchQuotes(symbols);
      quotes[cat] = data;
      console.log(`  ✅ ${data.length} quotes received`);
      data.forEach((q) => {
        const dir = q.percent_change >= 0 ? "▲" : "▼";
        console.log(`     ${q.symbol}: ${q.price.toFixed(5)} ${dir} ${q.percent_change.toFixed(2)}%`);
      });
    } catch (e) {
      console.log(`  ❌ Failed: ${e instanceof Error ? e.message : String(e)}`);
      quotes[cat] = [];
    }
  }

  // 2. Fetch sparkline for one symbol from each category
  const sparklines: Record<string, TwelveDataSparkline> = {};
  const sampleSymbols = ["EUR/USD", "XAU/USD", "BTC/USD"];
  for (const sym of sampleSymbols) {
    console.log(`\nFetching sparkline for ${sym}...`);
    try {
      const data = await fetchSparkline(sym);
      sparklines[sym] = data;
      console.log(`  ✅ ${data.values.length} data points`);
      console.log(`     Range: ${data.values[0]?.toFixed(5)} → ${data.values[data.values.length - 1]?.toFixed(5)}`);
    } catch (e) {
      console.log(`  ❌ Failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 3. Check credit usage
  console.log("\nChecking API credit usage...");
  const usageRes = await fetch(buildUrl("api_usage", {}), { cache: "no-store" });
  const usage = (await usageRes.json()) as { current_usage: number; plan_limit: number };
  console.log(`  📊 Used: ${usage.current_usage} / ${usage.plan_limit} credits`);

  return { quotes, sparklines, creditUsage: { current: usage.current_usage, limit: usage.plan_limit } };
}
