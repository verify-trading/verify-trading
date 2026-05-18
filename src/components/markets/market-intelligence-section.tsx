"use client";

import {
  ChevronDown,
  Newspaper,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Coins,
  Droplet,
  Globe,
  Sparkles,
  Compass,
  Activity,
} from "lucide-react";
import { useState } from "react";

import type { DailyMarketBrief, MarketIntelligenceItem } from "@/lib/markets/market-intelligence";
import { cn } from "@/lib/utils";

type DailyBriefAssetChip = {
  label: string;
  data: DailyMarketBrief["gold"];
};

function hasDailyBriefAsset(
  asset: { label: string; data?: DailyBriefAssetChip["data"] },
): asset is DailyBriefAssetChip {
  return Boolean(asset.data);
}

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

function getAssetIcon(label: string) {
  const norm = label.toLowerCase();
  if (norm.includes("gold")) {
    return <Coins className="size-3.5 text-amber-400" />;
  }
  if (norm.includes("oil")) {
    return <Droplet className="size-3.5 text-sky-400" />;
  }
  if (norm.includes("dxy")) {
    return <Sparkles className="size-3.5 text-emerald-400" />;
  }
  if (norm.includes("eur")) {
    return <Globe className="size-3.5 text-indigo-400" />;
  }
  if (norm.includes("gbp")) {
    return <Compass className="size-3.5 text-purple-400" />;
  }
  if (norm.includes("jpy")) {
    return <Activity className="size-3.5 text-rose-400" />;
  }
  return <Globe className="size-3.5 text-teal-400" />;
}

function getBiasTheme(bias: string) {
  const norm = bias.toLowerCase();
  if (norm.includes("bull")) {
    return {
      text: "Bullish",
      colorClass: "text-emerald-400",
      pillClass: "bg-emerald-500/[0.04] hover:bg-emerald-500/[0.08] border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400 hover:scale-[1.02] shadow-[0_0_8px_rgba(16,185,129,0.01)]",
      icon: <TrendingUp className="size-3 text-emerald-400" />,
    };
  }
  if (norm.includes("bear")) {
    return {
      text: "Bearish",
      colorClass: "text-rose-400",
      pillClass: "bg-rose-500/[0.04] hover:bg-rose-500/[0.08] border-rose-500/20 hover:border-rose-500/40 text-rose-400 hover:scale-[1.02] shadow-[0_0_8px_rgba(244,63,94,0.01)]",
      icon: <TrendingDown className="size-3 text-rose-400" />,
    };
  }
  return {
    text: "Neutral",
    colorClass: "text-white/50",
    pillClass: "bg-white/[0.02] hover:bg-white/[0.04] border-white/10 hover:border-white/25 text-white/70 hover:scale-[1.02]",
    icon: <ArrowRight className="size-3 text-white/40" />,
  };
}

function DailyBriefCard({
  brief,
  onAskPrompt,
}: {
  brief: DailyMarketBrief;
  onAskPrompt?: (prompt: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const shouldCollapse = brief.overview.length > 300;

  const assets = [
    { label: "Gold", data: brief.gold },
    { label: "Oil", data: brief.oil },
    { label: "DXY", data: brief.dxy },
    { label: "USD/JPY", data: brief.usdjpy },
    { label: "EUR/USD", data: brief.eurusd },
    { label: "GBP/USD", data: brief.gbpusd },
  ].filter(hasDailyBriefAsset);

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
      <div className="mt-3">
        <p className={cn("text-sm leading-relaxed text-white/75", shouldCollapse && !expanded && "line-clamp-3")}>
          {brief.overview}
        </p>
        {shouldCollapse && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="mt-1 text-xs font-semibold text-[var(--vt-green)] transition-colors hover:text-white"
          >
            {expanded ? "Show less" : "Read more"}
          </button>
        )}
      </div>

      {/* Assets Pills wrapping list */}
      <div className="mt-4 flex flex-wrap gap-2">
        {assets.map(({ label, data }) => {
          const theme = getBiasTheme(data.bias);
          const assetIcon = getAssetIcon(label);

          return (
            <button
              key={label}
              type="button"
              onClick={() =>
                onAskPrompt?.(
                  `Tactical breakdown for ${label} today. Level is ${data.level}. Bias is ${data.bias}. Verdict: "${data.verdict}". What should I focus on first?`,
                )
              }
              className={cn(
                "group inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold cursor-pointer transition-all duration-200",
                theme.pillClass,
              )}
              title={`${label}: ${data.bias} (${data.verdict})`}
            >
              <span className="shrink-0">{assetIcon}</span>
              <span className="text-white/80 font-bold uppercase text-[9px] tracking-wide">{label}</span>
              <span className="h-2.5 w-[1px] bg-white/10 shrink-0" />
              <span className="font-extrabold text-white text-[10px] sm:text-[11px] tabular-nums">{data.level}</span>
              <span className="shrink-0 ml-0.5">{theme.icon}</span>
            </button>
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
                const isExpanded = expandedId === item.id;
                const askPrompt = `${item.title} — what does this mean for my trades today?`;

                return (
                  <li key={item.id} className="border-b border-white/[0.05] last:border-0">
                    <div className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        className="flex w-full items-start justify-between gap-3 text-left"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="block text-[15px] font-normal leading-snug text-white/95">
                            {item.title}
                          </span>
                          <span className="mt-1.5 block text-[11px] font-medium text-[var(--vt-muted)]" suppressHydrationWarning>
                            {item.source} · {formatRelativeTime(item.publishedAt)}
                            {item.category ? ` · ${item.category}` : ""}
                          </span>
                        </div>
                        <ChevronDown
                          className={cn(
                            "size-4 shrink-0 text-white/40 transition-transform duration-200",
                            isExpanded && "rotate-180"
                          )}
                          aria-hidden
                        />
                      </button>

                      {isExpanded && (
                        <div className="mt-3">
                          {item.summary && (
                            <p className="text-sm leading-relaxed text-white/70">{item.summary}</p>
                          )}
                          <button
                            type="button"
                            onClick={() => onAskPrompt?.(askPrompt)}
                            className="mt-3 text-xs font-bold text-[var(--vt-coral)] transition-colors hover:text-white"
                          >
                            Ask about this →
                          </button>
                        </div>
                      )}
                    </div>
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
