import { createHash } from "node:crypto";

import type { MarketIntelligenceItem, MarketIntelligenceSnapshot } from "@/lib/markets/market-intelligence";

import { fetchFmpJson } from "./fmp-json";

const NEWS_REVALIDATE_SECONDS = 1_200;
const MAX_ITEMS = 18;

function stableNewsId(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 24);
}

function pickString(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = row[key];
    if (typeof v === "string" && v.trim().length > 0) {
      return v.trim();
    }
  }
  return "";
}

function parsePublishedAt(row: Record<string, unknown>): string {
  const raw =
    pickString(row, ["publishedDate", "date", "published_at", "pubDate"]) ||
    pickString(row, ["publishedTime"]);
  if (!raw) {
    return new Date().toISOString();
  }
  const normalized = /\dT\d/.test(raw) ? raw : raw.replace(" ", "T");
  const ms = Date.parse(normalized);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : new Date().toISOString();
}

function mapNewsRow(row: Record<string, unknown>, feed: string): MarketIntelligenceItem | null {
  const title = pickString(row, ["title", "headline"]);
  if (!title) {
    return null;
  }

  const summary =
    pickString(row, ["text", "description", "content", "snippet"]) ||
    title.slice(0, 280);

  const source =
    pickString(row, ["site", "publisher", "source", "symbol"]) || feed;

  const url = pickString(row, ["url", "link"]);
  const publishedAt = parsePublishedAt(row);

  const id = stableNewsId([url || title, publishedAt, title]);

  return {
    id,
    title,
    source,
    publishedAt,
    summary: summary.slice(0, 2_000),
    ...(url ? { url } : {}),
    category: feed,
  };
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is Record<string, unknown> => item !== null && typeof item === "object");
}

/**
 * Fetches general + forex latest headlines from FMP, merges, dedupes, and caps length.
 */
export async function getMarketIntelligenceSnapshot(): Promise<MarketIntelligenceSnapshot> {
  const [generalResult, forexResult] = await Promise.allSettled([
    fetchFmpJson(
      "stable/news/general-latest",
      { page: "0", limit: "25" },
      NEWS_REVALIDATE_SECONDS,
    ),
    fetchFmpJson(
      "stable/news/forex-latest",
      { page: "0", limit: "25" },
      NEWS_REVALIDATE_SECONDS,
    ),
  ]);

  const general =
    generalResult.status === "fulfilled"
      ? asRecordArray(generalResult.value).map((row) => mapNewsRow(row, "General"))
      : [];
  const forex =
    forexResult.status === "fulfilled"
      ? asRecordArray(forexResult.value).map((row) => mapNewsRow(row, "Forex"))
      : [];

  const merged = [...general, ...forex].filter((item): item is MarketIntelligenceItem => item !== null);
  if (merged.length === 0) {
    throw new Error("Market intelligence feeds are temporarily unavailable.");
  }

  const seen = new Set<string>();
  const deduped: MarketIntelligenceItem[] = [];
  for (const item of merged) {
    const key = (item.url ?? "").length > 0 ? `u:${item.url}` : `t:${item.title.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(item);
  }

  deduped.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  return {
    updatedAt: new Date().toISOString(),
    items: deduped.slice(0, MAX_ITEMS),
  };
}
