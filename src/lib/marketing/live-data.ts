import type { EconomicCalendarSnapshot, EconomicEventItem } from "@/lib/markets/economic-calendar";
import type { DailyMarketBrief } from "@/lib/markets/market-intelligence";
import { DAILY_MARKET_BRIEF_CACHE_KEY } from "@/lib/markets/daily-brief";
import { ECONOMIC_CALENDAR_CACHE_KEY } from "@/lib/markets/rapidapi-economic-calendar";
import { readCacheRow } from "@/lib/markets/twelve-data-adapter";

/**
 * Read-only previews for the public product pages. Both come from the `market_cache`
 * rows the markets cron already fills, so a page render never calls the paid calendar API
 * or the model. Pages using these set `revalidate` (ISR), so this is one DB read an hour.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** High-impact events from the start of today (UTC) for the next 7 days, soonest first. */
export function pickHighImpactEvents(items: EconomicEventItem[], now: Date, limit = 8): EconomicEventItem[] {
  const from = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const to = from + 7 * DAY_MS;
  return items
    .filter((e) => e.impact === "high")
    .filter((e) => {
      const t = Date.parse(e.timeUtc);
      return Number.isFinite(t) && t >= from && t < to;
    })
    .sort((a, b) => a.timeUtc.localeCompare(b.timeUtc))
    .slice(0, limit);
}

export async function getHighImpactPreview(now = new Date()) {
  try {
    const cached = await readCacheRow<EconomicCalendarSnapshot>(ECONOMIC_CALENDAR_CACHE_KEY);
    if (!cached?.payload?.items?.length) return null;
    const events = pickHighImpactEvents(cached.payload.items, now);
    return events.length ? { events, updatedAt: cached.payload.updatedAt } : null;
  } catch {
    return null;
  }
}

/** The stored brief, only if it is recent enough not to mislead (3 days). */
export async function getLatestBriefPreview(now = new Date()): Promise<DailyMarketBrief | null> {
  try {
    const cached = await readCacheRow<DailyMarketBrief>(DAILY_MARKET_BRIEF_CACHE_KEY);
    const brief = cached?.payload;
    if (!brief?.gold || !brief.eurusd) return null;
    const generated = Date.parse(brief.generatedAt);
    if (!Number.isFinite(generated) || now.getTime() - generated > 3 * DAY_MS) return null;
    return brief;
  } catch {
    return null;
  }
}
