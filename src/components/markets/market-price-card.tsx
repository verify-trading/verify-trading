"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";

import {
  buildSparklinePath,
  formatAbsoluteChange,
  formatChange,
  formatPrice,
  type MarketCardData,
} from "@/lib/markets/twelve-markets-data";

export function MarketPriceCard({
  data,
  isSelected,
  onClick,
}: {
  data: MarketCardData;
  isSelected: boolean;
  onClick: () => void;
}) {
  const colorClass = data.isUp ? "text-emerald-400" : "text-rose-400";
  const lineColor = data.isUp ? "#34d399" : "#fb7185";
  const gradientId = `grad-${data.symbol.replace(/[^a-zA-Z0-9]/g, "")}`;
  const sparklinePath = buildSparklinePath(data.sparkline, 220, 58);
  const DirectionIcon = data.isUp ? ArrowUpRight : ArrowDownRight;
  const hasPrice = data.price > 0;
  const title = data.symbol.includes("/") ? data.symbol : data.name;

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex min-h-[148px] min-w-0 flex-col overflow-hidden rounded-2xl border px-4 pb-3 pt-4 text-left transition-all sm:min-h-[156px]",
        "border-white/[0.07] bg-[linear-gradient(180deg,var(--vt-card),rgba(15,19,64,0.72))] shadow-[0_10px_32px_rgba(0,0,0,0.18)] hover:border-white/[0.14] hover:bg-white/[0.04]",
        isSelected && "border-[var(--vt-coral)]/45 ring-1 ring-[var(--vt-coral)]/25",
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-white/90 sm:text-lg">
            {title}
          </p>
          <p className="mt-1 truncate text-sm font-medium text-[var(--vt-muted)] sm:text-base">
            {formatPrice(data.symbol, data.price)}
          </p>
        </div>
        <div className={cn("shrink-0 text-right", colorClass)}>
          <div className="flex items-center justify-end gap-1 text-base font-semibold sm:text-lg">
            <DirectionIcon className="size-4" strokeWidth={2.4} aria-hidden />
            {hasPrice ? formatChange(data.percent_change) : "—"}
          </div>
          <div className="mt-1 text-sm font-medium text-[var(--vt-muted)]">
            {hasPrice ? formatAbsoluteChange(data.symbol, data.change) : "—"}
          </div>
        </div>
      </div>

      <div className="mt-auto h-[58px] w-full pt-2">
        {sparklinePath ? (
          <svg viewBox="0 0 220 58" className="h-full w-full" preserveAspectRatio="none" aria-hidden>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lineColor} stopOpacity="0.28" />
                <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
              </linearGradient>
            </defs>
            <line x1="0" y1="44" x2="220" y2="44" stroke="rgba(255,255,255,0.2)" strokeDasharray="4 4" />
            <path
              d={`${sparklinePath} L 220 58 L 0 58 Z`}
              fill={`url(#${gradientId})`}
            />
            <path
              d={sparklinePath}
              fill="none"
              stroke={lineColor}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="text-[10px] text-[var(--vt-muted)]">No data</span>
          </div>
        )}
      </div>
    </button>
  );
}
