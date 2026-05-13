import { createHash } from "node:crypto";

import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { z } from "zod";

import { fetchNewsEverything, type NewsArticleSummary } from "@/lib/ask/newsdata";
import type { MarketIntelligenceItem, MarketIntelligenceSnapshot } from "@/lib/markets/market-intelligence";

const MAX_ITEMS = 18;
const MAX_SOURCE_ITEMS = 16;
const MARKET_INTELLIGENCE_MODEL = "claude-sonnet-4-20250514";
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

const marketSummarySchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
});

type MarketSummaryPayload = z.infer<typeof marketSummarySchema>;

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

function extractJsonObject(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Market summary response did not contain JSON.");
  }
  return text.slice(start, end + 1);
}

function buildSourceDigest(items: readonly MarketIntelligenceItem[]): string {
  return items
    .slice(0, MAX_SOURCE_ITEMS)
    .map((item, index) => {
      const summary = item.summary ? `\nSummary: ${item.summary}` : "";
      return `${index + 1}. [${item.category ?? "Market"}] ${item.title}
Published: ${item.publishedAt}${summary}`;
    })
    .join("\n\n");
}

function formatAsOfDate(now: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(now);
}

async function summarizeMarketNews(items: readonly MarketIntelligenceItem[], now: Date): Promise<MarketSummaryPayload> {
  const result = await generateText({
    model: anthropic(MARKET_INTELLIGENCE_MODEL),
    maxOutputTokens: 900,
    system: "You are verify.trading's market intelligence engine.",
    prompt: `Today is ${formatAsOfDate(now)} London time.
Turn the following market-related source headlines into one concise Market Summary for traders.

Rules:
- Return only valid JSON.
- Produce exactly one title and one summary.
- The title should read like a market-summary headline, not a source headline.
- The summary should be 3 to 5 sentences explaining what changed and why traders should care.
- Prioritize FX, Gold, Oil, Crypto, inflation, central banks, and broad risk sentiment.
- Be precise about dates. If a source says "April CPI" or "April inflation", call it April CPI/latest CPI data; do not imply April is the current calendar month.
- Do not invent levels, percentages, conflicts, or policy claims that are not present in the source headlines/summaries.
- Do not include links.

JSON format:
{
  "title": "Hot US CPI Sends Dollar Higher, Euro Lower",
  "summary": "The Dollar Index rallied after hotter inflation strengthened the case for a higher-for-longer Fed stance. EUR/USD came under pressure as traders repriced rate expectations. Gold and oil stayed sensitive to geopolitical risk while traders watched US yields."
}

Source headlines:
${buildSourceDigest(items)}`,
  });

  return marketSummarySchema.parse(JSON.parse(extractJsonObject(result.text)));
}

function mapSummaryItems(
  payload: MarketSummaryPayload,
  sources: readonly MarketIntelligenceItem[],
): MarketIntelligenceItem[] {
  const newestPublishedAt = sources[0]?.publishedAt ?? new Date().toISOString();
  return [
    {
      id: stableNewsId(["market-summary", payload.title, payload.summary]),
      title: payload.title,
      source: "verify.trading AI",
      publishedAt: newestPublishedAt,
      summary: payload.summary,
      category: "Market Summary",
      tag: "AI",
    },
  ];
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
  const now = new Date();
  const sourceItems = await fetchMarketNewsSources(now);
  const summary = await summarizeMarketNews(sourceItems, now);

  return {
    updatedAt: new Date().toISOString(),
    items: [...mapSummaryItems(summary, sourceItems), ...sourceItems],
    sourceCount: sourceItems.length,
  };
}
