import { z } from "zod";

import { normalizeEntityText } from "@/lib/ask/entities";
import type { EconomicCalendarSnapshot, EconomicEventItem } from "@/lib/markets/economic-calendar";
import { ECONOMIC_CALENDAR_CACHE_KEY } from "@/lib/markets/rapidapi-economic-calendar";
import { readCacheRow } from "@/lib/markets/twelve-data-adapter";

/** The get_economic_calendar tool: its input schema and the cached-calendar filter behind it. */
export const economicCalendarInputSchema = z.object({
  scope: z
    .enum(["today", "tomorrow", "week", "upcoming", "all"])
    .default("upcoming")
    .describe(
      "Calendar window to inspect. Use today for today's releases, upcoming for the next unreleased events, week for the cached weekly window.",
    ),
  impact: z
    .enum(["all", "high", "medium", "low"])
    .default("all")
    .describe("Filter by expected market impact. Use high for major events such as CPI, NFP, central-bank decisions, and rate decisions."),
  currency: z
    .string()
    .min(1)
    .max(8)
    .optional()
    .describe("Optional currency code such as USD, GBP, EUR, JPY, CAD, AUD, NZD, or CNY."),
  country: z
    .string()
    .min(2)
    .max(3)
    .optional()
    .describe("Optional country code such as US, GB, DE, JP, CA, AU, NZ, or CN."),
  query: z
    .string()
    .min(1)
    .optional()
    .describe("Optional event search term, e.g. CPI, NFP, Fed, unemployment, PMI, GDP, retail sales."),
  limit: z.number().int().min(1).max(12).default(8).describe("Maximum events to return."),
});

const MAX_CALENDAR_TOOL_EVENTS = 12;

export async function getCachedEconomicCalendarSnapshot() {
  const cached = await readCacheRow<EconomicCalendarSnapshot>(ECONOMIC_CALENDAR_CACHE_KEY);
  return cached?.payload ?? null;
}

function getDateKeyUtc(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date: Date, days: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

const CALENDAR_QUERY_ALIASES: Record<string, string[]> = {
  cpi: ["cpi", "consumer price index", "inflation"],
  nfp: ["nfp", "nonfarm payroll", "non farm payroll", "payroll"],
  fed: ["fed", "fomc", "federal reserve", "rate decision"],
  boe: ["boe", "bank of england", "rate decision"],
  ecb: ["ecb", "european central bank", "rate decision"],
  pmi: ["pmi", "purchasing managers"],
  gdp: ["gdp", "gross domestic product"],
};

function eventMatchesQuery(item: EconomicEventItem, query: string | undefined) {
  if (!query) {
    return true;
  }

  const normalizedQuery = normalizeEntityText(query);
  if (!normalizedQuery) {
    return true;
  }

  const expandedTerms = CALENDAR_QUERY_ALIASES[normalizedQuery] ?? [normalizedQuery];
  const haystack = normalizeEntityText(
    [item.event, item.currency, item.country, item.period ?? "", item.source ?? ""].join(" "),
  );

  return expandedTerms.some((term) => haystack.includes(term));
}

function eventMatchesScope(item: EconomicEventItem, scope: z.infer<typeof economicCalendarInputSchema>["scope"], now: Date) {
  if (scope === "all" || scope === "week") {
    return true;
  }

  const eventDate = item.timeUtc.slice(0, 10);
  if (scope === "today") {
    return eventDate === getDateKeyUtc(now);
  }
  if (scope === "tomorrow") {
    return eventDate === getDateKeyUtc(addUtcDays(now, 1));
  }

  const eventMs = new Date(item.timeUtc).getTime();
  return Number.isFinite(eventMs) && eventMs >= now.getTime();
}

function formatTimeUntil(timeUtc: string, now: Date) {
  const eventMs = new Date(timeUtc).getTime();
  if (!Number.isFinite(eventMs)) {
    return null;
  }
  const diffMs = eventMs - now.getTime();
  if (diffMs <= 0) {
    return "released";
  }
  const totalMinutes = Math.max(0, Math.floor(diffMs / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) {
    return `${minutes}m`;
  }
  return `${hours}h ${minutes}m`;
}

function serializeCalendarEvent(item: EconomicEventItem, now: Date) {
  return {
    event: item.event,
    timeUtc: item.timeUtc,
    timeLabel: item.timeLabel,
    timeUntil: formatTimeUntil(item.timeUtc, now),
    country: item.country,
    currency: item.currency,
    impact: item.impact,
    actual: item.actual ?? null,
    forecast: item.forecast ?? null,
    previous: item.previous ?? null,
    status: item.actual ? "released" : "scheduled",
    period: item.period ?? null,
    source: item.source ?? null,
  };
}

function findNextHighImpactEvent(items: EconomicEventItem[], now: Date) {
  const nowMs = now.getTime();
  let nextEvent: EconomicEventItem | null = null;
  let nextMs = Number.POSITIVE_INFINITY;
  for (const item of items) {
    if (item.impact !== "high") {
      continue;
    }
    const eventMs = new Date(item.timeUtc).getTime();
    if (Number.isFinite(eventMs) && eventMs >= nowMs && eventMs < nextMs) {
      nextEvent = item;
      nextMs = eventMs;
    }
  }
  return nextEvent;
}


export function buildEconomicCalendarToolResult(
  snapshot: EconomicCalendarSnapshot | null,
  input: z.infer<typeof economicCalendarInputSchema>,
) {
  const now = new Date();
  if (!snapshot?.items?.length) {
    return {
      updatedAt: snapshot?.updatedAt ?? null,
      now: now.toISOString(),
      from: snapshot?.from ?? null,
      to: snapshot?.to ?? null,
      filters: input,
      nextHighImpactEvent: null,
      events: [],
      totalMatched: 0,
      note: "Economic calendar cache is empty. Ask the trader to refresh the Markets calendar after the cron warms the cache.",
    };
  }

  const impact = input.impact ?? "all";
  const currency = input.currency?.trim().toUpperCase();
  const country = input.country?.trim().toUpperCase();
  const scope = input.scope ?? "upcoming";
  const limit = Math.min(input.limit ?? 8, MAX_CALENDAR_TOOL_EVENTS);
  const sorted = snapshot.items.toSorted((a, b) => a.timeUtc.localeCompare(b.timeUtc));
  const nextHighImpactEvent = findNextHighImpactEvent(sorted, now);
  const events = sorted.filter((item) => {
    if (!eventMatchesScope(item, scope, now)) {
      return false;
    }
    if (impact !== "all" && item.impact !== impact) {
      return false;
    }
    if (currency && item.currency.toUpperCase() !== currency) {
      return false;
    }
    if (country && item.country.toUpperCase() !== country) {
      return false;
    }
    return eventMatchesQuery(item, input.query);
  });

  return {
    updatedAt: snapshot.updatedAt,
    now: now.toISOString(),
    from: snapshot.from ?? null,
    to: snapshot.to ?? null,
    filters: {
      scope,
      impact,
      currency: currency ?? null,
      country: country ?? null,
      query: input.query ?? null,
      limit,
    },
    nextHighImpactEvent: nextHighImpactEvent ? serializeCalendarEvent(nextHighImpactEvent, now) : null,
    events: events.slice(0, limit).map((item) => serializeCalendarEvent(item, now)),
    totalMatched: events.length,
    note:
      events.length > 0
        ? "Use forecast, previous, actual, impact, and timing to explain trade risk. Do not invent missing actual values."
        : "No matching events found in the cached calendar window.",
  };
}
