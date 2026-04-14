"use client";

import { TrendingDown, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MarketTile } from "@/lib/markets/markets-page-data";

import {
  marketCardLiftHoverClass,
  marketCardSurfaceClass,
  marketCardUnselectedHoverClass,
} from "./market-card-styles";
import { MarketSparkline } from "./market-sparkline";

function venueChipClass(venue: string) {
  switch (venue) {
    case "COMMODITY":
      return "border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.08)] text-[var(--vt-amber)]";
    case "CRYPTO":
      return "border-[rgba(168,85,247,0.3)] bg-[rgba(168,85,247,0.08)] text-purple-300";
    case "FOREX":
      return "border-[rgba(76,110,245,0.3)] bg-[rgba(76,110,245,0.08)] text-[var(--vt-blue)]";
    case "INDEX":
      return "border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.08)] text-[var(--vt-green)]";
    default:
      return "border-white/10 bg-white/[0.04] text-[var(--vt-muted)]";
  }
}

export function MarketCard({
  market,
  isSelected,
  onSelect,
}: {
  market: MarketTile;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const tone =
    market.changePercent.startsWith("-") || market.changeValue.startsWith("-")
      ? "down"
      : "up";
  const TrendIcon = tone === "up" ? TrendingUp : TrendingDown;

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onSelect}
      aria-label={`Open ${market.title} market card`}
      className={cn(
        marketCardSurfaceClass(isSelected),
        marketCardLiftHoverClass,
        !isSelected && marketCardUnselectedHoverClass,
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-3 p-4 pb-0">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold tracking-tight text-white">{market.title}</div>
          <div className="mt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--vt-muted)]">
            {market.symbol}
          </div>
        </div>
        <div className="shrink-0 text-right tabular-nums">
          <div className="text-lg font-black tracking-[-0.04em] text-white">{market.price}</div>
          <div
            className={cn(
              "mt-0.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold",
              tone === "up" ? "bg-[rgba(34,197,94,0.12)] text-[var(--vt-green)]" : "bg-[rgba(242,109,109,0.12)] text-[var(--vt-coral)]",
            )}
          >
            <TrendIcon className="size-3" aria-hidden />
            {market.changePercent}
          </div>
        </div>
      </div>

      <div className="mt-2 min-w-0 w-full overflow-hidden px-3">
        <div className="rounded-xl border border-white/[0.05] bg-black/20 px-1.5 py-1.5">
          <MarketSparkline values={market.sparkline} tone={tone} compact />
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/[0.06] px-4 py-3 text-[11px]">
        <span className={cn("rounded-md border px-2 py-0.5 font-semibold uppercase tracking-wider", venueChipClass(market.venue))}>
          {market.venue}
        </span>
        <span
          className={cn(
            "font-semibold tabular-nums",
            tone === "up" ? "text-[var(--vt-green)]" : "text-[var(--vt-coral)]",
          )}
        >
          {market.changeValue}
        </span>
      </div>
    </Button>
  );
}
