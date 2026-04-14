"use client";

import { Activity, TrendingDown, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";
import type { MarketsAssetPayload } from "@/lib/markets/dashboard";
import {
  formatSourceLabel,
  type MarketTile,
} from "@/lib/markets/markets-page-data";

import { MarketSparkline } from "./market-sparkline";

export type MarketsAccessTier = "loading" | "signed_out" | "free" | "pro";

export function MarketFocusPanel({
  market,
  selectedAsset,
  selectedTone,
  selectedProxyAssumption,
  accessTier,
}: {
  market: MarketTile;
  selectedAsset: MarketsAssetPayload | undefined;
  selectedTone: "up" | "down";
  selectedProxyAssumption: string | null;
  accessTier: MarketsAccessTier;
}) {
  const TrendIcon = selectedTone === "up" ? TrendingUp : TrendingDown;

  return (
    <div
      className="min-w-0 rounded-[28px] border border-[color:var(--vt-border)] bg-gradient-to-b from-[var(--vt-card)] to-[rgba(15,19,64,0.6)] p-5 shadow-[0_24px_60px_rgba(10,13,46,0.32)] sm:p-6"
      data-testid="market-focus-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--vt-muted)]">
            <Activity className="size-3" aria-hidden />
            Focus Panel
          </div>
          <h3 className="mt-2 text-2xl font-black tracking-[-0.05em] text-white">
            {market.title}
          </h3>
          <div className="mt-1 text-sm font-semibold text-[var(--vt-muted)]">
            {market.symbol} · {market.venue}
          </div>
          {accessTier === "pro" && selectedAsset?.quote?.asset ? (
            <div className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-[var(--vt-muted)]">
              {selectedAsset.quote.asset}
            </div>
          ) : null}
        </div>

        <div className="text-right">
          <div className="text-3xl font-black tracking-[-0.06em] text-white">{market.price}</div>
          <div className={cn("mt-2 inline-flex items-center gap-1.5 text-sm font-bold", selectedTone === "up" ? "text-[var(--vt-green)]" : "text-[var(--vt-coral)]")}>
            <TrendIcon className="size-4" aria-hidden />
            {market.changePercent}
            <span className="text-[var(--vt-muted)]">({market.changeValue})</span>
          </div>
        </div>
      </div>

      <p className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm leading-7 text-slate-300">
        {market.summary}
      </p>

      {accessTier === "pro" ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--vt-muted)]">
          <span className="inline-flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-[var(--vt-green)] animate-pulse" />
            {market.updatedLabel}
          </span>
          <span>{formatSourceLabel(selectedAsset)}</span>
          <span>{market.periodLabel.replace(/^over /, "Window: ")}</span>
        </div>
      ) : null}

      {selectedProxyAssumption ? (
        <div className="mt-4 rounded-2xl border border-[rgba(76,110,245,0.24)] bg-[rgba(76,110,245,0.08)] px-4 py-3 text-sm text-slate-200">
          {selectedProxyAssumption}
        </div>
      ) : null}

      <div className="mt-5 rounded-[24px] border border-[color:var(--vt-border)] bg-gradient-to-b from-white/[0.03] to-transparent p-4 sm:p-5">
        <div className={cn("flex items-center gap-2 text-sm font-bold", selectedTone === "up" ? "text-[var(--vt-green)]" : "text-[var(--vt-coral)]")}>
          <TrendIcon className="size-4" aria-hidden />
          {market.periodReturn} {market.periodLabel}
        </div>
        <div className="mt-4 -mx-1 sm:-mx-0.5">
          <MarketSparkline values={market.sparkline} tone={selectedTone} />
        </div>
      </div>

      {market.errorMessage ? (
        <div className="mt-5 rounded-2xl border border-[rgba(242,109,109,0.28)] bg-[rgba(242,109,109,0.08)] px-4 py-3 text-sm text-slate-200">
          {market.errorMessage}
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {market.stats.map((stat) => (
          <div
            key={`${market.id}-${stat.label}`}
            className="rounded-2xl border border-[color:var(--vt-border)] bg-gradient-to-b from-white/[0.04] to-transparent px-4 py-3 transition-colors hover:border-white/[0.12]"
          >
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--vt-muted)]">
              {stat.label}
            </div>
            <div className="mt-1 text-sm font-semibold text-white">{stat.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
