"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import type { DailyMarketBrief, MarketIntelligenceItem } from "@/lib/markets/market-intelligence";
import { cn } from "@/lib/utils";

export type MarketIntelligenceSectionProps = {
  items: readonly MarketIntelligenceItem[];
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

function BriefAssetRow({ label, asset }: { label: string; asset: DailyMarketBrief["gold"] }) {
  const biasLower = asset.bias.toLowerCase();
  const biasColor = biasLower.includes("bull")
    ? "text-emerald-400"
    : biasLower.includes("bear")
      ? "text-rose-400"
      : "text-[var(--vt-muted)]";

  return (
    <div className="py-3">
      <div className="flex items-center justify-between gap-4">
        <span className="text-[11px] font-black uppercase tracking-[0.1em] text-white/75">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tabular-nums text-white/90">{asset.level}</span>
          <span className={cn("text-xs font-bold", biasColor)}>{asset.bias}</span>
        </div>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-[var(--vt-muted)]">{asset.verdict}</p>
    </div>
  );
}

function DailyBriefCard({
  brief,
  onAskPrompt,
}: {
  brief: DailyMarketBrief;
  onAskPrompt?: (prompt: string) => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-white/[0.07] bg-[var(--vt-card)]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
        <h2 className="text-sm font-bold text-white">Daily Brief</h2>
        <span className="text-[11px] text-[var(--vt-muted)]">{formatBriefDate(brief.date)}</span>
      </div>
      <div className="divide-y divide-white/[0.05] px-5">
        <BriefAssetRow label="Gold" asset={brief.gold} />
        <BriefAssetRow label="Oil" asset={brief.oil} />
        <BriefAssetRow label="EUR/USD" asset={brief.eurusd} />
        <BriefAssetRow label="GBP/USD" asset={brief.gbpusd} />
      </div>
      <div className="border-t border-white/[0.05] px-5 py-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--vt-muted)]">Session Tone</p>
        <p className="mt-1.5 text-sm leading-relaxed text-white/85">{brief.session_tone}</p>
        <button
          type="button"
          onClick={() =>
            onAskPrompt?.(`Daily market brief for ${formatBriefDate(brief.date)} — what should I focus on first?`)
          }
          className="mt-4 inline-flex h-9 items-center rounded-full bg-[var(--vt-green)] px-4 text-sm font-bold text-[var(--vt-navy)] transition hover:brightness-110"
        >
          Ask me more
        </button>
      </div>
    </section>
  );
}

/* ── Main section ──────────────────────────────────────────────────────── */

export function MarketIntelligenceSection({
  items,
  dailyBrief = null,
  updatedAt,
  onAskPrompt,
  isLoading = false,
  errorMessage = null,
}: MarketIntelligenceSectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const showEmpty = !isLoading && !errorMessage && items.length === 0;
  const activeExpandedId = expandedId ?? items[0]?.id ?? null;

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
          <h2 className="text-[15px] font-semibold text-white">Market Radar</h2>
          {updatedLabel && (
            <span className="text-[11px] text-[var(--vt-muted)]">Updated {updatedLabel}</span>
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
          <ul className="border-t border-white/[0.06]">
            {items.map((item) => {
              const isOpen = activeExpandedId === item.id;
              const askPrompt = `${item.title} — what does this mean for my trades today?`;

              return (
                <li key={item.id} className="border-b border-white/[0.05] last:border-0">
                  {/* Row header — always visible, click to toggle */}
                  <button
                    type="button"
                    onClick={() => setExpandedId(isOpen ? null : item.id)}
                    className="flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-white/[0.02]"
                  >
                    <span className="min-w-0 flex-1 text-[15px] font-normal leading-snug text-white/95">
                      {item.title}
                    </span>
                    <ChevronDown
                      className={cn(
                        "mt-1 size-4 shrink-0 text-[var(--vt-muted)] transition-transform duration-200",
                        isOpen && "rotate-180",
                      )}
                      aria-hidden
                    />
                  </button>

                  {/* Expanded body */}
                  {isOpen && (
                    <div className="px-5 pb-4">
                      {item.summary && (
                        <p className="mb-4 text-sm leading-relaxed text-[var(--vt-muted)]">
                          {item.summary}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => onAskPrompt?.(askPrompt)}
                        className="text-xs font-bold text-[var(--vt-coral)] transition-colors hover:text-white"
                      >
                        Ask about this →
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* Footer */}
        {!isLoading && !errorMessage && items.length > 0 && (
          <div className="border-t border-white/[0.05]">
            <p className="px-5 py-3 text-[11px] font-semibold text-[var(--vt-muted)]">
              {items.length} market sources scanned
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
