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
  const isUp = data.isUp;
  const lineColor = isUp ? "#34d399" : "#fb7185";
  const gradientId = `grad-${data.symbol.replace(/[^a-zA-Z0-9]/g, "")}`;
  const sparklinePath = buildSparklinePath(data.sparkline, 220, 52);
  const DirectionIcon = isUp ? ArrowUpRight : ArrowDownRight;
  const hasPrice = data.price > 0;
  const title = data.symbol.includes("/") ? data.symbol : data.name;

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex min-h-[120px] min-w-0 flex-col overflow-hidden rounded-xl border px-3.5 pb-2.5 pt-3.5 text-left transition-all",
        "border-white/[0.07] bg-[var(--vt-card)] hover:border-white/[0.13] hover:bg-white/[0.04]",
        isSelected && "border-[var(--vt-coral)]/45 ring-1 ring-[var(--vt-coral)]/20",
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white/95 sm:text-base">{title}</p>
          <p className="mt-0.5 truncate text-xs font-medium text-[var(--vt-muted)] sm:text-sm">
            {formatPrice(data.symbol, data.price)}
          </p>
        </div>
        <div className={cn("shrink-0 text-right", isUp ? "text-emerald-400" : "text-rose-400")}>
          <div className="flex items-center justify-end gap-0.5 text-sm font-bold sm:text-base">
            <DirectionIcon className="size-3.5" strokeWidth={2.5} aria-hidden />
            {hasPrice ? formatChange(data.percent_change) : "—"}
          </div>
          <div className="mt-0.5 text-[11px] font-medium text-[var(--vt-muted)]">
            {hasPrice ? formatAbsoluteChange(data.symbol, data.change) : "—"}
          </div>
        </div>
      </div>

      <div className="mt-auto h-[52px] w-full pt-2">
        {sparklinePath ? (
          <svg viewBox="0 0 220 52" className="h-full w-full" preserveAspectRatio="none" aria-hidden>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lineColor} stopOpacity="0.22" />
                <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
              </linearGradient>
            </defs>
            <line x1="0" y1="34" x2="220" y2="34" stroke="rgba(255,255,255,0.14)" strokeDasharray="3 3" />
            <path d={`${sparklinePath} L 220 52 L 0 52 Z`} fill={`url(#${gradientId})`} />
            <path
              d={sparklinePath}
              fill="none"
              stroke={lineColor}
              strokeWidth="2"
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
