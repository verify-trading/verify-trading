#!/usr/bin/env node
/**
 * Populate market_cache with live Twelve Data using Supabase admin client.
 * Run: node --import ./node_modules/@next/env/dist/index.js scripts/seed-market-cache-admin.mjs
 * Or: npx tsx scripts/seed-market-cache-admin.ts
 */

import { createClient } from "@supabase/supabase-js";

const API_KEY = process.env.TWELVE_DATA_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing: TWELVE_DATA_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const API_BASE = "https://api.twelvedata.com";
const admin = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CATEGORIES = {
  major_pairs: ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD", "USD/CHF"],
  commodities: ["XAU/USD", "XAG/USD", "WTI/USD", "XBR/USD", "XPT/USD", "XPD/USD"],
  crypto: ["BTC/USD", "ETH/USD", "SOL/USD", "XRP/USD", "BNB/USD", "ADA/USD"],
};

const ALL_SYMBOLS = Object.values(CATEGORIES).flat();

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
  const { error } = await admin
    .from("market_cache")
    .upsert({ cache_key: key, payload, fetched_at: new Date().toISOString() }, { onConflict: "cache_key" });

  if (error) throw new Error(`Cache write failed: ${error.message}`);
}

async function seedQuotes() {
  console.log("📊 Fetching quotes...");
  const quotes = {};
  for (const [cat, symbols] of Object.entries(CATEGORIES)) {
    const data = await fetchJson(buildUrl("quote", { symbol: symbols.join(",") }));
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
    console.log(`  ✅ ${cat}: ${symbols.length} quotes`);
  }
  await upsertCache("quotes:all", { quotes });
  console.log("  💾 Saved quotes:all");
  return quotes;
}

async function seedSparklines() {
  console.log("\n📈 Fetching sparklines...");
  const sparklines = {};
  for (const sym of ALL_SYMBOLS) {
    try {
      const data = await fetchJson(buildUrl("time_series", { symbol: sym, interval: "1h", outputsize: "24" }));
      sparklines[sym] = (data.values ?? [])
        .map((v) => parseFloat(v.close))
        .filter(Number.isFinite)
        .reverse();
    } catch (e) {
      sparklines[sym] = [];
    }
  }
  await upsertCache("sparklines:all", { sparklines });
  console.log(`  💾 Saved sparklines:all (${ALL_SYMBOLS.length} symbols)`);
  return sparklines;
}

async function seedDividends() {
  console.log("\n💰 Fetching dividends...");
  const today = new Date().toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  try {
    const data = await fetchJson(buildUrl("dividends_calendar", { start_date: today, end_date: nextWeek }));
    const items = (data ?? [])
      .map((d) => ({ symbol: d.symbol, name: d.name ?? d.symbol, ex_date: d.ex_date, amount: parseFloat(d.amount ?? 0), currency: d.currency ?? "USD" }))
      .filter((d) => d.symbol && d.amount > 0);
    await upsertCache("events:dividends", { items });
    console.log(`  ✅ ${items.length} dividends | 💾 Saved`);
    return items;
  } catch (e) {
    console.log(`  ⚠️  ${e.message}`);
    return [];
  }
}

async function checkCredits() {
  const data = await fetchJson(buildUrl("api_usage", {}));
  console.log(`\n💳 Credits: ${data.current_usage} / ${data.plan_limit} used`);
}

async function main() {
  console.log("🌱 Seeding market_cache with Twelve Data...\n");
  await seedQuotes();
  await seedSparklines();
  await seedDividends();
  await checkCredits();
  console.log("\n✅ Done!");
}

main().catch((e) => { console.error("❌", e.message); process.exit(1); });
