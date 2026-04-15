import { createHash } from "node:crypto";

import type {
  EconomicCalendarImpact,
  EconomicCalendarSnapshot,
  EconomicEventItem,
} from "@/lib/markets/economic-calendar";

import { fetchFmpJson } from "./fmp-json";

const CALENDAR_REVALIDATE_SECONDS = 2_700;

function utcYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfUtcDay(d: Date): Date {
  const copy = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
  return copy;
}

function endOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

function formatDayLabel(d: Date): string {
  const formatted = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
  return `Today — ${formatted}`;
}

function formatTimeLabel(d: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).format(d);
}

function pickString(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = row[key];
    if (typeof v === "string" && v.trim().length > 0) {
      return v.trim();
    }
    if (typeof v === "number" && Number.isFinite(v)) {
      return String(v);
    }
  }
  return "";
}

function formatMaybeNumberish(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function parseImpact(raw: unknown): EconomicCalendarImpact {
  const s = String(raw ?? "").toLowerCase();
  if (s.includes("high") || s === "3") {
    return "high";
  }
  if (s.includes("low") || s === "1") {
    return "low";
  }
  return "medium";
}

function parseDateTimeString(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  let normalized = trimmed.replace(/\s+(UTC|GMT)$/i, "Z");
  if (/^\d{4}-\d{2}-\d{2}\s/.test(normalized)) {
    normalized = normalized.replace(" ", "T");
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{1,2}:\d{2}(:\d{2})?$/i.test(normalized)) {
    normalized = `${normalized}Z`;
  }

  const ms = Date.parse(normalized);
  return Number.isFinite(ms) ? new Date(ms) : null;
}

function parseDateWithTime(datePart: string, timePart: string): Date | null {
  const direct = parseDateTimeString(`${datePart} ${timePart}`);
  if (direct) {
    return direct;
  }

  const strippedTime = timePart.replace(/\s+(UTC|GMT)$/i, "").trim();
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(strippedTime)) {
    const withSeconds = strippedTime.length === 5 ? `${strippedTime}:00` : strippedTime;
    return parseDateTimeString(`${datePart}T${withSeconds}`);
  }

  return null;
}

function parseEventInstantUtc(row: Record<string, unknown>): { timeUtc: string; timeLabel: string } | null {
  const datePart = pickString(row, ["date", "releaseDate", "eventDate", "day"]);
  const timePart = pickString(row, ["time", "releaseTime"]);

  if (!datePart) {
    return null;
  }

  if (/\d{4}-\d{2}-\d{2}/.test(datePart) && /[T\s]\d{1,2}:\d{2}/.test(datePart)) {
    const instant = parseDateTimeString(datePart);
    if (instant) {
      return {
        timeUtc: instant.toISOString(),
        timeLabel: formatTimeLabel(instant),
      };
    }
  }

  const isoDate = /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : null;
  if (!isoDate) {
    return null;
  }

  let instant = parseDateTimeString(`${isoDate}T12:00:00`);
  if (timePart && /\d/.test(timePart)) {
    const parsed = parseDateWithTime(isoDate, timePart);
    if (parsed) {
      instant = parsed;
    }
  }

  if (!instant) {
    return null;
  }

  return { timeUtc: instant.toISOString(), timeLabel: formatTimeLabel(instant) };
}

function stableEventId(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 24);
}

function mapCalendarRow(row: Record<string, unknown>): EconomicEventItem | null {
  const parsed = parseEventInstantUtc(row);
  if (!parsed) {
    return null;
  }

  const event = pickString(row, ["event", "name", "title"]);
  if (!event) {
    return null;
  }

  const currency = pickString(row, ["currency", "country", "symbol"]) || "—";
  const forecast =
    formatMaybeNumberish(row.estimate) ??
    formatMaybeNumberish(row.forecast) ??
    formatMaybeNumberish(row.consensus);
  const previous = formatMaybeNumberish(row.previous);
  const actual = formatMaybeNumberish(row.actual);

  const impact = parseImpact(row.impact ?? row.importance ?? row.impactLevel);

  const id = stableEventId([parsed.timeUtc, currency, event]);

  return {
    id,
    timeUtc: parsed.timeUtc,
    timeLabel: parsed.timeLabel,
    currency,
    event,
    impact,
    forecast,
    previous,
    ...(actual !== null ? { actual } : {}),
  };
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is Record<string, unknown> => item !== null && typeof item === "object");
}

/** Loads economic calendar rows for the current UTC day. */
export async function getEconomicCalendarSnapshot(now: Date = new Date()): Promise<EconomicCalendarSnapshot> {
  const todayStart = startOfUtcDay(now);
  const todayEnd = endOfUtcDay(todayStart);

  const from = utcYmd(todayStart);
  const to = utcYmd(todayEnd);

  const raw = await fetchFmpJson(
    "stable/economic-calendar",
    {
      from,
      to,
    },
    CALENDAR_REVALIDATE_SECONDS,
  );

  const rows = asRecordArray(raw)
    .map(mapCalendarRow)
    .filter((item): item is EconomicEventItem => item !== null);

  const filtered = rows.filter((item) => {
    const ms = Date.parse(item.timeUtc);
    if (!Number.isFinite(ms)) {
      return false;
    }
    return ms >= todayStart.getTime() && ms <= todayEnd.getTime();
  });

  filtered.sort((a, b) => a.timeUtc.localeCompare(b.timeUtc));

  return {
    updatedAt: new Date().toISOString(),
    dayLabel: formatDayLabel(todayStart),
    items: filtered,
  };
}
