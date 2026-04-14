"use client";

import { Activity } from "lucide-react";

import type { MarketCatalogItem } from "@/lib/markets/markets-page-data";
import { cn } from "@/lib/utils";

import { marketCardSurfaceClass } from "./market-card-styles";

export function MarketCardSkeleton({
  item,
  isSelected,
  onSelect,
}: {
  item: MarketCatalogItem;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Loading ${item.title} market card`}
      className={cn(marketCardSurfaceClass(isSelected), "cursor-pointer")}
    >
      <div className="flex min-w-0 items-start justify-between gap-3 p-4 pb-0">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-32 max-w-[85%] animate-pulse rounded-md bg-white/10" />
          <div className="h-3 w-20 animate-pulse rounded-md bg-white/10" />
        </div>
        <div className="shrink-0 space-y-2 text-right">
          <div className="ml-auto h-6 w-[4.5rem] animate-pulse rounded-md bg-white/10" />
          <div className="ml-auto h-5 w-14 animate-pulse rounded-md bg-white/10" />
        </div>
      </div>
      <div className="mt-2 min-w-0 w-full overflow-hidden px-3">
        <div className="min-h-[5.5rem] animate-pulse rounded-xl border border-white/[0.05] bg-white/[0.06] sm:min-h-24" />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/[0.06] px-4 py-3">
        <div className="h-6 w-20 animate-pulse rounded-md bg-white/10" />
        <div className="h-4 w-16 animate-pulse rounded-md bg-white/10" />
      </div>
    </button>
  );
}

export function MarketFocusPanelSkeleton({ item }: { item: MarketCatalogItem }) {
  return (
    <div
      className="min-w-0 rounded-[28px] border border-[color:var(--vt-border)] bg-gradient-to-b from-[var(--vt-card)] to-[rgba(15,19,64,0.6)] p-5 shadow-[0_24px_60px_rgba(10,13,46,0.32)] sm:p-6"
      data-testid="market-focus-panel"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--vt-muted)]">
            <Activity className="size-3" aria-hidden />
            Focus Panel
          </div>
          <h3 className="mt-2 text-2xl font-black tracking-[-0.05em] text-white">{item.title}</h3>
          <div className="mt-1 text-sm font-semibold text-[var(--vt-muted)]">
            {item.symbol} · {item.venue}
          </div>
        </div>
        <div className="space-y-2 text-right">
          <div className="ml-auto h-9 w-28 animate-pulse rounded-md bg-white/10" />
          <div className="ml-auto h-5 w-36 animate-pulse rounded-md bg-white/10" />
        </div>
      </div>
      <div className="mt-5 h-[4.5rem] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.04]" />
      <div className="mt-5 min-h-[11rem] animate-pulse rounded-[24px] border border-[color:var(--vt-border)] bg-white/[0.04] sm:min-h-[13rem]" />
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={`skeleton-stat-${i}`}
            className="rounded-2xl border border-[color:var(--vt-border)] bg-gradient-to-b from-white/[0.04] to-transparent px-4 py-3"
          >
            <div className="h-3 w-16 animate-pulse rounded-md bg-white/10" />
            <div className="mt-2 h-4 w-24 animate-pulse rounded-md bg-white/10" />
          </div>
        ))}
      </div>
    </div>
  );
}
