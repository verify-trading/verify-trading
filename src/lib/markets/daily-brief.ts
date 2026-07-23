import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";

import type { DailyMarketBrief } from "@/lib/markets/market-intelligence";

export const DAILY_MARKET_BRIEF_CACHE_KEY = "intelligence:daily-brief";
// Env-overridable so it tracks the same model as Ask (provider.ts) and can't rot
// to a retired snapshot. claude-sonnet-4-20250514 was retired 2026-06-15.
const DAILY_MARKET_BRIEF_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

const dailyMarketBriefSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  overview: z.string().min(1),
  gold: z.object({
    level: z.string().min(1),
    bias: z.string().min(1),
    verdict: z.string().min(1),
  }),
  oil: z.object({
    level: z.string().min(1),
    bias: z.string().min(1),
    verdict: z.string().min(1),
  }),
  dxy: z.object({
    level: z.string().min(1),
    bias: z.string().min(1),
    verdict: z.string().min(1),
  }),
  usdjpy: z.object({
    level: z.string().min(1),
    bias: z.string().min(1),
    verdict: z.string().min(1),
  }),
  eurusd: z.object({
    level: z.string().min(1),
    bias: z.string().min(1),
    verdict: z.string().min(1),
  }),
  gbpusd: z.object({
    level: z.string().min(1),
    bias: z.string().min(1),
    verdict: z.string().min(1),
  }),
  session_tone: z.string().min(1),
});

type DailyMarketBriefModelPayload = z.infer<typeof dailyMarketBriefSchema>;

const LONDON_DATE_PARTS_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
  hour: "2-digit",
  hour12: false,
});

function londonDateParts(now: Date): { dateKey: string; weekday: string; hour: number } {
  const parts = LONDON_DATE_PARTS_FORMATTER.formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return {
    dateKey: `${part("year")}-${part("month")}-${part("day")}`,
    weekday: part("weekday"),
    hour: Number(part("hour")),
  };
}

export function shouldRefreshDailyMarketBrief(
  cached: DailyMarketBrief | null | undefined,
  fetchedAt: string | null | undefined,
  now = new Date(),
): boolean {
  const london = londonDateParts(now);
  if (london.hour < 7) {
    return false;
  }
  if (!cached || cached.date !== london.dateKey) {
    return true;
  }
  if (!cached.dxy && !cached.usdjpy) {
    return true;
  }
  if (!fetchedAt) {
    return true;
  }
  const fetchedAtMs = new Date(fetchedAt).getTime();
  return !Number.isFinite(fetchedAtMs);
}

type QuoteLike = { price?: number | null };

/** Live-quote symbol behind each brief asset (DXY has no Twelve Data feed). */
const BRIEF_ASSET_SYMBOLS = {
  gold: "XAU/USD",
  oil: "WTI/USD",
  usdjpy: "USD/JPY",
  eurusd: "EUR/USD",
  gbpusd: "GBP/USD",
} as const;

type BriefAssetWithPrice = keyof typeof BRIEF_ASSET_SYMBOLS;

function formatLevel(symbol: string, price: number): string {
  if (symbol.includes("JPY")) return price.toFixed(2);
  if (/^(XAU|WTI)/.test(symbol)) return price.toFixed(2); // gold, oil
  return price.toFixed(4); // FX
}

function liveLevels(quotes: Record<string, QuoteLike>): Record<BriefAssetWithPrice, string | null> {
  const levels = {} as Record<BriefAssetWithPrice, string | null>;
  for (const [asset, symbol] of Object.entries(BRIEF_ASSET_SYMBOLS) as [BriefAssetWithPrice, string][]) {
    const price = quotes[symbol]?.price;
    levels[asset] = typeof price === "number" && Number.isFinite(price) ? formatLevel(symbol, price) : null;
  }
  return levels;
}

function coerceBrief(payload: DailyMarketBriefModelPayload): DailyMarketBrief {
  return {
    ...payload,
    generatedAt: new Date().toISOString(),
  };
}

export async function generateDailyMarketBrief(
  now = new Date(),
  headlines: string[] = [],
  quotes: Record<string, QuoteLike> = {},
): Promise<DailyMarketBrief> {
  const { dateKey } = londonDateParts(now);
  const levels = liveLevels(quotes);
  const headlinesBlock = headlines.length > 0
    ? `\nToday's market headlines (your ONLY source for events and named figures):\n${headlines.map((h) => `- ${h}`).join("\n")}\n`
    : "";
  const { object } = await generateObject({
    model: anthropic(DAILY_MARKET_BRIEF_MODEL),
    maxOutputTokens: 1000,
    schema: dailyMarketBriefSchema,
    system: "You are verify.trading's market intelligence engine.",
    prompt: `Generate a daily pre-session market brief for today ${dateKey}.

CURRENT LIVE PRICES — use each value verbatim as that asset's "level". Never invent or alter a price:
- Gold (XAU/USD): ${levels.gold ?? "unavailable"}
- Oil (WTI/USD): ${levels.oil ?? "unavailable"}
- USD/JPY: ${levels.usdjpy ?? "unavailable"}
- EUR/USD: ${levels.eurusd ?? "unavailable"}
- GBP/USD: ${levels.gbpusd ?? "unavailable"}
- DXY: no live feed — estimate a level consistent with the EUR/USD, USD/JPY and GBP/USD prices above.

Base the overview and every verdict ONLY on the headlines and prices above. Do NOT mention any event, data release, person, company, or price level you cannot support from them — no invented news.

Return only valid JSON in this exact format:
{
  "date": "${dateKey}",
  "overview": "Five to six sentence macro overview grounded in the headlines and prices above: what is driving price action, sentiment across equities, FX, and commodities, and what to watch for the rest of the session.",
  "gold": { "level": "${levels.gold ?? ""}", "bias": "Bullish|Bearish|Neutral", "verdict": "One line referencing a nearby level." },
  "oil": { "level": "${levels.oil ?? ""}", "bias": "Bullish|Bearish|Neutral", "verdict": "One line." },
  "dxy": { "level": "<your DXY estimate>", "bias": "Bullish|Bearish|Neutral", "verdict": "One line." },
  "usdjpy": { "level": "${levels.usdjpy ?? ""}", "bias": "Bullish|Bearish|Neutral", "verdict": "One line." },
  "eurusd": { "level": "${levels.eurusd ?? ""}", "bias": "Bullish|Bearish|Neutral", "verdict": "One line." },
  "gbpusd": { "level": "${levels.gbpusd ?? ""}", "bias": "Bullish|Bearish|Neutral", "verdict": "One line." },
  "session_tone": "One sentence capturing the dominant session tone and what to watch."
}${headlinesBlock}`,
  });

  const brief = coerceBrief(object);

  // Authoritative: overwrite the model's numeric levels with the live prices so a
  // hallucinated number can never reach the UI. DXY has no feed, so it keeps the
  // model's estimate.
  for (const asset of Object.keys(BRIEF_ASSET_SYMBOLS) as BriefAssetWithPrice[]) {
    const level = levels[asset];
    const target = brief[asset];
    if (level && target) {
      target.level = level;
    }
  }

  return brief;
}
