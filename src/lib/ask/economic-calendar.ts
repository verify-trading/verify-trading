import { fetchWithRetry } from "@/lib/http/fetch-with-retry";

const FMP_ECONOMIC_CALENDAR_URL = "https://financialmodelingprep.com/stable/economic-calendar";
const DEFAULT_LOOKAHEAD_DAYS = 7;
const DEFAULT_LIMIT = 8;

export type EconomicCalendarImpact = "high" | "medium" | "low";

export type EconomicCalendarEvent = {
  date: string;
  time?: string;
  country: string;
  event: string;
  impact?: EconomicCalendarImpact;
  currency?: string;
  actual?: string;
  previous?: string;
  estimate?: string;
};

export type EconomicCalendarResult = {
  from: string;
  to: string;
  events: EconomicCalendarEvent[];
  note?: string;
  source: "FMP";
};

export type FetchEconomicCalendarOptions = {
  from?: string;
  to?: string;
  country?: string;
  importance?: EconomicCalendarImpact;
  limit?: number;
};

function formatDateForApi(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDateOnly(value: string | undefined): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? undefined : value;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function getEconomicCalendarWindow(
  options: Pick<FetchEconomicCalendarOptions, "from" | "to">,
): Pick<EconomicCalendarResult, "from" | "to"> {
  const from = parseDateOnly(options.from);
  const to = parseDateOnly(options.to);

  if (from && to) {
    return {
      from,
      to: to < from ? from : to,
    };
  }

  if (from) {
    return {
      from,
      to: formatDateForApi(addDays(new Date(`${from}T00:00:00Z`), DEFAULT_LOOKAHEAD_DAYS)),
    };
  }

  if (to) {
    return { from: to, to };
  }

  const today = formatDateForApi(new Date());
  return {
    from: today,
    to: formatDateForApi(addDays(new Date(`${today}T00:00:00Z`), DEFAULT_LOOKAHEAD_DAYS)),
  };
}

function getApiKey(): string | undefined {
  return process.env.FMP_API_KEY || process.env.FINANCIAL_MODELING_PREP_API_KEY;
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return undefined;
}

function normalizeImpact(value: unknown): EconomicCalendarImpact | undefined {
  if (typeof value === "number") {
    if (value >= 3) {
      return "high";
    }
    if (value >= 2) {
      return "medium";
    }
    if (value >= 1) {
      return "low";
    }
    return undefined;
  }

  const normalized = toOptionalString(value)?.toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (normalized.includes("high") || normalized === "3") {
    return "high";
  }
  if (normalized.includes("medium") || normalized.includes("med") || normalized === "2") {
    return "medium";
  }
  if (normalized.includes("low") || normalized === "1") {
    return "low";
  }

  return undefined;
}

function mapEconomicEvent(raw: Record<string, unknown>): EconomicCalendarEvent | null {
  const date = toOptionalString(raw.date) ?? toOptionalString(raw.datetime) ?? toOptionalString(raw.releaseDate);
  const event =
    toOptionalString(raw.event) ??
    toOptionalString(raw.title) ??
    toOptionalString(raw.name) ??
    toOptionalString(raw.indicator);

  if (!date || !event) {
    return null;
  }

  const country =
    toOptionalString(raw.country) ??
    toOptionalString(raw.region) ??
    toOptionalString(raw.countryLabel) ??
    "Unknown";

  return {
    date,
    time:
      toOptionalString(raw.time) ??
      toOptionalString(raw.releaseTime) ??
      toOptionalString(raw.hour),
    country,
    event,
    impact: normalizeImpact(raw.impact ?? raw.importance),
    currency: toOptionalString(raw.currency),
    actual: toOptionalString(raw.actual),
    previous: toOptionalString(raw.previous),
    estimate: toOptionalString(raw.estimate ?? raw.consensus ?? raw.forecast),
  };
}

function parseCalendarPayload(json: unknown): EconomicCalendarEvent[] {
  const rows =
    Array.isArray(json)
      ? json
      : json && typeof json === "object" && Array.isArray((json as { data?: unknown }).data)
        ? (json as { data: unknown[] }).data
        : [];

  return rows
    .filter((row): row is Record<string, unknown> => !!row && typeof row === "object")
    .map(mapEconomicEvent)
    .filter((event): event is EconomicCalendarEvent => event !== null)
    .sort((left, right) => `${left.date} ${left.time ?? ""}`.localeCompare(`${right.date} ${right.time ?? ""}`));
}

function countryMatches(eventCountry: string, filter: string): boolean {
  const normalizedCountry = eventCountry.toLowerCase().trim();
  const normalizedFilter = filter.toLowerCase().trim();

  if (!normalizedFilter) {
    return true;
  }

  const aliases =
    normalizedFilter === "us" || normalizedFilter === "usa"
      ? ["us", "usa", "united states", "united states of america"]
      : normalizedFilter === "uk"
        ? ["uk", "united kingdom", "great britain", "britain"]
        : normalizedFilter === "eu"
          ? ["eu", "eurozone", "euro area", "european union"]
          : [normalizedFilter];

  return aliases.some(
    (alias) => normalizedCountry.includes(alias) || alias.includes(normalizedCountry),
  );
}

function filterCalendarEvents(
  events: EconomicCalendarEvent[],
  options: FetchEconomicCalendarOptions,
): EconomicCalendarEvent[] {
  return events.filter((event) => {
    if (options.country && !countryMatches(event.country, options.country)) {
      return false;
    }

    if (options.importance && event.impact !== options.importance) {
      return false;
    }

    return true;
  });
}

async function fetchCalendarUrl(url: URL): Promise<EconomicCalendarEvent[]> {
  const response = await fetchWithRetry(
    url,
    { method: "GET", next: { revalidate: 300 } },
    { attempts: 2, baseDelayMs: 400 },
  );

  const text = await response.text();
  const json = text ? (JSON.parse(text) as unknown) : [];

  if (!response.ok) {
    const message =
      json && typeof json === "object" && typeof (json as { message?: unknown }).message === "string"
        ? (json as { message: string }).message
        : `FMP economic calendar request failed with ${response.status}.`;

    if (response.status === 401 || response.status === 403) {
      throw new Error(`FMP economic calendar: invalid or missing API key. ${message}`);
    }

    if (response.status === 429) {
      throw new Error(`FMP economic calendar: rate limited. ${message}`);
    }

    throw new Error(message);
  }

  return parseCalendarPayload(json);
}

export async function fetchEconomicCalendar(
  options: FetchEconomicCalendarOptions = {},
): Promise<EconomicCalendarResult> {
  const { from, to } = getEconomicCalendarWindow(options);
  const apiKey = getApiKey();

  if (!apiKey) {
    return {
      from,
      to,
      events: [],
      note: "Economic calendar is not configured on the server.",
      source: "FMP",
    };
  }

  const url = new URL(FMP_ECONOMIC_CALENDAR_URL);
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("from", from);
  url.searchParams.set("to", to);

  const limitedEvents = filterCalendarEvents(await fetchCalendarUrl(url), options).slice(
    0,
    Math.min(20, Math.max(1, options.limit ?? DEFAULT_LIMIT)),
  );

  return {
    from,
    to,
    events: limitedEvents,
    ...(limitedEvents.length === 0 ? { note: "No scheduled economic events matched that filter." } : {}),
    source: "FMP",
  };
}
