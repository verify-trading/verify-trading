import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { z } from "zod";

import type { DailyMarketBrief } from "@/lib/markets/market-intelligence";

export const DAILY_MARKET_BRIEF_CACHE_KEY = "intelligence:daily-brief";
export const DAILY_MARKET_BRIEF_MODEL = "claude-sonnet-4-20250514";

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

function londonDateParts(now: Date): { dateKey: string; weekday: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);
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

function extractJsonObject(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Daily brief response did not contain JSON.");
  }
  return text.slice(start, end + 1);
}

function coerceBrief(payload: DailyMarketBriefModelPayload): DailyMarketBrief {
  return {
    ...payload,
    generatedAt: new Date().toISOString(),
  };
}

export async function generateDailyMarketBrief(now = new Date(), headlines: string[] = []): Promise<DailyMarketBrief> {
  const { dateKey } = londonDateParts(now);
  const headlinesBlock = headlines.length > 0
    ? `\nToday's market headlines (use as context):\n${headlines.map((h) => `- ${h}`).join("\n")}\n`
    : "";
  const result = await generateText({
    model: anthropic(DAILY_MARKET_BRIEF_MODEL),
    maxOutputTokens: 1000,
    system: "You are verify.trading's market intelligence engine.",
    prompt: `Generate a daily pre-session market brief for today ${dateKey}. Base your analysis on the headlines below when available; otherwise use your general market knowledge. Return only valid JSON in this exact format:
{
  "date": "${dateKey}",
  "overview": "Five to six sentence macro overview of what is driving markets today. Cover: (1) which data releases, central bank commentary, or geopolitical developments are moving price action, (2) sentiment across equities, FX, and commodities, (3) what traders should watch for the rest of the session. Reference the headlines when available.",
  "gold": { "level": "4720", "bias": "Bullish", "verdict": "Watch 4680 support." },
  "oil": { "level": "72.50", "bias": "Neutral", "verdict": "Range bound session." },
  "dxy": { "level": "105.20", "bias": "Bullish", "verdict": "Dollar bid controls risk." },
  "usdjpy": { "level": "157.20", "bias": "Bullish", "verdict": "Watch yields and intervention risk." },
  "eurusd": { "level": "1.0850", "bias": "Bearish", "verdict": "Dollar strength today." },
  "gbpusd": { "level": "1.2900", "bias": "Bearish", "verdict": "Follow EUR lead." },
  "session_tone": "One sentence capturing the dominant session tone and what to watch."
}${headlinesBlock}`,
  });

  const parsed = dailyMarketBriefSchema.parse(JSON.parse(extractJsonObject(result.text)));
  return coerceBrief(parsed);
}
