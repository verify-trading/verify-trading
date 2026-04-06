"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { SiteNav } from "@/components/site/site-nav";
import {
  MARKETS_TIMEFRAMES,
  type MarketsSnapshot,
  type MarketsTimeframe,
  formatAssetPrice,
  formatChangePercent,
} from "@/lib/markets/dashboard";

function Sparkline({ points, up }: { points: number[]; up: boolean }) {
  const width = 260;
  const height = 96;
  const top = 8;
  const innerWidth = width;
  const innerHeight = height - top * 2;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const path = points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * innerWidth;
      const y = top + innerHeight - ((point - min) / range) * innerHeight;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" aria-hidden>
      <path
        d={path}
        fill="none"
        stroke={up ? "var(--vt-green)" : "var(--vt-coral)"}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

async function fetchMarkets(timeframe: MarketsTimeframe): Promise<MarketsSnapshot> {
  const response = await fetch(`/api/markets?timeframe=${timeframe}`);
  if (!response.ok) {
    throw new Error(`Markets request failed (${response.status}).`);
  }
  return response.json() as Promise<MarketsSnapshot>;
}

export function MarketsPage() {
  const [timeframe, setTimeframe] = useState<MarketsTimeframe>("1W");

  const { data: snapshot, error, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["markets", timeframe],
    queryFn: () => fetchMarkets(timeframe),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    placeholderData: (prev) => prev,
  });

  const updatedLabel = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;

  return (
    <div className="min-h-screen bg-[var(--vt-navy)] text-white">
      <SiteNav />
      <main className="mx-auto w-full max-w-6xl px-4 pb-10 pt-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {MARKETS_TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={[
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                  timeframe === tf
                    ? "bg-[var(--vt-blue)] text-white shadow-[0_8px_24px_rgba(76,110,245,0.35)]"
                    : "bg-white/[0.06] text-[var(--vt-muted)] hover:bg-white/[0.1] hover:text-white",
                ].join(" ")}
              >
                {tf}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-[var(--vt-muted)]">
            {isLoading ? "Updating…" : updatedLabel ? `Updated ${updatedLabel}` : null}
          </span>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-[var(--vt-coral)]/40 bg-[rgba(242,109,109,0.08)] px-4 py-3 text-sm text-red-100">
            {error instanceof Error ? error.message : "Could not load markets."}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {snapshot?.assets.map((asset) => (
            <MarketCard key={asset.id} asset={asset} />
          ))}
          {!snapshot && !error
            ? Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={`sk-${index}`}
                  className="animate-pulse rounded-[28px] border border-[color:var(--vt-border)] bg-[var(--vt-card)] p-4"
                >
                  <div className="h-4 w-24 rounded bg-white/10" />
                  <div className="mt-3 h-8 w-32 rounded bg-white/10" />
                  <div className="mt-4 h-24 rounded bg-white/5" />
                </div>
              ))
            : null}
        </div>
      </main>
    </div>
  );
}

function MarketCard({ asset }: { asset: MarketsSnapshot["assets"][number] }) {
  const q = asset.quote;
  const series = asset.series;

  if (!q && (!series || series.closeValues.length < 2)) {
    return (
      <div className="rounded-[28px] border border-[color:var(--vt-border)] bg-[var(--vt-card)] p-4 shadow-[0_18px_48px_rgba(10,13,46,0.28)]">
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-white">{asset.label}</div>
        <p className="mt-3 text-sm text-[var(--vt-coral)]">{asset.error ?? "Insufficient chart data."}</p>
      </div>
    );
  }

  const chartPoints = series && series.closeValues.length >= 2 ? series.closeValues : null;
  const up =
    q != null
      ? q.changePercent >= 0
      : chartPoints != null
        ? chartPoints[chartPoints.length - 1] >= chartPoints[0]
        : true;
  const points = chartPoints ?? [0, 0];

  const fallbackPrice = chartPoints?.[chartPoints.length - 1];
  const displayPrice = q?.price ?? fallbackPrice;
  const priceText =
    displayPrice != null && Number.isFinite(displayPrice)
      ? formatAssetPrice(asset.id, displayPrice)
      : "—";

  const seriesChangePct =
    chartPoints && chartPoints.length >= 2
      ? ((chartPoints[chartPoints.length - 1] - chartPoints[0]) / chartPoints[0]) * 100
      : null;
  const changeText = q
    ? formatChangePercent(q.changePercent)
    : seriesChangePct != null
      ? formatChangePercent(seriesChangePct)
      : null;
  const arrow = up ? "▲" : "▼";

  return (
    <article className="rounded-[28px] border border-[color:var(--vt-border)] bg-[var(--vt-card)] p-4 shadow-[0_18px_48px_rgba(10,13,46,0.28)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-white">{asset.label}</div>
          <div className="mt-1 text-[11px] font-semibold text-[var(--vt-muted)]">{q?.symbol ?? "—"}</div>
          {q?.proxyAssumption ? (
            <p className="mt-1 text-[10px] leading-snug text-[var(--vt-muted)]/90">{q.proxyAssumption}</p>
          ) : null}
        </div>
        <div className="min-w-0 text-right">
          <div className="text-base font-black tracking-[-0.04em] text-white sm:text-lg">{priceText}</div>
          {changeText ? (
            <div className={`text-sm font-bold ${up ? "text-[var(--vt-green)]" : "text-[var(--vt-coral)]"}`}>
              <span aria-hidden>{arrow} </span>
              {changeText}
            </div>
          ) : null}
          {q?.isMarketOpen === false ? (
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--vt-muted)]">
              Market closed
            </div>
          ) : null}
        </div>
      </div>
      {asset.error && q ? (
        <p className="mt-2 text-[11px] leading-snug text-[var(--vt-coral)]/90">{asset.error}</p>
      ) : null}
      <div className="mt-4 border-t border-[color:var(--vt-border)] pt-4">
        {chartPoints ? (
          <Sparkline points={points} up={up} />
        ) : (
          <p className="text-xs text-[var(--vt-muted)]">Chart unavailable for this range.</p>
        )}
      </div>
    </article>
  );
}
