import { createHash } from "node:crypto";

import { fetchNewsEverything, type NewsArticleSummary } from "@/lib/ask/newsdata";
import type { MarketIntelligenceItem, MarketIntelligenceSnapshot } from "@/lib/markets/market-intelligence";

const MAX_ITEMS = 18;
const MARKET_NEWS_QUERIES = [
  { query: "forex market", category: "FX", tag: "FX" },
  { query: "gold oil commodities", category: "Commodities", tag: "CMDTY" },
  { query: "bitcoin crypto market", category: "Crypto", tag: "CRYPTO" },
  { query: "Federal Reserve inflation markets", category: "Macro", tag: "MACRO" },
] as const;

function stableNewsId(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 24);
}

function normalizePublishedAt(value: string): string {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : new Date().toISOString();
}

function mapArticle(
  article: NewsArticleSummary,
  category: string,
  tag: string,
): MarketIntelligenceItem | null {
  const title = article.title.trim();
  if (!title || !article.url) {
    return null;
  }

  return {
    id: stableNewsId([article.url, title, article.publishedAt]),
    title,
    source: article.source || "NewsData",
    publishedAt: normalizePublishedAt(article.publishedAt),
    summary: (article.description || title).slice(0, 2_000),
    url: article.url,
    category,
    tag,
  };
}

export async function getMarketIntelligenceSnapshot(): Promise<MarketIntelligenceSnapshot> {
  const settled = await Promise.allSettled(
    MARKET_NEWS_QUERIES.map(async ({ query, category, tag }) => {
      const result = await fetchNewsEverything({
        query,
        language: "en",
        pageSize: 8,
      });
      return result.articles
        .map((article) => mapArticle(article, category, tag))
        .filter((item): item is MarketIntelligenceItem => item !== null);
    }),
  );

  const merged = settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  if (merged.length === 0) {
    throw new Error("Market intelligence headlines are temporarily unavailable.");
  }

  const seen = new Set<string>();
  const deduped: MarketIntelligenceItem[] = [];
  for (const item of merged) {
    const key = item.url ? `u:${item.url}` : `t:${item.title.toLowerCase()}`;
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
