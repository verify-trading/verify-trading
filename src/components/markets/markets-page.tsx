"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

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

import { MarketsChartsSection } from "./markets-charts-section";
import { MarketsCommunityCtas } from "./markets-community-ctas";
import { MarketsTabUpcoming } from "./markets-tab-upcoming";
import { MarketsViewTabs, type MarketsTabId } from "./markets-view-tabs";

const MARKETS_QUERY_STALE_MS = 15 * 60_000;

/**
 * Non-Pro paywall overlay + content blur. When `NEXT_PUBLIC_MARKETS_PAYWALL_UI_ENABLED` is the string `"false"`,
 * the overlay is hidden so you can preview the page (restart dev server after changing `.env.local`).
 * Omit or set to `true` in production.
 */
function isMarketsPaywallUiEnabled(): boolean {
  return process.env.NEXT_PUBLIC_MARKETS_PAYWALL_UI_ENABLED !== "false";
}

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
  const [selectedId, setSelectedId] = useState<string>(marketCatalog[0]?.id ?? "gold");
  const [timeframe] = useState<MarketsTimeframe>(MARKETS_TIMEFRAMES[1] ?? "1W");
  const [activeTab, setActiveTab] = useState<MarketsTabId>("charts");

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
  const showPaywallUi = !isPro && isMarketsPaywallUiEnabled();
  const showFetchError = isPro && marketsQuery.isError;
  const statusShowsLive = isPro && !showSkeleton && !marketsQuery.isFetching;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(76,110,245,0.14),transparent_36%),var(--vt-navy)]">
        <main className="mx-auto w-full max-w-7xl px-4 pb-[max(7rem,calc(env(safe-area-inset-bottom,0px)+2rem))] pt-6 sm:px-6 lg:px-8">
          <h1 className="sr-only">Markets</h1>

          <section>
            <div
              className={cn(
                "transition-[filter,opacity]",
                showPaywallUi &&
                  "pointer-events-none select-none blur-[1.5px] opacity-[0.88] saturate-[0.85] sm:blur-[2.5px]",
              )}
            >
              <MarketsViewTabs activeTab={activeTab} onTabChange={setActiveTab}>
                {activeTab === "charts" ? (
                  <MarketsChartsSection
                    showFetchError={showFetchError}
                    showSkeleton={showSkeleton}
                    statusShowsLive={statusShowsLive}
                    selectedMarket={selectedMarket}
                    selectedId={selectedId}
                    onSelectMarket={setSelectedId}
                    tiles={tiles}
                    selectedCatalogItem={selectedCatalogItem}
                    selectedAsset={selectedAsset}
                    selectedTone={selectedTone}
                    selectedProxyAssumption={selectedProxyAssumption}
                    accessTier={accessTier}
                    isPro={isPro}
                    marketsQuery={marketsQuery}
                  />
                ) : activeTab === "intelligence" ? (
                  <MarketsTabUpcoming kind="intelligence" />
                ) : (
                  <MarketsTabUpcoming kind="calendar" />
                )}
              </MarketsViewTabs>

              <MarketsCommunityCtas />
            </div>
          </section>
        </main>
      </div>

      {showPaywallUi ? (
        <div className="pointer-events-auto absolute inset-0 z-10 flex min-h-0 flex-col overflow-y-auto">
          <div className="absolute inset-0 bg-(--vt-navy)/72 backdrop-blur-[2px]" aria-hidden />
          <div className="relative flex flex-1 items-center justify-center px-3 py-4 sm:px-5 sm:py-6 lg:px-6">
            <div className="w-full max-w-sm rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[rgba(8,11,42,0.72)] px-3 py-4 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:max-w-lg sm:px-5 sm:py-5 lg:max-w-2xl lg:px-6 lg:py-6">
              <ProPlansPricingPanel
                density="compact"
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
