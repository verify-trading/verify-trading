import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";

import { Section } from "@/components/marketing/primitives";
import { surface } from "@/components/landing/section-primitives";
import { ECONOMIC_CALENDAR_COUNTRY_LABELS, type EconomicEventItem } from "@/lib/markets/economic-calendar";
import type { DailyMarketBrief } from "@/lib/markets/market-intelligence";
import { cn } from "@/lib/utils";

const eventTime = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

const briefDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

const biasClass = (bias: string) =>
  /bull/i.test(bias) ? "text-[var(--vt-green)]" : /bear/i.test(bias) ? "text-[var(--vt-coral)]" : "text-slate-300";

/** Read-only "this week" table. Real data from the cached calendar; Pro unlocks filters and the full week. */
export function LiveCalendarPreview({ events, updatedAt }: { events: EconomicEventItem[]; updatedAt: string }) {
  return (
    <Section
      eyebrow="Live preview"
      title="High-impact events, next 7 days"
      intro={`Read from the same calendar Pro members see, refreshed daily. Last update ${eventTime.format(new Date(updatedAt))} UTC.`}
    >
      <div className={cn(surface, "overflow-hidden")}>
        <ul className="divide-y divide-white/[0.06]">
          {events.map((e) => (
            <li key={e.id} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-4 py-3.5 sm:grid-cols-[11rem_1fr_auto] sm:items-center sm:px-5">
              <p className="col-span-2 font-mono text-xs text-[var(--vt-muted)] sm:col-span-1">{eventTime.format(new Date(e.timeUtc))} UTC</p>
              <p className="min-w-0 text-sm font-medium text-white">
                <span className="mr-2 inline-flex items-center gap-1.5 text-xs text-slate-400">
                  <span aria-hidden className="size-2 rounded-full bg-[var(--vt-coral)]" />
                  {e.currency}
                </span>
                {e.event}
                <span className="ml-2 text-xs font-normal text-[var(--vt-muted)]">
                  {ECONOMIC_CALENDAR_COUNTRY_LABELS[e.country as keyof typeof ECONOMIC_CALENDAR_COUNTRY_LABELS] ?? e.country}
                </span>
              </p>
              <p className="text-right font-mono text-xs text-slate-400">
                {e.forecast ? `Fcst ${e.forecast}` : ""}
                {e.forecast && e.previous ? " · " : ""}
                {e.previous ? `Prev ${e.previous}` : ""}
              </p>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] bg-white/[0.02] px-5 py-3.5 text-sm text-slate-400">
          <span className="flex items-center gap-2">
            <Lock className="size-3.5 text-purple-300" aria-hidden />
            Pro adds medium and low impact, country filters and AI risk levels.
          </span>
          <Link href="/pricing" className="inline-flex items-center gap-1 font-medium text-[var(--vt-blue)] hover:underline">
            See Pro <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </Section>
  );
}

const PREVIEW_ASSETS = [
  ["gold", "Gold (XAU/USD)"],
  ["eurusd", "EUR/USD"],
] as const;

const LOCKED_ASSETS = ["Oil", "USD/JPY", "GBP/USD", "DXY"];

/** Latest stored brief: tone plus two assets. The full overview and the other assets stay Pro. */
export function LiveBriefPreview({ brief }: { brief: DailyMarketBrief }) {
  return (
    <Section
      eyebrow="Latest brief"
      title={`Pre-session brief, ${briefDate.format(new Date(`${brief.date}T00:00:00Z`))}`}
      intro="The most recent brief, as generated for Pro members. This is a preview of two assets; it is market context, not a recommendation."
    >
      <div className={cn(surface, "p-5 sm:p-7")}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-muted)]">Session tone</p>
        <p className="mt-2 max-w-3xl text-base leading-relaxed text-slate-200">{brief.session_tone}</p>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {PREVIEW_ASSETS.map(([key, label]) => {
            const asset = brief[key];
            return (
              <div key={key} className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
                <p className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold text-white">{label}</span>
                  <span className="font-mono text-sm text-slate-200">{asset.level}</span>
                </p>
                <p className={cn("mt-1 text-xs font-semibold uppercase tracking-wider", biasClass(asset.bias))}>{asset.bias}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{asset.verdict}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="More assets in the full brief">
          {LOCKED_ASSETS.map((a) => (
            <span key={a} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-xs text-[var(--vt-muted)]">
              <Lock className="size-3" aria-hidden />
              {a}
            </span>
          ))}
        </div>
      </div>
    </Section>
  );
}
