/** Economic calendar row for the Markets tab. */

export type EconomicCalendarImpact = "low" | "medium" | "high";

export const ECONOMIC_CALENDAR_COUNTRIES = ["US", "DE", "GB", "CA", "JP", "AU", "NZ", "CN"] as const;

export type EconomicCalendarCountry = (typeof ECONOMIC_CALENDAR_COUNTRIES)[number];

export const ECONOMIC_CALENDAR_COUNTRY_LABELS: Record<EconomicCalendarCountry, string> = {
  US: "United States",
  DE: "Germany",
  GB: "United Kingdom",
  CA: "Canada",
  JP: "Japan",
  AU: "Australia",
  NZ: "New Zealand",
  CN: "China",
};

export type EconomicEventItem = {
  id: string;
  /** ISO 8601 instant for sorting / future timezone work */
  timeUtc: string;
  /** Short label for the row, e.g. "08:30 UTC" */
  timeLabel: string;
  country: string;
  currency: string;
  event: string;
  impact: EconomicCalendarImpact;
  forecast: string | null;
  previous: string | null;
  actual?: string | null;
  source?: string | null;
  period?: string | null;
};

export type EconomicCalendarSnapshot = {
  updatedAt: string;
  from?: string;
  to?: string;
  countries?: string[];
  /** Heading label, e.g. "Today — Apr 14, 2026" */
  dayLabel: string;
  items: EconomicEventItem[];
};
