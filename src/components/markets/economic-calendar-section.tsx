"use client";

import { CalendarDays } from "lucide-react";

import type { EconomicEventItem } from "@/lib/markets/economic-calendar";
import { cn } from "@/lib/utils";

export type EconomicCalendarSectionProps = {
  items: readonly EconomicEventItem[];
  /** Label for the heading, e.g. "Today — Apr 14, 2026" */
  dayLabel: string;
  isLoading?: boolean;
  errorMessage?: string | null;
};

function impactBadge(impact: EconomicEventItem["impact"]): string {
  switch (impact) {
    case "high":
      return "border-[rgba(242,109,109,0.35)] bg-[rgba(242,109,109,0.1)] text-[var(--vt-coral)]";
    case "medium":
      return "border-amber-400/30 bg-amber-400/10 text-amber-100";
    default:
      return "border-white/12 bg-white/[0.06] text-[var(--vt-muted)]";
  }
}

export function EconomicCalendarSection({
  items,
  dayLabel,
  isLoading = false,
  errorMessage = null,
}: EconomicCalendarSectionProps) {
  const sorted = [...items].sort((a, b) => a.timeUtc.localeCompare(b.timeUtc));
  const showEmpty = !isLoading && !errorMessage && sorted.length === 0;

  const panelClass = cn(
    "overflow-hidden rounded-[28px] border border-[color:var(--vt-border)]",
    "bg-gradient-to-b from-[var(--vt-card)] to-[rgba(15,19,64,0.6)]",
    "shadow-[0_24px_60px_rgba(10,13,46,0.32)]",
  );

  return (
    <div className="min-w-0">
      <header className="mb-8 border-b border-white/[0.08] pb-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--vt-coral)]">Macro</p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">Economic calendar</h2>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[color:var(--vt-border)] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-[var(--vt-muted)]">
              <CalendarDays className="size-3.5 shrink-0 text-[var(--vt-blue)]" aria-hidden />
              {dayLabel}
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--vt-muted)]">
              Scheduled macro releases with consensus and prior prints when available.
            </p>
          </div>
        </div>
      </header>

      <div className={panelClass}>
        {errorMessage ? (
          <p className="px-5 py-8 text-sm text-[var(--vt-coral)] sm:px-6" role="alert">
            {errorMessage}
          </p>
        ) : isLoading ? (
          <div className="overflow-x-auto px-5 py-8 sm:px-6" aria-busy="true" aria-label="Loading economic calendar">
            <div className="h-8 w-full max-w-md animate-pulse rounded bg-white/10" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 w-full animate-pulse rounded bg-white/[0.06]" />
              ))}
            </div>
          </div>
        ) : showEmpty ? (
          <p className="px-5 py-8 text-sm text-[var(--vt-muted)] sm:px-6">
            No scheduled releases in this window.
          </p>
        ) : (
          <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.04] text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--vt-muted)]">
                  <th className="px-5 py-3.5 pl-6">Time</th>
                  <th className="px-5 py-3.5">Currency</th>
                  <th className="px-5 py-3.5">Event</th>
                  <th className="px-5 py-3.5">Impact</th>
                  <th className="px-5 py-3.5">Forecast</th>
                  <th className="px-5 py-3.5 pr-6">Previous</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-white/[0.06] transition-colors last:border-0 hover:bg-white/[0.03]"
                  >
                    <td className="whitespace-nowrap px-5 py-4 pl-6 font-mono text-xs font-semibold tabular-nums text-white">
                      {row.timeLabel}
                    </td>
                    <td className="px-5 py-4 text-xs font-semibold text-slate-200">{row.currency}</td>
                    <td className="max-w-md px-5 py-4 text-slate-100">{row.event}</td>
                    <td className="px-5 py-4">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]",
                          impactBadge(row.impact),
                        )}
                      >
                        {row.impact}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-300">{row.forecast ?? "—"}</td>
                    <td className="px-5 py-4 pr-6 font-mono text-xs text-slate-300">{row.previous ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
