import { useMemo, useSyncExternalStore } from "react";

/** Server render and first paint use this day; the client swaps in the visitor's real day after mount. */
const FALLBACK_DAY = "2026-09-29";

const noopSubscribe = () => () => {};
const localDayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Today (local midnight) for the sample data in the Pro mocks, so dates never go stale.
 * useSyncExternalStore gives the server snapshot during hydration, so there is no mismatch.
 */
export function useDemoToday(): Date {
  const key = useSyncExternalStore(noopSubscribe, localDayKey, () => FALLBACK_DAY);
  return useMemo(() => {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d);
  }, [key]);
}

export const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

const MONTH_SHORT = new Intl.DateTimeFormat("en-US", { month: "short" });
const DAY_ONLY = new Intl.DateTimeFormat("en-GB", { day: "numeric" });
const WEEKDAY_SHORT = new Intl.DateTimeFormat("en-GB", { weekday: "short" });
const MONTH_YEAR = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });

export const monthDay = (d: Date) => `${d.getDate()} ${MONTH_SHORT.format(d)}`;
export const weekdayShort = (d: Date) => WEEKDAY_SHORT.format(d);
export const monthYear = (d: Date) => MONTH_YEAR.format(d);

/** "29 Sep – 5 Oct", or "22 – 28 Sep" inside one month. */
export function weekRange(start: Date, end: Date) {
  return `${monthDay(start)} – ${start.getMonth() === end.getMonth() ? DAY_ONLY.format(end) : monthDay(end)}`;
}

/** Sample session P&L in GBP for a day: none on weekends or future days, otherwise a stable pattern. */
const PNL = [412, -78, 663, 192, -215, 825, 340, -122, 518, 96, -64, 731, 275, -190, 604];
export function samplePnl(date: Date, today: Date): number | null {
  const dow = date.getDay();
  if (dow === 0 || dow === 6 || date > today) return null;
  return PNL[date.getDate() % PNL.length];
}

/** "+£663" / "-£78" — compact figure used in the journal cells. */
export const pnlLabel = (n: number) => `${n >= 0 ? "+" : "-"}£${Math.abs(n)}`;
