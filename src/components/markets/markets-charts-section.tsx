"use client";

import { RefreshCcw } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import type { MarketsAccessTier } from "@/lib/markets/markets-access-tier";
import type { MarketsAssetPayload } from "@/lib/markets/dashboard";
import { marketCatalog, type MarketCatalogItem, type MarketTile } from "@/lib/markets/markets-page-data";

import { MarketCard } from "./market-card";
import { MarketFocusPanel } from "./market-focus-panel";
import { MarketCardSkeleton, MarketFocusPanelSkeleton } from "./markets-skeletons";

export type MarketsChartsSectionProps = {
  showFetchError: boolean;
  showSkeleton: boolean;
  statusShowsLive: boolean;
  selectedMarket: MarketTile;
  selectedId: string;
  onSelectMarket: (id: string) => void;
  tiles: MarketTile[];
  selectedCatalogItem: MarketCatalogItem;
  selectedAsset: MarketsAssetPayload | undefined;
  selectedTone: "up" | "down";
  selectedProxyAssumption: string | null;
  accessTier: MarketsAccessTier;
  isPro: boolean;
  marketsQuery: Pick<UseQueryResult, "refetch" | "isFetching">;
};

export function MarketsChartsSection({
  showFetchError,
  showSkeleton,
  statusShowsLive,
  selectedMarket,
  selectedId,
  onSelectMarket,
  tiles,
  selectedCatalogItem,
  selectedAsset,
  selectedTone,
  selectedProxyAssumption,
  accessTier,
  isPro,
  marketsQuery,
}: MarketsChartsSectionProps) {
  return (
    <>
      <header className="mb-8 border-b border-white/[0.08] pb-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--vt-coral)]">Markets</p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">Top assets</h2>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-[var(--vt-muted)]">
              Select a symbol for levels, trend, and live session context.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pt-1">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--vt-border)] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-[var(--vt-muted)]">
              {statusShowsLive ? (
                <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-[var(--vt-green)]" />
              ) : null}
              {showSkeleton ? "Loading live data…" : selectedMarket.updatedLabel}
            </div>
            <Button
              type="button"
              variant="outline"
              size="pillCompact"
              className="gap-2 border-[color:var(--vt-border)] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => {
                void marketsQuery.refetch();
              }}
              disabled={!isPro || marketsQuery.isFetching}
            >
              <RefreshCcw className={`size-3.5 ${marketsQuery.isFetching ? "animate-spin" : ""}`} aria-hidden />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {showFetchError ? (
        <div className="mb-4 rounded-2xl border border-[rgba(242,109,109,0.28)] bg-[rgba(242,109,109,0.08)] px-4 py-3 text-sm text-slate-200">
          Live market data is unavailable right now. The layout is still visible, but the feed could not be refreshed.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start">
        <div
          className="grid min-w-0 auto-rows-auto grid-cols-1 gap-4 self-start sm:grid-cols-2 xl:grid-cols-3"
          data-testid="market-cards-grid"
        >
          {showSkeleton
            ? marketCatalog.map((item) => (
                <MarketCardSkeleton
                  key={item.id}
                  item={item}
                  isSelected={item.id === selectedId}
                  onSelect={() => onSelectMarket(item.id)}
                />
              ))
            : tiles.map((market) => (
                <MarketCard
                  key={market.id}
                  market={market}
                  isSelected={market.id === selectedMarket.id}
                  onSelect={() => onSelectMarket(market.id)}
                />
              ))}
        </div>

        {showSkeleton ? (
          <MarketFocusPanelSkeleton item={selectedCatalogItem} />
        ) : (
          <MarketFocusPanel
            market={selectedMarket}
            selectedAsset={selectedAsset}
            selectedTone={selectedTone}
            selectedProxyAssumption={selectedProxyAssumption}
            accessTier={accessTier}
          />
        )}
      </div>
    </>
  );
}
