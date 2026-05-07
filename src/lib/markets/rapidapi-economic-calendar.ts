import type {
  EconomicCalendarCountry,
  EconomicCalendarImpact,
  EconomicCalendarSnapshot,
  EconomicEventItem,
} from "@/lib/markets/economic-calendar";
import { ECONOMIC_CALENDAR_COUNTRIES } from "@/lib/markets/economic-calendar";

export const ECONOMIC_CALENDAR_CACHE_KEY = "events:economic:week";
export const ECONOMIC_CALENDAR_REFRESH_MS = 2 * 60 * 60 * 1000;

type RawEconomicEvent = {
  id?: unknown;
  date?: unknown;
  country?: unknown;
  currency?: unknown;
  title?: unknown;
  indicator?: unknown;
  importance?: unknown;
  actual?: unknown;
  forecast?: unknown;
  previous?: unknown;
  unit?: unknown;
  scale?: unknown;
  source?: unknown;
  period?: unknown;
};

type EconomicCalendarWindow = {
  from: string;
  to: string;
};

const API_HOST = "ultimate-economic-calendar.p.rapidapi.com";
const API_URL = `https://${API_HOST}/economic-events/tradingview`;

function formatDateUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getEconomicCalendarWindow(now = new Date()): EconomicCalendarWindow {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    from: formatDateUtc(start),
    to: formatDateUtc(end),
  };
}

export function shouldRefreshEconomicCalendar(
  fetchedAt: string | null | undefined,
  cachedWindowFrom?: string | null,
  now = new Date(),
): boolean {
  if (!fetchedAt) {
    return true;
  }
  const fetchedAtMs = new Date(fetchedAt).getTime();
  if (!Number.isFinite(fetchedAtMs) || Date.now() - fetchedAtMs >= ECONOMIC_CALENDAR_REFRESH_MS) {
    return true;
  }
  return cachedWindowFrom !== undefined && cachedWindowFrom !== getEconomicCalendarWindow(now).from;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function mapImpact(value: unknown): EconomicCalendarImpact {
  if (value === 1) {
    return "high";
  }
  if (value === 0) {
    return "medium";
  }
  return "low";
}

function normalizeCurrency(country: string, currency: string): string {
  if (country === "DE" && currency === "DEM") {
    return "EUR";
  }
  return currency || country;
}

function formatValue(value: unknown, scale: string, unit: string): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const rendered = String(value);
  if (unit === "%") {
    return `${rendered}%`;
  }
  if (scale && unit) {
    return `${rendered}${scale} ${unit}`;
  }
  if (scale) {
    return `${rendered}${scale}`;
  }
  if (unit) {
    return `${rendered} ${unit}`;
  }
  return rendered;
}

function formatTimeLabel(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) {
    return "— UTC";
  }
  return `${date.toISOString().slice(11, 16)} UTC`;
}

function mapEvent(row: RawEconomicEvent): EconomicEventItem | null {
  const timeUtc = asString(row.date);
  const title = asString(row.title) || asString(row.indicator);
  const country = asString(row.country);
  const currency = normalizeCurrency(country, asString(row.currency));

  if (!timeUtc || !title || !country || !currency) {
    return null;
  }

  const scale = asString(row.scale);
  const unit = asString(row.unit);
  const id = asString(row.id) || `${country}:${timeUtc}:${title}`;

  return {
    id,
    timeUtc,
    timeLabel: formatTimeLabel(timeUtc),
    country,
    currency,
    event: title.replace(/\s+\*/g, "").trim(),
    impact: mapImpact(row.importance),
    actual: formatValue(row.actual, scale, unit),
    forecast: formatValue(row.forecast, scale, unit),
    previous: formatValue(row.previous, scale, unit),
    source: asString(row.source) || null,
    period: asString(row.period) || null,
  };
}

function mergeWithPreviousCountryEvents(
  nextItems: EconomicEventItem[],
  previousItems: EconomicEventItem[],
  failedCountries: Set<string>,
  window: EconomicCalendarWindow,
): EconomicEventItem[] {
  if (failedCountries.size === 0) {
    return nextItems;
  }

  const retained = previousItems.filter((item) => {
    const eventDate = item.timeUtc.slice(0, 10);
    return failedCountries.has(item.country) && eventDate >= window.from && eventDate <= window.to;
  });
  return [...nextItems, ...retained];
}

function dedupeAndSort(items: EconomicEventItem[]): EconomicEventItem[] {
  const seen = new Set<string>();
  const deduped: EconomicEventItem[] = [];

  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    deduped.push(item);
  }

  return deduped.sort((a, b) => a.timeUtc.localeCompare(b.timeUtc));
}

async function fetchCountryEvents(
  country: EconomicCalendarCountry,
  window: EconomicCalendarWindow,
): Promise<EconomicEventItem[]> {
  const apiKey = process.env.ULTIMATE_ECONOMIC_CALENDAR_API_KEY;
  if (!apiKey) {
    throw new Error("ULTIMATE_ECONOMIC_CALENDAR_API_KEY is not set");
  }

  const params = new URLSearchParams({
    from: window.from,
    to: window.to,
    countries: country,
  });
  const response = await fetch(`${API_URL}?${params.toString()}`, {
    headers: {
      "Content-Type": "application/json",
      "x-rapidapi-host": API_HOST,
      "x-rapidapi-key": apiKey,
    },
    cache: "no-store",
  });
  const json = (await response.json()) as { result?: unknown; message?: unknown };
  if (!response.ok) {
    const message = typeof json.message === "string" ? json.message : `Economic calendar failed with ${response.status}`;
    throw new Error(message);
  }

  const rawRows = Array.isArray(json.result) ? json.result : [];
  return rawRows
    .filter((row): row is RawEconomicEvent => row !== null && typeof row === "object")
    .map(mapEvent)
    .filter((item): item is EconomicEventItem => item !== null);
}

export async function getEconomicCalendarWeekSnapshot(
  previous: EconomicCalendarSnapshot | null,
  now = new Date(),
): Promise<EconomicCalendarSnapshot> {
  const window = getEconomicCalendarWindow(now);
  const settled = await Promise.allSettled(
    ECONOMIC_CALENDAR_COUNTRIES.map(async (country) => ({
      country,
      items: await fetchCountryEvents(country, window),
    })),
  );

  const failedCountries = new Set<string>();
  const nextItems: EconomicEventItem[] = [];

  settled.forEach((result, index) => {
    const country = ECONOMIC_CALENDAR_COUNTRIES[index]!;
    if (result.status === "fulfilled") {
      nextItems.push(...result.value.items);
      return;
    }
    failedCountries.add(country);
  });

  if (nextItems.length === 0 && !previous?.items.length) {
    throw new Error("Economic calendar is temporarily unavailable.");
  }

  const items = dedupeAndSort(
    mergeWithPreviousCountryEvents(nextItems, previous?.items ?? [], failedCountries, window),
  );

  return {
    updatedAt: new Date().toISOString(),
    from: window.from,
    to: window.to,
    countries: [...ECONOMIC_CALENDAR_COUNTRIES],
    dayLabel: `This week — ${window.from} to ${window.to}`,
    items,
  };
}
