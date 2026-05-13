import { createHash } from "node:crypto";

import type { MarketIntelligenceItem, MarketIntelligenceSnapshot } from "@/lib/markets/market-intelligence";
import { fetchNewsEverything, type NewsArticleSummary } from "@/lib/ask/newsdata";

const MAX_ITEMS = 18;
const MARKET_SOURCE_LOOKBACK_HOURS = 36;
const MARKET_NEWS_QUERIES = [
  { query: "forex market", category: "FX", tag: "FX" },
  { query: "gold oil commodities", category: "Commodities", tag: "CMDTY" },
  { query: "bitcoin crypto market", category: "Crypto", tag: "CRYPTO" },
  { query: "Federal Reserve inflation markets", category: "Macro", tag: "MACRO" },
] as const;

const LOW_QUALITY_TEXT_PATTERNS = [
  /only available in paid plans/i,
  /earnings call transcript/i,
  /\bfree ai trading bots?\b/i,
  /\bprice prediction\b/i,
  /\btestnet buzz\b/i,
  /\btechnical brief\b/i,
] as const;

function stableNewsId(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 24);
}

function normalizePublishedAt(value: string): string {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : new Date().toISOString();
}

function isFreshEnough(publishedAt: string, now: Date): boolean {
  const ms = Date.parse(publishedAt);
  if (!Number.isFinite(ms)) {
    return true;
  }
  const ageMs = now.getTime() - ms;
  return ageMs >= 0 && ageMs <= MARKET_SOURCE_LOOKBACK_HOURS * 60 * 60 * 1000;
}

function isLowQualityArticle(title: string, description: string): boolean {
  const text = `${title}\n${description}`;
  return LOW_QUALITY_TEXT_PATTERNS.some((pattern) => pattern.test(text));
}

function mapArticle(
  article: NewsArticleSummary,
  category: string,
  tag: string,
  now: Date,
): MarketIntelligenceItem | null {
  const title = article.title.trim();
  const summary = (article.description || title).trim();
  if (!title || !article.url) {
    return null;
  }
  if (!isFreshEnough(article.publishedAt, now) || isLowQualityArticle(title, summary)) {
    return null;
  }

  return {
    id: stableNewsId([article.url, title, article.publishedAt]),
    title,
    source: article.source || "NewsData",
    publishedAt: normalizePublishedAt(article.publishedAt),
    summary: summary.slice(0, 2_000),
    url: article.url,
    category,
    tag,
  };
}

async function fetchMarketNewsSources(now: Date): Promise<MarketIntelligenceItem[]> {
  const settled = await Promise.allSettled(
    MARKET_NEWS_QUERIES.map(async ({ query, category, tag }) => {
      const result = await fetchNewsEverything({
        query,
        language: "en",
        pageSize: 8,
      });
      return result.articles
        .map((article) => mapArticle(article, category, tag, now))
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
  return deduped.slice(0, MAX_ITEMS);
}

export async function getMarketIntelligenceSnapshot(): Promise<MarketIntelligenceSnapshot> {
  const sourceItems = await fetchMarketNewsSources(new Date());

  return {
    updatedAt: new Date().toISOString(),
    items: sourceItems,
    sourceCount: sourceItems.length,
  };
}
