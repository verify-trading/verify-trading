/** Economic calendar row for the Markets tab. */

export type EconomicCalendarImpact = "low" | "medium" | "high";

export type EconomicEventItem = {
  id: string;
  /** ISO 8601 instant for sorting / future timezone work */
  timeUtc: string;
  /** Short label for the row, e.g. "08:30 UTC" */
  timeLabel: string;
  currency: string;
  event: string;
  impact: EconomicCalendarImpact;
  forecast: string | null;
  previous: string | null;
  actual?: string | null;
};

export type EconomicCalendarSnapshot = {
  updatedAt: string;
  /** Heading label, e.g. "Today — Apr 14, 2026" */
  dayLabel: string;
  items: EconomicEventItem[];
};
