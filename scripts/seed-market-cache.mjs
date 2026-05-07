#!/usr/bin/env node
/**
 * One-time seed script to populate market_cache with Twelve Data.
 * Run: TWELVE_DATA_API_KEY=xxx SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/seed-market-cache.mjs
 */

const API_KEY = process.env.TWELVE_DATA_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing required env vars: TWELVE_DATA_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const API_BASE = "https://api.twelvedata.com";

const CATEGORIES = {
  major_pairs: ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD", "USD/CHF"],
  commodities: ["XAU/USD", "XAG/USD", "WTI/USD", "XBR/USD", "XPT/USD", "XPD/USD"],
  crypto: ["BTC/USD", "ETH/USD", "SOL/USD", "XRP/USD", "BNB/USD", "ADA/USD"],
};

const ALL_SYMBOLS = [...CATEGORIES.major_pairs, ...CATEGORIES.commodities, ...CATEGORIES.crypto];

function buildUrl(endpoint, params) {
  const qs = new URLSearchParams({ ...params, apikey: API_KEY }).toString();
  return `${API_BASE}/${endpoint}?${qs}`;
}

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["true", "1", "yes", "open"].includes(value.trim().toLowerCase());
  return Boolean(value);
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.status === "error") throw new Error(data.message);
  return data;
}

async function upsertCache(key, payload) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/market_cache?on_conflict=cache_key`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Prefer": "resolution=merge-duplicates",
    },
    body: JSON.stringify({ cache_key: key, payload, fetched_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`Supabase upsert failed: ${res.status}`);
  return res.json();
}

async function seedQuotes() {
  console.log("Fetching quotes for all 18 symbols...");
  const quotes = {};

  for (const [cat, symbols] of Object.entries(CATEGORIES)) {
    const url = buildUrl("quote", { symbol: symbols.join(",") });
    const data = await fetchJson(url);
    for (const sym of symbols) {
      const raw = data[sym];
      if (!raw) continue;
      quotes[sym] = {
        symbol: sym,
        name: raw.name ?? sym,
        price: parseFloat(raw.close ?? 0),
        change: parseFloat(raw.change ?? 0),
        percent_change: parseFloat(raw.percent_change ?? 0),
        open: parseFloat(raw.open ?? 0),
        high: parseFloat(raw.high ?? 0),
        low: parseFloat(raw.low ?? 0),
        previous_close: parseFloat(raw.previous_close ?? 0),
        is_market_open: parseBoolean(raw.is_market_open),
        exchange: raw.exchange ?? "",
      };
    }
    console.log(`  ✅ ${cat}: ${symbols.length} symbols`);
  }

  await upsertCache("quotes:all", { quotes });
  console.log("  💾 Saved quotes:all to DB");
  return quotes;
}

async function seedSparklines() {
  console.log("\nFetching sparklines for all 18 symbols...");
  const sparklines = {};

  for (const sym of ALL_SYMBOLS) {
    try {
      const url = buildUrl("time_series", { symbol: sym, interval: "1h", outputsize: "24" });
      const data = await fetchJson(url);
      sparklines[sym] = (data.values ?? [])
        .map((v) => parseFloat(v.close))
        .filter(Number.isFinite)
        .reverse();
    } catch (e) {
      console.log(`  ⚠️  ${sym}: ${e.message}`);
      sparklines[sym] = [];
    }
  }

  await upsertCache("sparklines:all", { sparklines });
  console.log("  💾 Saved sparklines:all to DB");
  return sparklines;
}

async function seedDividends() {
  console.log("\nFetching dividends calendar...");
  const today = new Date().toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);

  try {
    const url = buildUrl("dividends_calendar", { start_date: today, end_date: nextWeek });
    const data = await fetchJson(url);
    const items = (data ?? [])
      .map((d) => ({
        symbol: d.symbol,
        name: d.name ?? d.symbol,
        ex_date: d.ex_date,
        amount: parseFloat(d.amount ?? 0),
        currency: d.currency ?? "USD",
      }))
      .filter((d) => d.symbol && d.amount > 0);

    await upsertCache("events:dividends", { items });
    console.log(`  ✅ ${items.length} dividends | 💾 Saved to DB`);
    return items;
  } catch (e) {
    console.log(`  ❌ Failed: ${e.message}`);
    await upsertCache("events:dividends", { items: [] });
    return [];
  }
}

async function checkCredits() {
  console.log("\nChecking API credits...");
  const data = await fetchJson(buildUrl("api_usage", {}));
  console.log(`  Used: ${data.current_usage} / ${data.plan_limit} (${data.plan_category})`);
}

async function main() {
  console.log("🌱 Seeding market_cache with Twelve Data...\n");

  await seedQuotes();
  await seedSparklines();
  await seedDividends();
  await checkCredits();

  console.log("\n✅ Seed complete!");
}

main().catch((e) => {
  console.error("\n❌ Seed failed:", e.message);
  process.exit(1);
});
