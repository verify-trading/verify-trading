"use client";

import type { MarketIntelligenceItem } from "@/lib/markets/market-intelligence";
import { cn } from "@/lib/utils";

export type MarketIntelligenceSectionProps = {
  items: readonly MarketIntelligenceItem[];
  isLoading?: boolean;
  errorMessage?: string | null;
};

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  if (!Number.isFinite(ms) || ms < 0) {
    return "now";
  }
  const min = Math.floor(ms / 60_000);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (min < 1) {
    return "just now";
  }
  if (min < 60) {
    return `${min}m ago`;
  }
  if (hr < 24) {
    return `${hr}h ago`;
  }
  if (day < 7) {
    return `${day}d ago`;
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(d);
}

function inferTag(item: MarketIntelligenceItem): string {
  if (item.tag?.trim()) {
    return item.tag.trim().toUpperCase();
  }
  const t = `${item.title} ${item.source}`.toLowerCase();
  if (/\bbitcoin\b|\bbtc\b/.test(t)) {
    return "BTC";
  }
  if (/\bgold\b|\bxau\b/.test(t)) {
    return "GOLD";
  }
  if (/\boil\b|\bcrude\b|\bbrent\b|\bwti\b/.test(t)) {
    return "OIL";
  }
  if (/\bnfp\b|\bnon-?farm\b/.test(t)) {
    return "NFP";
  }
  if (/\bfed\b|\bpowell\b|\binterest rate\b/.test(t)) {
    return "FED";
  }
  return "NEWS";
}

function badgeClass(tag: string): string {
  const u = tag.toUpperCase();
  if (u === "GOLD" || u === "OIL") {
    return "border border-emerald-500/25 bg-emerald-950/70 text-emerald-300";
  }
  if (u === "NFP" || u === "FED") {
    return "border border-white/10 bg-[var(--vt-card-alt)] text-[var(--vt-muted)]";
  }
  if (u === "BTC") {
    return "border border-rose-500/30 bg-rose-950/55 text-rose-200";
  }
  return "border border-white/10 bg-white/[0.06] text-[var(--vt-muted)]";
}

export function MarketIntelligenceSection({
  items,
  isLoading = false,
  errorMessage = null,
}: MarketIntelligenceSectionProps) {
  const showEmpty = !isLoading && !errorMessage && items.length === 0;

  const panelClass = cn(
    "overflow-hidden rounded-[28px] border border-[color:var(--vt-border)]",
    "bg-gradient-to-b from-[var(--vt-card)] to-[rgba(15,19,64,0.6)]",
    "shadow-[0_24px_60px_rgba(10,13,46,0.32)]",
  );

  return (
    <div className="min-w-0">
      <div className={panelClass}>
        <div className="border-b border-white/[0.06] px-5 py-4 sm:px-6">
          <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--vt-muted)]">
            <span className="size-2 shrink-0 rounded-full bg-[var(--vt-green)]" aria-hidden />
            Market intelligence
          </h2>
        </div>

        {errorMessage ? (
          <p className="px-5 py-8 text-sm text-[var(--vt-coral)] sm:px-6" role="alert">
            {errorMessage}
          </p>
        ) : isLoading ? (
          <ul className="divide-y divide-white/[0.06]" aria-busy="true" aria-label="Loading market intelligence">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
                <div className="h-6 w-14 shrink-0 animate-pulse rounded-md bg-white/10" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3.5 w-full animate-pulse rounded bg-white/10" />
                  <div className="h-3 w-4/5 animate-pulse rounded bg-white/[0.06]" />
                </div>
                <div className="h-3 w-12 shrink-0 animate-pulse rounded bg-white/[0.06]" />
              </li>
            ))}
          </ul>
        ) : showEmpty ? (
          <p className="px-5 py-8 text-sm text-[var(--vt-muted)] sm:px-6">No headlines matched the feed right now.</p>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {items.map((item) => {
              const tag = inferTag(item);
              const time = formatRelativeTime(item.publishedAt);
              const body = (
                <>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center justify-center rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em]",
                      badgeClass(tag),
                    )}
                  >
                    {tag}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-white/95">{item.title}</span>
                  <span className="shrink-0 text-[11px] font-medium tabular-nums text-[var(--vt-muted)]">{time}</span>
                </>
              );

              return (
                <li key={item.id}>
                  {item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-white/[0.03] sm:px-6"
                    >
                      {body}
                    </a>
                  ) : (
                    <div className="flex items-center gap-3 px-5 py-3.5 sm:px-6">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
