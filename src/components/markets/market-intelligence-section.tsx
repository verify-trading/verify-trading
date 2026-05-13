"use client";

import { Newspaper } from "lucide-react";

import type { DailyMarketBrief, MarketIntelligenceItem } from "@/lib/markets/market-intelligence";
import { cn } from "@/lib/utils";

export type MarketIntelligenceSectionProps = {
  items: readonly MarketIntelligenceItem[];
  sourceCount?: number | null;
  dailyBrief?: DailyMarketBrief | null;
  updatedAt?: string | null;
  onAskPrompt?: (prompt: string) => void;
  isLoading?: boolean;
  errorMessage?: string | null;
};

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  if (!Number.isFinite(ms) || ms < 0) return "now";
  const min = Math.floor(ms / 60_000);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (min < 1) return "just now";
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  if (day < 7) return `${day}d ago`;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(d);
}

function formatBriefDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function DailyBriefCard({
  brief,
  onAskPrompt,
}: {
  brief: DailyMarketBrief;
  onAskPrompt?: (prompt: string) => void;
}) {
  const assets = [
    { label: "Gold", data: brief.gold },
    { label: "Oil", data: brief.oil },
    { label: "EUR/USD", data: brief.eurusd },
    { label: "GBP/USD", data: brief.gbpusd },
  ];

  return (
    <section className="overflow-hidden rounded-lg border border-white/[0.08] bg-[var(--vt-card)] p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Newspaper className="size-4 text-[var(--vt-green)]" aria-hidden />
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--vt-green)]">Daily Brief</span>
        </div>
        <span className="text-xs text-white/40" suppressHydrationWarning>
          {formatBriefDate(brief.date)}
        </span>
      </div>

      {/* Overview */}
      <p className="mt-3 text-sm leading-relaxed text-white/75">{brief.overview}</p>

      {/* Assets - Badge style */}
      <div className="mt-3 flex flex-wrap gap-2">
        {assets.map(({ label, data }) => {
          const biasLower = data.bias.toLowerCase();
          const biasColor = biasLower.includes("bull")
            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            : biasLower.includes("bear")
              ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
              : "bg-white/[0.03] text-white/50 border-white/[0.08]";

          return (
            <div
              key={label}
              className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1.5"
            >
              <span className="text-xs font-medium text-white/60">{label}</span>
              <span className="text-xs font-bold tabular-nums text-white">{data.level}</span>
              <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold", biasColor)}>
                {data.bias}
              </span>
            </div>
          );
        })}
      </div>

      {/* Session Tone */}
      <div className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">Session Tone</span>
        <p className="mt-1.5 text-sm leading-relaxed text-white/80">{brief.session_tone}</p>
      </div>

      {/* Footer */}
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() =>
            onAskPrompt?.(`Based on the Daily Market Brief for ${formatBriefDate(brief.date)} — what should I focus on first?`)
          }
          className="text-xs font-semibold text-[var(--vt-green)] transition-colors hover:text-white"
        >
          Ask about this →
        </button>
      </div>
    </section>
  );
}

/* ── Main section ──────────────────────────────────────────────────────── */

export function MarketIntelligenceSection({
  items,
  sourceCount,
  dailyBrief = null,
  updatedAt,
  onAskPrompt,
  isLoading = false,
  errorMessage = null,
}: MarketIntelligenceSectionProps) {
  const showEmpty = !isLoading && !errorMessage && items.length === 0;

  const updatedLabel = updatedAt
    ? formatRelativeTime(updatedAt)
    : items.length > 0
      ? formatRelativeTime(items[0]!.publishedAt)
      : null;

  return (
    <div className="min-w-0 space-y-4">
      {dailyBrief ? <DailyBriefCard brief={dailyBrief} onAskPrompt={onAskPrompt} /> : null}

      <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-[var(--vt-card)]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-white">Market Radar</h2>
            <p className="mt-0.5 text-[11px] font-medium text-[var(--vt-muted)]">
              Source headlines that open Ask inside verify.trading
            </p>
          </div>
          {updatedLabel && (
            <span className="text-[11px] text-[var(--vt-muted)]" suppressHydrationWarning>Updated {updatedLabel}</span>
          )}
        </div>

        {/* Body */}
        {errorMessage ? (
          <p className="border-t border-white/[0.06] px-5 py-8 text-sm text-[var(--vt-coral)]" role="alert">
            {errorMessage}
          </p>
        ) : isLoading ? (
          <ul className="border-t border-white/[0.06]" aria-busy="true" aria-label="Loading market intelligence">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="border-b border-white/[0.05] px-5 py-4 last:border-0">
                <div className="flex items-start gap-4">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-4 w-full animate-pulse rounded bg-white/[0.08]" />
                    <div className="h-3.5 w-3/4 animate-pulse rounded bg-white/[0.05]" />
                  </div>
                  <div className="size-4 shrink-0 animate-pulse rounded bg-white/[0.06]" />
                </div>
              </li>
            ))}
          </ul>
        ) : showEmpty ? (
          <p className="border-t border-white/[0.06] px-5 py-8 text-sm text-[var(--vt-muted)]">
            No headlines right now.
          </p>
        ) : (
          <div className="border-t border-white/[0.06]">
            {items.length > 0 ? (
              <div className="flex items-center gap-2 px-5 py-3">
                <Newspaper className="size-4 text-white/40" aria-hidden />
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/55">
                  Source Headlines
                </p>
              </div>
            ) : null}

            <ul>
              {items.map((item) => {
                const askPrompt = `${item.title} — what does this mean for my trades? (Source: ${item.source}, ${formatBriefDate(item.publishedAt.split("T")[0] ?? "")})`;

                return (
                  <li key={item.id} className="border-b border-white/[0.05] last:border-0">
                    <button
                      type="button"
                      onClick={() => onAskPrompt?.(askPrompt)}
                      className="block w-full px-5 py-4 text-left transition-colors hover:bg-white/[0.02]"
                    >
                      <span className="block text-[15px] font-normal leading-snug text-white/95">
                        {item.title}
                      </span>
                      <span className="mt-1.5 block text-[11px] font-medium text-[var(--vt-muted)]" suppressHydrationWarning>
                        {item.source} · {formatRelativeTime(item.publishedAt)}
                        {item.category ? ` · ${item.category}` : ""}
                      </span>
                      {item.summary ? (
                        <span className="mt-2 line-clamp-2 block text-sm leading-relaxed text-[var(--vt-muted)]">
                          {item.summary}
                        </span>
                      ) : null}
                      <span className="mt-3 block text-xs font-bold text-[var(--vt-coral)]">
                        Ask about this →
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Footer */}
        {!isLoading && !errorMessage && items.length > 0 && (
          <div className="border-t border-white/[0.05]">
            <p className="px-5 py-3 text-[11px] font-semibold text-[var(--vt-muted)]">
              {sourceCount ?? items.length} market sources scanned
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
