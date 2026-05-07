"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Calendar, Check, ChevronDown } from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";

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

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
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
  if (!Number.isFinite(date.getTime())) {
    return timeUtc.slice(0, 10);
  }

  try {
    const dateParts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      dateParts.find((datePart) => datePart.type === type)?.value;
    const year = part("year");
    const month = part("month");
    const day = part("day");
    return year && month && day ? `${year}-${month}-${day}` : date.toISOString().slice(0, 10);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function formatDateLabel(dateKey: string, formatter: Intl.DateTimeFormat): string {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) {
    return dateKey;
  }
  return formatter.format(date);
}

function formatEventTimeLabel(timeUtc: string, timeZone: string, fallback: string): string {
  const date = new Date(timeUtc);
  if (!Number.isFinite(date.getTime())) {
    return fallback;
  }

  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  } catch {
    return fallback;
  }
}

/* ── Impact color ──────────────────────────────────────────────────────── */

function impactColor(impact: string): string {
  if (impact === "high") return "text-rose-400";
  if (impact === "medium") return "text-amber-400";
  return "text-emerald-400";
}

function impactLabel(impact: string): string {
  if (impact === "high") return "High";
  if (impact === "medium") return "Medium";
  return "Low";
}

function orderedImpacts(impacts: readonly SelectedImpact[]): SelectedImpact[] {
  return IMPACT_FILTER_OPTIONS
    .map((option) => option.value)
    .filter((impact) => impacts.includes(impact));
}

function impactMatchesFilter(filter: ImpactFilter, impact: string): boolean {
  if (filter === "all") {
    return true;
  }
  return filter.some((selectedImpact) => selectedImpact === impact);
}

function nextImpactFilter(filter: ImpactFilter, impact: SelectedImpact): ImpactFilter {
  const current = filter === "all" ? [] : filter;
  const next = current.includes(impact)
    ? current.filter((selectedImpact) => selectedImpact !== impact)
    : orderedImpacts([...current, impact]);

  return next.length > 0 ? next : "all";
}

function ImpactFilterValue({ value }: { value: ImpactFilter }) {
  if (value === "all") {
    return <span className="truncate">All</span>;
  }

  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {value.map((impact) => {
        const option = IMPACT_FILTER_OPTIONS.find((item) => item.value === impact);
        return (
          <span
            key={impact}
            className="rounded-md bg-white/[0.07] px-2 py-0.5 text-[11px] font-bold text-white/90"
          >
            {option?.label ?? impact}
          </span>
        );
      })}
    </span>
  );
}

/* ── Filter dropdown ───────────────────────────────────────────────────── */

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
  const selected = options.find((option) => option.value === value) ?? options[0];

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="inline-flex h-9 min-w-[9rem] items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-xs font-semibold text-white/80 outline-none transition-colors hover:border-white/[0.14] hover:text-white focus-visible:border-[var(--vt-coral)] focus-visible:ring-2 focus-visible:ring-[var(--vt-coral)]/20"
          aria-label={label}
        >
          <span className="truncate">{selected?.label}</span>
          <ChevronDown className="size-3.5 shrink-0 text-[var(--vt-muted)]" aria-hidden />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-[12rem] overflow-hidden rounded-xl border border-white/[0.08] bg-[#11143f] p-1 shadow-2xl shadow-black/40"
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
                {isSelected ? <Check className="size-4 text-[var(--vt-coral)]" aria-hidden /> : null}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function ImpactFilterDropdown({
  value,
  onChange,
}: {
  value: ImpactFilter;
  onChange: (value: ImpactFilter) => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="inline-flex h-9 min-w-[9rem] items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-xs font-semibold text-white/80 outline-none transition-colors hover:border-white/[0.14] hover:text-white focus-visible:border-[var(--vt-coral)] focus-visible:ring-2 focus-visible:ring-[var(--vt-coral)]/20"
          aria-label="Filter events by impact"
        >
          <ImpactFilterValue value={value} />
          <ChevronDown className="size-3.5 shrink-0 text-[var(--vt-muted)]" aria-hidden />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-[12rem] space-y-1 overflow-hidden rounded-xl border border-white/[0.08] bg-[#11143f] p-1.5 shadow-2xl shadow-black/40"
        >
          <DropdownMenu.CheckboxItem
            checked={value === "all"}
            className={cn(
              "flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3.5 py-2.5 text-sm font-semibold outline-none transition-colors",
              value === "all"
                ? "bg-[var(--vt-coral)]/15 text-white"
                : "text-[var(--vt-muted)] hover:bg-white/[0.06] hover:text-white data-[highlighted]:bg-white/[0.06] data-[highlighted]:text-white",
            )}
            onSelect={() => {
              onChange("all");
            }}
          >
            <span>All</span>
            {value === "all" ? <Check className="size-4 text-[var(--vt-coral)]" aria-hidden /> : null}
          </DropdownMenu.CheckboxItem>

          {IMPACT_FILTER_OPTIONS.map((option) => {
            const isSelected = value !== "all" && value.includes(option.value);
            return (
              <DropdownMenu.CheckboxItem
                key={option.value}
                checked={isSelected}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3.5 py-2.5 text-sm font-semibold outline-none transition-colors",
                  isSelected
                    ? "bg-[var(--vt-coral)]/15 text-white"
                    : "text-[var(--vt-muted)] hover:bg-white/[0.06] hover:text-white data-[highlighted]:bg-white/[0.06] data-[highlighted]:text-white",
                )}
                onSelect={(event) => {
                  event.preventDefault();
                  onChange(nextImpactFilter(value, option.value));
                }}
              >
                <span>{option.label}</span>
                {isSelected ? <Check className="size-4 text-[var(--vt-coral)]" aria-hidden /> : null}
              </DropdownMenu.CheckboxItem>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/* ── Grid column definition (single source of truth) ───────────────────── */

const GRID_COLS = "6rem 2fr 1fr 1fr 1fr 5rem";

/* ── Desktop table header ──────────────────────────────────────────────── */

function EventsTableHeader() {
  return (
    <div
      className="hidden gap-x-3 border-b border-white/[0.06] px-4 py-2.5 md:grid"
      style={{ gridTemplateColumns: GRID_COLS }}
      role="row"
      aria-hidden
    >
      <span className="text-[10px] font-semibold uppercase tracking-widest text-white/70">
        Time
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-widest text-white/70">
        Event
      </span>
      <span className="text-right text-[10px] font-semibold uppercase tracking-widest text-white/70">
        Actual
      </span>
      <span className="text-right text-[10px] font-semibold uppercase tracking-widest text-white/70">
        Forecast
      </span>
      <span className="text-right text-[10px] font-semibold uppercase tracking-widest text-white/70">
        Previous
      </span>
      <span className="text-right text-[10px] font-semibold uppercase tracking-widest text-white/70">
        Impact
      </span>
    </div>
  );
}

/* ── Desktop event row ─────────────────────────────────────────────────── */

function EventRowDesktop({
  item,
  isLast,
  timeZone,
}: {
  item: NonNullable<EconomicCalendarSnapshot["items"]>[number];
  isLast: boolean;
  timeZone: string;
}) {
  return (
    <div
      className={cn(
        "hidden items-center gap-x-3 px-4 py-3 md:grid",
        !isLast && "border-b border-white/[0.04]",
      )}
      style={{ gridTemplateColumns: GRID_COLS }}
    >
      {/* Time */}
      <span className="text-sm tabular-nums text-white/80">
        {formatEventTimeLabel(item.timeUtc, timeZone, item.timeLabel)}
      </span>

      {/* Event info */}
      <div className="min-w-0 pr-3">
        <div className="flex items-center gap-1.5">
          <span className="shrink-0 text-[11px] font-semibold text-white/75">
            {item.country}
          </span>
          <span className="text-[11px] text-white/60">{item.currency}</span>
          {item.period ? (
            <span className="text-[11px] text-white/60">· {item.period}</span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-sm font-medium text-white">
          {item.event}
        </p>
        {item.source ? (
          <p className="mt-0.5 truncate text-[11px] text-white/55">{item.source}</p>
        ) : null}
      </div>

      {/* Actual */}
      <span className="truncate text-right text-sm font-semibold tabular-nums text-white">
        {item.actual ?? "—"}
      </span>

      {/* Forecast */}
      <span className="truncate text-right text-sm tabular-nums text-white/80">
        {item.forecast ?? "—"}
      </span>

      {/* Previous */}
      <span className="truncate text-right text-sm tabular-nums text-white/80">
        {item.previous ?? "—"}
      </span>

      {/* Impact */}
      <span
        className={cn(
          "text-right text-xs font-bold uppercase",
          impactColor(item.impact),
        )}
      >
        {impactLabel(item.impact)}
      </span>
    </div>
  );
}

/* ── Mobile event card ─────────────────────────────────────────────────── */

function EventRowMobile({
  item,
  isLast,
  timeZone,
}: {
  item: NonNullable<EconomicCalendarSnapshot["items"]>[number];
  isLast: boolean;
  timeZone: string;
}) {
  return (
    <div
      className={cn(
        "px-3.5 py-3 md:hidden",
        !isLast && "border-b border-white/[0.04]",
      )}
    >
      {/* Top row: time + country + impact */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs tabular-nums text-white/80">
            {formatEventTimeLabel(item.timeUtc, timeZone, item.timeLabel)}
          </span>
          <span className="text-[11px] font-semibold text-white/75">{item.country}</span>
          <span className="text-[11px] text-white/60">{item.currency}</span>
        </div>
        <span
          className={cn(
            "text-[11px] font-bold uppercase",
            impactColor(item.impact),
          )}
        >
          {impactLabel(item.impact)}
        </span>
      </div>

      {/* Event name */}
      <p className="mt-1 text-sm font-medium text-white">{item.event}</p>
      {item.period ? (
        <p className="mt-0.5 text-[11px] text-white/60">{item.period}</p>
      ) : null}

      {/* Data row */}
      <div className="mt-2 grid grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">Actual</p>
          <p className="mt-0.5 truncate text-xs font-semibold tabular-nums text-white">
            {item.actual ?? "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">Forecast</p>
          <p className="mt-0.5 truncate text-xs tabular-nums text-white/80">
            {item.forecast ?? "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">Previous</p>
          <p className="mt-0.5 truncate text-xs tabular-nums text-white/80">
            {item.previous ?? "—"}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Main section ──────────────────────────────────────────────────────── */

export type MarketEventsSectionProps = {
  snapshot: EconomicCalendarSnapshot | undefined;
  isLoading?: boolean;
  errorMessage?: string | null;
  timeZone?: string;
};

export function MarketEventsSection({
  snapshot,
  isLoading = false,
  errorMessage = null,
  timeZone,
}: MarketEventsSectionProps) {
  const [dateFilter, setDateFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>(["high", "medium"]);
  const resolvedTimeZone = useEventTimeZone(timeZone);

  const items = useMemo(() => {
    return (snapshot?.items ?? []).filter((item) => isSupportedEventCountry(item.country));
  }, [snapshot?.items]);
  const countries = useMemo(() => {
    const itemCountries = new Set(items.map((item) => item.country));
    return ECONOMIC_CALENDAR_COUNTRIES.filter((country) => itemCountries.has(country));
  }, [items]);
  const countryOptions = useMemo<FilterOption[]>(() => {
    return [
      { label: "All countries", value: "all" },
      ...countries.map((country) => ({
        label: countryOptionLabel(country),
        value: country,
      })),
    ];
  }, [countries]);
  const dateOptions = useMemo<FilterOption[]>(() => {
    const dateKeys = Array.from(new Set(items.map((item) => getDateKey(item.timeUtc, resolvedTimeZone)))).sort();
    return [
      { label: "All dates", value: "all" },
      ...dateKeys.map((dateKey) => ({
        label: formatDateLabel(dateKey, SHORT_DATE_FORMATTER),
        value: dateKey,
      })),
    ];
  }, [items, resolvedTimeZone]);
  const activeDateFilter = dateOptions.some((option) => option.value === dateFilter) ? dateFilter : "all";
  const activeCountryFilter = countryOptions.some((option) => option.value === countryFilter) ? countryFilter : "all";

  const filteredItems = items.filter((item) => {
    if (activeDateFilter !== "all" && getDateKey(item.timeUtc, resolvedTimeZone) !== activeDateFilter) {
      return false;
    }
    if (activeCountryFilter !== "all" && item.country !== activeCountryFilter) {
      return false;
    }
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
        groups.set(key, {
          key,
          label: formatDateLabel(key, LONG_DATE_FORMATTER),
          items: [item],
        });
      }
    }

    return Array.from(groups.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((group) => ({
        ...group,
        items: [...group.items].sort((a, b) => a.timeUtc.localeCompare(b.timeUtc)),
      }));
  }, [filteredItems, resolvedTimeZone]);

  return (
    <div className="mt-6">
      {/* Header + Filters */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-[var(--vt-coral)]" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--vt-muted)]">
            {snapshot?.dayLabel ?? "This week's events"}
          </h3>
        </div>

        <div className="flex flex-wrap gap-2">
          <EventFilterDropdown
            label="Filter events by date"
            value={activeDateFilter}
            options={dateOptions}
            onChange={setDateFilter}
          />
          <EventFilterDropdown
            label="Filter events by country"
            value={activeCountryFilter}
            options={countryOptions}
            onChange={setCountryFilter}
          />
          <ImpactFilterDropdown
            value={impactFilter}
            onChange={setImpactFilter}
          />
        </div>
      </div>

      {/* Content */}
      {errorMessage ? (
        <div className="rounded-2xl border border-white/[0.06] bg-[var(--vt-card)] p-8 text-center" role="alert">
          <p className="text-sm text-[var(--vt-coral)]">{errorMessage}</p>
        </div>
      ) : isLoading ? (
        <div
          className="overflow-hidden rounded-xl border border-white/[0.06] bg-[var(--vt-card)]"
          aria-busy="true"
          aria-label="Loading economic calendar"
        >
          <EventsTableHeader />
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className={cn("px-4 py-3", index < 4 && "border-b border-white/[0.04]")}
            >
              <div className="grid gap-3 md:grid-cols-[6rem_2fr_1fr_1fr_1fr_5rem]">
                <div className="h-4 animate-pulse rounded bg-white/[0.08]" />
                <div className="h-4 animate-pulse rounded bg-white/[0.1]" />
                <div className="h-4 animate-pulse rounded bg-white/[0.06]" />
                <div className="h-4 animate-pulse rounded bg-white/[0.06]" />
                <div className="h-4 animate-pulse rounded bg-white/[0.06]" />
                <div className="h-4 animate-pulse rounded bg-white/[0.08]" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-[var(--vt-card)] p-8 text-center">
          <p className="text-sm text-[var(--vt-muted)]">No events match these filters.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {dayGroups.map((group) => (
            <section key={group.key} aria-labelledby={`events-${group.key}`}>
              {/* Day header */}
              <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
                <h4 id={`events-${group.key}`} className="text-sm font-bold text-white sm:text-base">
                  {group.label}
                </h4>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-white/60">
                  {group.items.length} {group.items.length === 1 ? "event" : "events"}
                </span>
              </div>

              {/* Table card */}
              <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-[var(--vt-card)]">
                <EventsTableHeader />

                {group.items.map((item, index) => (
                  <div key={item.id}>
                    <EventRowDesktop
                      item={item}
                      isLast={index === group.items.length - 1}
                      timeZone={resolvedTimeZone}
                    />
                    <EventRowMobile
                      item={item}
                      isLast={index === group.items.length - 1}
                      timeZone={resolvedTimeZone}
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
