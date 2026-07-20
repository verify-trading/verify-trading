import type {
  EconomicCalendarImpact,
  EconomicCalendarSnapshot,
  EconomicEventItem,
} from "@/lib/markets/economic-calendar";
import { ECONOMIC_CALENDAR_COUNTRIES } from "@/lib/markets/economic-calendar";
import { fetchWithRetry } from "@/lib/http/fetch-with-retry";

export const ECONOMIC_CALENDAR_CACHE_KEY = "events:economic:week";
// forex-api2's BASIC plan allows only 50 requests/month, so refresh at most
// once a day (~30/month). The UTC day-rollover check below still forces a daily
// refresh to advance the rolling window, which keeps actuals reasonably fresh.
export const ECONOMIC_CALENDAR_REFRESH_MS = 24 * 60 * 60 * 1000;

/** forex-api2 (RapidAPI) economic calendar event, as returned under `data`. */
type RawEconomicEvent = {
  id?: unknown;
  dateUtc?: unknown;
  countryCode?: unknown;
  currencyCode?: unknown;
  name?: unknown;
  actual?: unknown;
  consensus?: unknown;
  previous?: unknown;
  revised?: unknown;
  volatility?: unknown;
};

type ForexApiCalendarResponse = {
  data?: unknown;
  errors?: Array<{ message?: unknown }>;
  hasError?: unknown;
};

type EconomicCalendarWindow = {
  from: string;
  to: string;
};

const API_HOST = "forex-api2.p.rapidapi.com";
const API_URL = `https://${API_HOST}/v2/calendar/get`;
const CACHE_LOOKBACK_DAYS = 1;
const CACHE_LOOKAHEAD_DAYS = 8;
/** Every volatility bucket the Markets calendar renders. */
const INCLUDE_VOLATILITIES = "none;low;medium;high";

/**
 * forex-api2 codes countries as lowercase ISO alpha-2 on the request and
 * uppercase on the response, except the United Kingdom which it codes as
 * `uk`/`UK` rather than `gb`/`GB`. Translate between the app's country codes
 * and the provider's on the way out and back.
 */
const APP_TO_API_COUNTRY: Record<string, string> = {
  US: "us",
  DE: "de",
  GB: "uk",
  CA: "ca",
  JP: "jp",
  AU: "au",
  NZ: "nz",
  CN: "cn",
};
const API_TO_APP_COUNTRY: Record<string, string> = {
  UK: "GB",
};

function formatDateUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getEconomicCalendarWindow(now = new Date()): EconomicCalendarWindow {
  const utcToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(utcToday.getTime() - CACHE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const end = new Date(utcToday.getTime() + CACHE_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);
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

function toNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function mapImpact(volatility: unknown): EconomicCalendarImpact {
  switch (asString(volatility).toUpperCase()) {
    case "HIGH":
      return "high";
    case "MEDIUM":
      return "medium";
    default:
      // LOW and NONE both render as low-impact rows.
      return "low";
  }
}

function mapCountry(apiCountry: string): string {
  return API_TO_APP_COUNTRY[apiCountry] ?? apiCountry;
}

function formatTimeLabel(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) {
    return "— UTC";
  }
  return `${date.toISOString().slice(11, 16)} UTC`;
}

function mapEvent(row: RawEconomicEvent): EconomicEventItem | null {
  const timeUtc = asString(row.dateUtc);
  const title = asString(row.name);
  const country = mapCountry(asString(row.countryCode).toUpperCase());
  const currency = asString(row.currencyCode) || country;

  if (!timeUtc || !title || !country) {
    return null;
  }

  // forex-api2 has no null: an unreleased actual, a data-less row (speech,
  // holiday) and an absent forecast/previous all report as 0. Render 0 as a
  // blank so upcoming rows don't show a misleading "0"; the trade-off is that a
  // genuine 0 reading is also blanked, which is rarer and more honest than
  // asserting a value that isn't there.
  const render = (value: unknown): string | null => {
    const numeric = toNumber(value);
    return numeric !== null && numeric !== 0 ? String(numeric) : null;
  };

  const id = asString(row.id) || `${country}:${timeUtc}:${title}`;

  return {
    id,
    timeUtc,
    timeLabel: formatTimeLabel(timeUtc),
    country,
    currency,
    event: title,
    impact: mapImpact(row.volatility),
    actual: render(row.actual),
    forecast: render(row.consensus),
    previous: render(row.previous),
    source: null,
    period: null,
  };
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

async function fetchCalendarEvents(window: EconomicCalendarWindow): Promise<EconomicEventItem[]> {
  const apiKey = process.env.RAPIDAPI_KEY ?? process.env.ULTIMATE_ECONOMIC_CALENDAR_API_KEY;
  if (!apiKey) {
    throw new Error("RAPIDAPI_KEY is not set");
  }

  const includeCountries = ECONOMIC_CALENDAR_COUNTRIES.map((country) => APP_TO_API_COUNTRY[country])
    .filter(Boolean)
    .join(";");
  const params = new URLSearchParams({
    startDate: window.from,
    endDate: window.to,
    includeVolatilities: INCLUDE_VOLATILITIES,
    includeCountries,
  });
  const response = await fetchWithRetry(`${API_URL}?${params.toString()}`, {
    headers: {
      "x-rapidapi-host": API_HOST,
      "x-rapidapi-key": apiKey,
    },
    cache: "no-store",
  });
  const json = (await response.json()) as ForexApiCalendarResponse;
  if (!response.ok || json.hasError === true) {
    const message = asString(json.errors?.[0]?.message) || `Economic calendar failed with ${response.status}`;
    throw new Error(message);
  }

  const rawRows = Array.isArray(json.data) ? json.data : [];
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
  const items = dedupeAndSort(await fetchCalendarEvents(window));

  if (items.length === 0 && !previous?.items.length) {
    throw new Error("Economic calendar is temporarily unavailable.");
  }

  return {
    updatedAt: new Date().toISOString(),
    from: window.from,
    to: window.to,
    countries: [...ECONOMIC_CALENDAR_COUNTRIES],
    dayLabel: "Upcoming events",
    items,
  };
}
