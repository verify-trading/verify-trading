"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

import {
  ECONOMIC_CALENDAR_COUNTRIES,
  ECONOMIC_CALENDAR_COUNTRY_LABELS,
  type EconomicCalendarCountry,
  type EconomicCalendarSnapshot,
} from "@/lib/markets/economic-calendar";

type FilterOption = {
  label: string;
  value: string;
};

const IMPACT_FILTER_OPTIONS = [
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
] as const;

type SelectedImpact = (typeof IMPACT_FILTER_OPTIONS)[number]["value"];
type ImpactFilter = "all" | SelectedImpact[];

type DayGroup = {
  key: string;
  label: string;
  items: NonNullable<EconomicCalendarSnapshot["items"]>;
};

const LONG_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

function countryOptionLabel(country: EconomicCalendarCountry): string {
  return `${ECONOMIC_CALENDAR_COUNTRY_LABELS[country]} (${country})`;
}

function isSupportedEventCountry(country: string): country is EconomicCalendarCountry {
  return (ECONOMIC_CALENDAR_COUNTRIES as readonly string[]).includes(country);
}

function getBrowserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function subscribeToTimeZone() {
  return () => {};
}

function useEventTimeZone(timeZone: string | undefined): string {
  const browserTimeZone = useSyncExternalStore(subscribeToTimeZone, getBrowserTimeZone, () => "UTC");
  return timeZone ?? browserTimeZone;
}

function getDateKey(timeUtc: string, timeZone: string): string {
  const date = new Date(timeUtc);
  if (!Number.isFinite(date.getTime())) return timeUtc.slice(0, 10);
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
    const y = part("year"), m = part("month"), d = part("day");
    return y && m && d ? `${y}-${m}-${d}` : date.toISOString().slice(0, 10);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function formatDateLabel(dateKey: string, formatter: Intl.DateTimeFormat): string {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) return dateKey;
  return formatter.format(date);
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return dateKey;
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function getLocalDateWindow(timeZone: string, now: Date): { startKey: string; endKey: string } {
  const startKey = getDateKey(now.toISOString(), timeZone);
  return { startKey, endKey: addDaysToDateKey(startKey, 6) };
}

function isDateKeyInWindow(dateKey: string, window: { startKey: string; endKey: string }): boolean {
  return dateKey >= window.startKey && dateKey <= window.endKey;
}

function formatEventTimeLabel(timeUtc: string, timeZone: string, fallback: string): string {
  const date = new Date(timeUtc);
  if (!Number.isFinite(date.getTime())) return fallback;
  try {
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    const time = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);

    if (isToday) return `${time} today`;
    if (isTomorrow) return `${time} tomorrow`;
    return `${time} on ${new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric" }).format(date)}`;
  } catch {
    return fallback;
  }
}

function formatCountdown(timeUtc: string, now: Date): string | null {
  const eventMs = new Date(timeUtc).getTime();
  if (!Number.isFinite(eventMs)) return null;
  const diffMs = eventMs - now.getTime();
  if (diffMs <= 0) return "now";
  const totalMinutes = Math.max(0, Math.floor(diffMs / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function findNextHighImpactEvent(
  items: NonNullable<EconomicCalendarSnapshot["items"]>,
  now: Date,
) {
  return items
    .filter((item) => item.impact === "high")
    .filter((item) => {
      const eventMs = new Date(item.timeUtc).getTime();
      return Number.isFinite(eventMs) && eventMs >= now.getTime();
    })
    .sort((a, b) => a.timeUtc.localeCompare(b.timeUtc))[0] ?? null;
}

function impactDotStyle(impact: string): { backgroundColor: string } {
  if (impact === "high") return { backgroundColor: "#EF4444" };
  if (impact === "medium") return { backgroundColor: "#F59E0B" };
  return { backgroundColor: "#9CA3AF" };
}

function impactLabel(impact: string): string {
  if (impact === "high") return "High";
  if (impact === "medium") return "Med";
  return "Low";
}

function impactColor(impact: string): string {
  if (impact === "high") return "text-rose-400";
  if (impact === "medium") return "text-amber-400";
  return "text-gray-400";
}

function orderedImpacts(impacts: readonly SelectedImpact[]): SelectedImpact[] {
  return IMPACT_FILTER_OPTIONS.map((o) => o.value).filter((v) => impacts.includes(v));
}

function impactMatchesFilter(filter: ImpactFilter, impact: string): boolean {
  if (filter === "all") return true;
  return filter.some((s) => s === impact);
}

function nextImpactFilter(filter: ImpactFilter, impact: SelectedImpact): ImpactFilter {
  const current = filter === "all" ? [] : filter;
  const next = current.includes(impact)
    ? current.filter((s) => s !== impact)
    : orderedImpacts([...current, impact]);
  return next.length > 0 ? next : "all";
}

function buildEventAskPrompt(
  item: NonNullable<EconomicCalendarSnapshot["items"]>[number],
  timeZone: string,
): string {
  const time = formatEventTimeLabel(item.timeUtc, timeZone, item.timeLabel);
  if (item.actual) {
    return `${item.event} came in at ${item.actual} vs estimate ${item.forecast ?? "not available"}. What does this mean for my trades right now?`;
  }
  return `${item.event} is at ${time}. Estimate: ${item.forecast ?? "not available"}. Previous: ${item.previous ?? "not available"}. What does this mean for my USD pairs and Gold?`;
}

/* ── Week day strip ────────────────────────────────────────────────────── */

function HighImpactCountdown({
  items,
  now,
  timeZone,
  onAskPrompt,
}: {
  items: NonNullable<EconomicCalendarSnapshot["items"]>;
  now: Date;
  timeZone: string;
  onAskPrompt?: (prompt: string) => void;
}) {
  const next = findNextHighImpactEvent(items, now);
  const countdown = next ? formatCountdown(next.timeUtc, now) : null;

  if (!next || !countdown) return null;

  const time = formatEventTimeLabel(next.timeUtc, timeZone, next.timeLabel);

  return (
    <button
      type="button"
      onClick={() => onAskPrompt?.(buildEventAskPrompt(next, timeZone))}
      className="mb-4 flex w-full flex-col gap-2 rounded-lg border border-rose-500/20 bg-rose-500/[0.06] p-3 text-left transition-colors hover:border-rose-500/30 hover:bg-rose-500/[0.09]"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-40" />
            <span className="relative inline-flex size-2 rounded-full bg-rose-500" />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wide text-rose-400/80">High Impact</span>
        </div>
        <span className="rounded bg-rose-500/20 px-2 py-1 text-xs font-bold tabular-nums text-rose-300">{countdown}</span>
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white">{next.event}</p>
        <p className="mt-0.5 truncate text-xs text-white/50">
          {next.country} · {next.currency} · {time}
        </p>
      </div>
    </button>
  );
}

function WeekDayStrip({
  dateWindow,
  items,
  selectedDate,
  onSelectDate,
  timeZone,
}: {
  dateWindow: { startKey: string; endKey: string };
  items: NonNullable<EconomicCalendarSnapshot["items"]>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  timeZone: string;
}) {
  const today = getDateKey(new Date().toISOString(), timeZone);

  const days = Array.from({ length: 7 }, (_, i) => {
    const dateKey = addDaysToDateKey(dateWindow.startKey, i);
    const date = new Date(`${dateKey}T12:00:00.000Z`);
    const dayItems = items.filter((item) => getDateKey(item.timeUtc, timeZone) === dateKey);
    const highCount = dayItems.filter((item) => item.impact === "high").length;
    const medCount = dayItems.filter((item) => item.impact === "medium").length;

    const dayName = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(date);
    const fullDateLabel = formatDateLabel(dateKey, LONG_DATE_FORMATTER);
    const dayNum = new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: "UTC" }).format(date);

    return {
      dateKey,
      dayName,
      dayNum,
      fullDateLabel,
      totalCount: dayItems.length,
      highCount,
      medCount,
      isToday: dateKey === today,
      isSelected: dateKey === selectedDate,
    };
  });

  return (
    <div className="mb-4">
      <div className="flex gap-1.5">
        {days.map(({ dateKey, dayName, dayNum, fullDateLabel, totalCount, highCount, medCount, isToday, isSelected }) => (
          <button
            key={dateKey}
            type="button"
            onClick={() => onSelectDate(isSelected ? "all" : dateKey)}
            aria-label={fullDateLabel}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 rounded-lg px-2 py-2.5 transition-all",
              isSelected
                ? "bg-[var(--vt-coral)] shadow-md"
                : "border border-white/[0.08] hover:border-white/20 hover:bg-white/[0.03]",
            )}
          >
            <span
              className={cn(
                "text-[9px] font-medium uppercase leading-none",
                isSelected ? "text-white/80" : isToday ? "text-[var(--vt-coral)]" : "text-white/40",
              )}
            >
              {dayName}
            </span>

            <span
              className={cn(
                "mt-1 text-base font-bold tabular-nums leading-none",
                isSelected ? "text-white" : "text-white/85",
              )}
            >
              {dayNum}
            </span>

            <div className="mt-1 flex items-center gap-1 text-[9px] font-semibold leading-none">
              {highCount > 0 && (
                <span className={isSelected ? "text-white" : "text-rose-400"}>{highCount}H</span>
              )}
              {medCount > 0 && (
                <span className={isSelected ? "text-white/80" : "text-amber-400"}>{medCount}M</span>
              )}
              {totalCount === 0 && (
                <span className={isSelected ? "text-white/50" : "text-white/25"}>—</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Event row ─────────────────────────────────────────────────────────── */

function EventRow({
  item,
  isLast,
  timeZone,
  onAskPrompt,
}: {
  item: NonNullable<EconomicCalendarSnapshot["items"]>[number];
  isLast: boolean;
  timeZone: string;
  onAskPrompt?: (prompt: string) => void;
}) {
  const hasData = item.actual || item.forecast || item.previous;

  return (
    <button
      type="button"
      onClick={() => onAskPrompt?.(buildEventAskPrompt(item, timeZone))}
      className={cn(
        "w-full px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03]",
        !isLast && "border-b border-white/[0.04]",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-1.5 size-2 shrink-0 rounded-full" style={impactDotStyle(item.impact)} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug text-white">{item.event}</p>
          <p className="mt-0.5 text-[11px] text-[var(--vt-muted)]">
            {item.country} · {item.currency}
            {item.period ? ` · ${item.period}` : ""}
          </p>
          {hasData ? (
            <div className="mt-1.5 flex flex-wrap gap-3 text-[11px]">
              {item.actual && (
                <span>
                  <span className="text-white/45">Actual </span>
                  <span className="font-semibold text-white/90">{item.actual}</span>
                </span>
              )}
              {item.forecast && (
                <span>
                  <span className="text-white/45">Fcst </span>
                  <span className="text-white/70">{item.forecast}</span>
                </span>
              )}
              {item.previous && (
                <span>
                  <span className="text-white/45">Prev </span>
                  <span className="text-white/70">{item.previous}</span>
                </span>
              )}
            </div>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <span className="text-sm tabular-nums text-white/75">
            {formatEventTimeLabel(item.timeUtc, timeZone, item.timeLabel)}
          </span>
          <p className={cn("mt-0.5 text-[10px] font-bold uppercase", impactColor(item.impact))}>
            {impactLabel(item.impact)}
          </p>
        </div>
      </div>
    </button>
  );
}

/* ── Filter dropdowns ──────────────────────────────────────────────────── */

function EventFilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}) {
  const selected = options.find((o) => o.value === value) ?? options[0];

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="inline-flex h-8 items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-xs font-semibold text-white/80 outline-none transition-colors hover:border-white/[0.14] hover:text-white focus-visible:border-[var(--vt-coral)]"
          aria-label={label}
        >
          <span className="truncate">{selected?.label}</span>
          <ChevronDown className="size-3 shrink-0 text-[var(--vt-muted)]" aria-hidden />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-[11rem] overflow-hidden rounded-xl border border-white/[0.08] bg-[#11143f] p-1 shadow-2xl shadow-black/40"
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <DropdownMenu.Item
                key={option.value}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-semibold outline-none transition-colors",
                  isSelected
                    ? "bg-[var(--vt-coral)]/15 text-white"
                    : "text-[var(--vt-muted)] hover:bg-white/[0.06] hover:text-white data-[highlighted]:bg-white/[0.06] data-[highlighted]:text-white",
                )}
                onSelect={() => onChange(option.value)}
              >
                <span>{option.label}</span>
                {isSelected ? <Check className="size-3.5 text-[var(--vt-coral)]" aria-hidden /> : null}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function ImpactFilterValue({ value }: { value: ImpactFilter }) {
  if (value === "all") return <span className="truncate">All Impact</span>;
  return (
    <span className="flex min-w-0 items-center gap-1">
      {value.map((impact) => {
        const option = IMPACT_FILTER_OPTIONS.find((o) => o.value === impact);
        return (
          <span key={impact} className="rounded-md bg-white/[0.07] px-1.5 py-0.5 text-[10px] font-bold text-white/90">
            {option?.label ?? impact}
          </span>
        );
      })}
    </span>
  );
}

function ImpactFilterDropdown({ value, onChange }: { value: ImpactFilter; onChange: (v: ImpactFilter) => void }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="inline-flex h-8 items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-xs font-semibold text-white/80 outline-none transition-colors hover:border-white/[0.14] hover:text-white focus-visible:border-[var(--vt-coral)]"
          aria-label="Filter events by impact"
        >
          <ImpactFilterValue value={value} />
          <ChevronDown className="size-3 shrink-0 text-[var(--vt-muted)]" aria-hidden />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 flex min-w-[11rem] flex-col gap-1.5 overflow-hidden rounded-xl border border-white/[0.08] bg-[#11143f] p-1.5 shadow-2xl shadow-black/40"
        >
          <DropdownMenu.CheckboxItem
            checked={value === "all"}
            className={cn(
              "flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm font-semibold outline-none transition-colors",
              value === "all"
                ? "border-white/[0.08] bg-[var(--vt-coral)]/15 text-white"
                : "border-transparent text-[var(--vt-muted)] hover:bg-white/[0.06] hover:text-white data-[highlighted]:bg-white/[0.06] data-[highlighted]:text-white",
            )}
            onSelect={() => onChange("all")}
          >
            <span>All</span>
            {value === "all" ? <Check className="size-3.5 text-[var(--vt-coral)]" aria-hidden /> : null}
          </DropdownMenu.CheckboxItem>
          {IMPACT_FILTER_OPTIONS.map((option) => {
            const isSelected = value !== "all" && value.includes(option.value);
            return (
              <DropdownMenu.CheckboxItem
                key={option.value}
                checked={isSelected}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm font-semibold outline-none transition-colors",
                  isSelected
                    ? "border-white/[0.08] bg-[var(--vt-coral)]/15 text-white"
                    : "border-transparent text-[var(--vt-muted)] hover:bg-white/[0.06] hover:text-white data-[highlighted]:bg-white/[0.06] data-[highlighted]:text-white",
                )}
                onSelect={(e) => {
                  e.preventDefault();
                  onChange(nextImpactFilter(value, option.value));
                }}
              >
                <span>{option.label}</span>
                {isSelected ? <Check className="size-3.5 text-[var(--vt-coral)]" aria-hidden /> : null}
              </DropdownMenu.CheckboxItem>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/* ── Main section ──────────────────────────────────────────────────────── */

export type MarketEventsSectionProps = {
  snapshot: EconomicCalendarSnapshot | undefined;
  onAskPrompt?: (prompt: string) => void;
  isLoading?: boolean;
  errorMessage?: string | null;
  timeZone?: string;
  now?: Date;
};

export function MarketEventsSection({
  snapshot,
  onAskPrompt,
  isLoading = false,
  errorMessage = null,
  timeZone,
  now,
}: MarketEventsSectionProps) {
  const [dateFilter, setDateFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>(["high", "medium"]);
  const resolvedTimeZone = useEventTimeZone(timeZone);
  const [liveTime, setLiveTime] = useState(() => new Date());

  useEffect(() => {
    if (now) return;
    const id = window.setInterval(() => setLiveTime(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [now]);

  const currentTime = now ?? liveTime;
  const dateWindow = useMemo(() => getLocalDateWindow(resolvedTimeZone, currentTime), [currentTime, resolvedTimeZone]);

  const supportedItems = useMemo(() => {
    return (snapshot?.items ?? []).filter((item) => isSupportedEventCountry(item.country));
  }, [snapshot?.items]);

  const items = useMemo(() => {
    return supportedItems.filter((item) => {
      return isDateKeyInWindow(getDateKey(item.timeUtc, resolvedTimeZone), dateWindow);
    });
  }, [dateWindow, resolvedTimeZone, supportedItems]);

  const countries = useMemo(() => {
    const set = new Set(items.map((item) => item.country));
    return ECONOMIC_CALENDAR_COUNTRIES.filter((c) => set.has(c));
  }, [items]);

  const countryOptions = useMemo<FilterOption[]>(() => {
    return [
      { label: "All countries", value: "all" },
      ...countries.map((c) => ({ label: countryOptionLabel(c), value: c })),
    ];
  }, [countries]);

  const activeCountryFilter = countryOptions.some((o) => o.value === countryFilter) ? countryFilter : "all";

  const filteredItems = items.filter((item) => {
    if (dateFilter !== "all" && getDateKey(item.timeUtc, resolvedTimeZone) !== dateFilter) return false;
    if (activeCountryFilter !== "all" && item.country !== activeCountryFilter) return false;
    return impactMatchesFilter(impactFilter, item.impact);
  });

  const dayGroups = useMemo<DayGroup[]>(() => {
    const groups = new Map<string, DayGroup>();
    for (const item of filteredItems) {
      const key = getDateKey(item.timeUtc, resolvedTimeZone);
      const existing = groups.get(key);
      if (existing) {
        existing.items.push(item);
      } else {
        groups.set(key, { key, label: formatDateLabel(key, LONG_DATE_FORMATTER), items: [item] });
      }
    }
    return Array.from(groups.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((g) => ({ ...g, items: [...g.items].sort((a, b) => a.timeUtc.localeCompare(b.timeUtc)) }));
  }, [filteredItems, resolvedTimeZone]);

  return (
    <div className="mt-4">
      {/* Filters */}
      <div className="mb-4 flex items-center justify-end gap-2">
        <EventFilterDropdown
          label="Filter by country"
          value={activeCountryFilter}
          options={countryOptions}
          onChange={setCountryFilter}
        />
        <ImpactFilterDropdown value={impactFilter} onChange={setImpactFilter} />
      </div>

      {/* Next high-impact event banner */}
      <HighImpactCountdown
        items={supportedItems}
        now={currentTime}
        timeZone={resolvedTimeZone}
        onAskPrompt={onAskPrompt}
      />

      {/* Week day strip */}
      <WeekDayStrip
        dateWindow={dateWindow}
        items={items}
        selectedDate={dateFilter}
        onSelectDate={setDateFilter}
        timeZone={resolvedTimeZone}
      />

      {/* Content */}
      {errorMessage ? (
        <div className="rounded-xl border border-white/[0.06] bg-[var(--vt-card)] p-8 text-center" role="alert">
          <p className="text-sm text-[var(--vt-coral)]">{errorMessage}</p>
        </div>
      ) : isLoading ? (
        <div
          className="overflow-hidden rounded-xl border border-white/[0.06] bg-[var(--vt-card)]"
          aria-busy="true"
          aria-label="Loading economic calendar"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={cn("px-4 py-3.5", i < 5 && "border-b border-white/[0.04]")}>
              <div className="flex items-start gap-3">
                <div className="mt-1.5 size-2 animate-pulse rounded-full bg-white/[0.1]" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3.5 w-4/5 animate-pulse rounded bg-white/[0.08]" />
                  <div className="h-3 w-2/5 animate-pulse rounded bg-white/[0.05]" />
                </div>
                <div className="h-4 w-12 animate-pulse rounded bg-white/[0.06]" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-[var(--vt-card)] p-8 text-center">
          <p className="text-sm text-[var(--vt-muted)]">No events match these filters.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {dayGroups.map((group) => (
            <section key={group.key} aria-labelledby={`events-${group.key}`}>
              <div className="mb-2 flex items-baseline justify-between gap-3 px-0.5">
                <h4 id={`events-${group.key}`} className="text-sm font-bold text-white">
                  {group.label}
                </h4>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-white/45">
                  {group.items.length} {group.items.length === 1 ? "event" : "events"}
                </span>
              </div>
              <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-[var(--vt-card)]">
                {group.items.map((item, index) => (
                  <EventRow
                    key={item.id}
                    item={item}
                    isLast={index === group.items.length - 1}
                    timeZone={resolvedTimeZone}
                    onAskPrompt={onAskPrompt}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
