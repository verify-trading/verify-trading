#!/usr/bin/env node
/**
 * Standalone verification script for Twelve Data API.
 * Run: node scripts/verify-twelve-data.mjs
 */

const API_KEY = process.env.TWELVE_DATA_API_KEY;
if (!API_KEY) {
  console.error("❌ TWELVE_DATA_API_KEY not set");
  process.exit(1);
}

const API_BASE = "https://api.twelvedata.com";

const CATEGORIES = {
  major_pairs: {
    label: "Major Pairs",
    symbols: ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD", "USD/CHF"],
  },
  commodities: {
    label: "Commodities",
    symbols: ["XAU/USD", "XAG/USD", "WTI", "BZ", "HG", "PL"],
  },
  crypto: {
    label: "Crypto",
    symbols: ["BTC/USD", "ETH/USD", "SOL/USD", "XRP/USD", "BNB/USD", "ADA/USD"],
  },
};

function buildUrl(endpoint, params) {
  const qs = new URLSearchParams({ ...params, apikey: API_KEY }).toString();
  return `${API_BASE}/${endpoint}?${qs}`;
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.status === "error") throw new Error(data.message);
  return data;
}

async function verifyQuotes() {
  console.log("\n📊 === QUOTES VERIFICATION ===\n");
  const allQuotes = {};

  for (const [cat, { label, symbols }] of Object.entries(CATEGORIES)) {
    console.log(`Fetching ${label}...`);
    try {
      const url = buildUrl("quote", { symbol: symbols.join(",") });
      const data = await fetchJson(url);

      const results = [];
      for (const sym of symbols) {
        const raw = data[sym];
        if (!raw) {
          console.log(`  ⚠️  ${sym}: NO DATA`);
          continue;
        }
        const price = parseFloat(raw.close ?? raw.price ?? 0);
        const pct = parseFloat(raw.percent_change ?? 0);
        const name = raw.name ?? sym;
        results.push({ symbol: sym, name, price, percent_change: pct, exchange: raw.exchange });
        const dir = pct >= 0 ? "▲" : "▼";
        console.log(`  ✅ ${sym}: ${price.toFixed(5)} ${dir} ${pct.toFixed(2)}% [${raw.exchange}]`);
      }
      allQuotes[cat] = results;
    } catch (e) {
      console.log(`  ❌ FAILED: ${e.message}`);
      allQuotes[cat] = [];
    }
  }

  return allQuotes;
}

async function verifySparklines() {
  console.log("\n📈 === SPARKLINES VERIFICATION ===\n");
  const samples = ["EUR/USD", "XAU/USD", "BTC/USD"];

  for (const sym of samples) {
    try {
      const url = buildUrl("time_series", { symbol: sym, interval: "1h", outputsize: "24" });
      const data = await fetchJson(url);
      const values = (data.values ?? [])
        .map((v) => parseFloat(v.close))
        .filter(Number.isFinite)
        .reverse();
      console.log(`  ✅ ${sym}: ${values.length} points | ${values[0]?.toFixed(5)} → ${values[values.length - 1]?.toFixed(5)}`);
    } catch (e) {
      console.log(`  ❌ ${sym}: ${e.message}`);
    }
  }
}

async function verifyDividends() {
  console.log("\n💰 === DIVIDENDS CALENDAR VERIFICATION ===\n");
  const today = new Date().toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);

  try {
    const url = buildUrl("dividends_calendar", { start_date: today, end_date: nextWeek });
    const data = await fetchJson(url);

    if (!Array.isArray(data)) {
      console.log(`  ⚠️  Unexpected response format:`, JSON.stringify(data).slice(0, 200));
      return [];
    }

    const items = data
      .map((d) => ({
        symbol: d.symbol,
        name: d.name ?? d.symbol,
        ex_date: d.ex_date,
        amount: parseFloat(d.amount ?? 0),
        currency: d.currency ?? "USD",
      }))
      .filter((d) => d.symbol && d.amount > 0);

    console.log(`  ✅ ${items.length} dividend events found`);
    items.slice(0, 8).forEach((d) => {
      console.log(`     ${d.symbol}: $${d.amount} ex-${d.ex_date} (${d.currency})`);
    });
    if (items.length > 8) console.log(`     ... and ${items.length - 8} more`);

    return items;
  } catch (e) {
    console.log(`  ❌ FAILED: ${e.message}`);
    return [];
  }
}

async function checkCredits() {
  console.log("\n💳 === CREDIT USAGE ===\n");
  try {
    const url = buildUrl("api_usage", {});
    const data = await fetchJson(url);
    console.log(`  Used: ${data.current_usage} / ${data.plan_limit} credits (${data.plan_category} plan)`);
    console.log(`  Remaining: ${data.plan_limit - data.current_usage}`);
    return data;
  } catch (e) {
    console.log(`  ❌ Failed to check credits: ${e.message}`);
    return null;
  }
}

async function main() {
  console.log("🔍 Twelve Data API End-to-End Verification");
  console.log("===========================================");

  const quotes = await verifyQuotes();
  await verifySparklines();
  const dividends = await verifyDividends();
  const credits = await checkCredits();

  console.log("\n📋 === SUMMARY ===\n");

  let totalQuotes = 0;
  for (const [cat, items] of Object.entries(quotes)) {
    console.log(`  ${CATEGORIES[cat].label}: ${items.length}/${CATEGORIES[cat].symbols.length} symbols OK`);
    totalQuotes += items.length;
  }
  console.log(`  Total quotes: ${totalQuotes}/18 symbols`);
  console.log(`  Dividends: ${dividends.length} events`);

  if (credits) {
    const used = credits.current_usage;
    const limit = credits.plan_limit;
    const pct = ((used / limit) * 100).toFixed(1);
    console.log(`  Credits used this run: ~${used} (${pct}%)`);
    if (used > limit) {
      console.log(`  ⚠️  OVER LIMIT! You need to wait before making more calls.`);
    }
  }

  // Determine if data is good enough
  const allSymbolsOk = totalQuotes >= 15; // At least 15 of 18 symbols working
  const dividendsOk = dividends.length > 0;

  console.log("\n✅ DATA QUALITY CHECK:");
  console.log(`  Quotes: ${allSymbolsOk ? "PASS" : "FAIL"} (${totalQuotes}/18 symbols)`);
  console.log(`  Dividends: ${dividendsOk ? "PASS" : "FAIL"} (${dividends.length} events)`);

  if (allSymbolsOk && dividendsOk) {
    console.log("\n🎉 All data verified. Ready to build!");
    process.exit(0);
  } else {
    console.log("\n⚠️  Some data sources are weak. Review failures above.");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
