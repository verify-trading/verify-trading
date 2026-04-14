"use client";

import { useQuery } from "@tanstack/react-query";
import { RefreshCcw } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { ProPlansPricingPanel } from "@/components/pricing/pro-plans-pricing-panel";
import { useAccountMenuQuery } from "@/lib/auth/use-account-menu-query";
import type { PublicBillingPricing } from "@/lib/billing/config";
import type { PricingPageBillingContext } from "@/lib/billing/pricing-page-data";
import { deriveMarketsAccessTier } from "@/lib/markets/derive-markets-access-tier";
import type { MarketsAccessTier } from "@/lib/markets/markets-access-tier";
import type { MarketsAssetPayload } from "@/lib/markets/dashboard";
import { MARKETS_TIMEFRAMES, type MarketsTimeframe } from "@/lib/markets/dashboard";
import {
  buildTile,
  fetchMarketsSnapshot,
  lockedMockTiles,
  marketCatalog,
  readProxyAssumption,
  toneFromNumber,
  type MarketTile,
} from "@/lib/markets/markets-page-data";
import { cn } from "@/lib/utils";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";

import { MarketCard } from "./market-card";
import { MarketFocusPanel } from "./market-focus-panel";
import { MarketCardSkeleton, MarketFocusPanelSkeleton } from "./markets-skeletons";

const MARKETS_QUERY_STALE_MS = 15 * 60_000;

export type MarketsPageProps = {
  /** From the server so Pro users never see the locked preview flash while auth hydrates. */
  initialTier?: "pro" | "free";
  pricing: PublicBillingPricing;
  billingContext: PricingPageBillingContext | null;
};

function paywallHeadline(tier: MarketsAccessTier): string {
  switch (tier) {
    case "signed_out":
      return "Sign in and upgrade to Pro to unlock Markets.";
    case "loading":
      return "Checking your Markets access.";
    default:
      return "Markets is available on Pro only.";
  }
}

function selectionTone(
  tier: MarketsAccessTier,
  asset: MarketsAssetPayload | undefined,
  market: MarketTile,
): "up" | "down" {
  if (tier === "pro" && asset?.quote?.changePercent !== undefined) {
    return toneFromNumber(asset.quote.changePercent);
  }
  return market.changePercent.startsWith("-") ? "down" : "up";
}

export function MarketsPage({ initialTier, pricing, billingContext }: MarketsPageProps) {
  const { ready, isSignedIn } = useSupabaseAuth();
  const accountMenuQuery = useAccountMenuQuery();
  const [selectedId, setSelectedId] = useState(marketCatalog[0]?.id ?? "gold");
  const [timeframe] = useState<MarketsTimeframe>(MARKETS_TIMEFRAMES[1] ?? "1W");

  const accessTier = useMemo(
    (): MarketsAccessTier =>
      deriveMarketsAccessTier({
        authReady: ready,
        isSignedIn,
        initialTier,
        accountMenu: {
          isError: accountMenuQuery.isError,
          isPending: accountMenuQuery.isPending,
          data: accountMenuQuery.data,
        },
      }),
    [
      ready,
      isSignedIn,
      initialTier,
      accountMenuQuery.isError,
      accountMenuQuery.isPending,
      accountMenuQuery.data,
    ],
  );

  const isPro = accessTier === "pro";

  const marketsQuery = useQuery({
    queryKey: ["markets", timeframe],
    queryFn: () => fetchMarketsSnapshot(timeframe),
    enabled: isPro,
    staleTime: MARKETS_QUERY_STALE_MS,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });

  const assetsById = new Map(marketsQuery.data?.assets.map((asset) => [asset.id, asset]) ?? []);
  const lockedTiles = marketCatalog.map((item) => ({
    ...lockedMockTiles[item.id],
    errorMessage: null,
  }));
  const liveTiles = marketCatalog.map((item) =>
    buildTile(item, assetsById.get(item.id), timeframe, marketsQuery.data?.updatedAt ?? null),
  );
  const tiles = isPro ? liveTiles : lockedTiles;
  const selectedMarket = tiles.find((market) => market.id === selectedId) ?? tiles[0];
  const selectedAsset = assetsById.get(selectedMarket.id);
  const selectedProxyAssumption = readProxyAssumption(selectedAsset);
  const selectedTone = selectionTone(accessTier, selectedAsset, selectedMarket);
  const selectedCatalogItem = marketCatalog.find((item) => item.id === selectedId) ?? marketCatalog[0]!;

  const showSkeleton = isPro && marketsQuery.isPending;
  const showPaywall = !isPro;
  const showFetchError = isPro && marketsQuery.isError;
  const statusShowsLive = isPro && !showSkeleton && !marketsQuery.isFetching;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(76,110,245,0.14),transparent_36%),var(--vt-navy)]">
        <main className="mx-auto w-full max-w-7xl px-4 pb-[max(7rem,calc(env(safe-area-inset-bottom,0px)+2rem))] pt-6 sm:px-6 lg:px-8">
          <h1 className="sr-only">Markets</h1>

          <section>
            <header className="mb-8 border-b border-white/[0.08] pb-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--vt-coral)]">
                    Markets
                  </p>
                  <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">
                    Top assets
                  </h2>
                  <p className="mt-2 max-w-lg text-sm leading-relaxed text-[var(--vt-muted)]">
                    Select a symbol for levels, trend, and live session context.
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pt-1">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--vt-border)] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-[var(--vt-muted)]">
                    {statusShowsLive ? (
                      <span className="size-1.5 shrink-0 rounded-full bg-[var(--vt-green)] animate-pulse" />
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
                Live market data is unavailable right now. The layout is still visible, but the feed could not be
                refreshed.
              </div>
            ) : null}

            <div
              className={cn(
                "grid gap-4 transition-[filter,opacity] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start",
                showPaywall &&
                  "pointer-events-none select-none blur-[1.5px] opacity-[0.88] saturate-[0.85] sm:blur-[2.5px]",
              )}
            >
              <div
                className="min-w-0 self-start grid auto-rows-auto grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
                data-testid="market-cards-grid"
              >
                {showSkeleton
                  ? marketCatalog.map((item) => (
                      <MarketCardSkeleton
                        key={item.id}
                        item={item}
                        isSelected={item.id === selectedId}
                        onSelect={() => setSelectedId(item.id)}
                      />
                    ))
                  : tiles.map((market) => (
                      <MarketCard
                        key={market.id}
                        market={market}
                        isSelected={market.id === selectedMarket.id}
                        onSelect={() => setSelectedId(market.id)}
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
          </section>
        </main>
      </div>

      {showPaywall ? (
        <div className="pointer-events-auto absolute inset-0 z-10 flex min-h-0 flex-col overflow-y-auto">
          <div className="absolute inset-0 bg-[var(--vt-navy)]/72 backdrop-blur-[2px]" aria-hidden />
          <div className="relative flex flex-1 items-center justify-center px-4 py-6 sm:px-6">
            <div className="w-full max-w-3xl rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[rgba(8,11,42,0.72)] px-4 py-6 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:px-6 sm:py-7">
              <ProPlansPricingPanel
                pricing={pricing}
                billingContext={billingContext}
                headline={paywallHeadline(accessTier)}
                subtext="Upgrade to Pro for live market data, full Markets access, and unlimited Ask chats."
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
