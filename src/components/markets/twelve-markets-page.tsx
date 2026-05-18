"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ProPlansPricingPanel } from "@/components/pricing/pro-plans-pricing-panel";
import { useAccountMenuQuery } from "@/lib/auth/use-account-menu-query";
import type { PublicBillingPricing } from "@/lib/billing/config";
import type { PricingPageBillingContext } from "@/lib/billing/pricing-page-data";
import { deriveMarketsAccessTier } from "@/lib/markets/derive-markets-access-tier";
import type { MarketsAccessTier } from "@/lib/markets/markets-access-tier";
import {
  buildCategoryCards,
  CATEGORY_CONFIG,
  fetchEconomicCalendar,
  fetchMarketIntelligence,
  fetchTwelveMarketsSnapshot,
  type MarketsCategory,
} from "@/lib/markets/twelve-markets-data";
import { cn } from "@/lib/utils";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";

import { MarketEventsSection } from "./market-events-section";
import { MarketIntelligenceSection } from "./market-intelligence-section";
import { MarketPriceCard } from "./market-price-card";
import { MarketsCommunityCtas } from "./markets-community-ctas";
import { MarketsTabUpcoming } from "./markets-tab-upcoming";
import { MarketsViewTabs, type MarketsTabId } from "./markets-view-tabs";

const CATEGORIES: MarketsCategory[] = ["major_pairs", "commodities", "crypto", "indices"];

const MARKETS_QUERY_STALE_MS = 5 * 60_000;

const ASK_ASSET_NAMES: Record<string, string> = {
  "XAU/USD": "Gold",
  "XAG/USD": "Silver",
  "WTI/USD": "Oil",
  "XBR/USD": "Oil",
  "XPT/USD": "Platinum",
  "XPD/USD": "Palladium",
  QQQ: "Nasdaq",
  DIA: "Dow",
  EWU: "FTSE",
  EWG: "DAX",
  EWJ: "Nikkei",
  EWH: "Hong Kong",
};

function isMarketsPaywallUiEnabled(): boolean {
  return process.env.NEXT_PUBLIC_MARKETS_PAYWALL_UI_ENABLED !== "false";
}

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

export type MarketsPageProps = {
  initialTier?: "pro" | "free";
  pricing: PublicBillingPricing;
  billingContext: PricingPageBillingContext | null;
};

export function TwelveMarketsPage({ initialTier, pricing, billingContext }: MarketsPageProps) {
  const router = useRouter();
  const { ready, isSignedIn } = useSupabaseAuth();
  const accountMenuQuery = useAccountMenuQuery();
  const [activeCategory, setActiveCategory] = useState<MarketsCategory>("major_pairs");
  const [activeTab, setActiveTab] = useState<MarketsTabId>("charts");

  const accessTier = deriveMarketsAccessTier({
    authReady: ready,
    isSignedIn,
    initialTier,
    accountMenu: {
      isError: accountMenuQuery.isError,
      isPending: accountMenuQuery.isPending,
      data: accountMenuQuery.data,
    },
  });

  const isPro = accessTier === "pro";

  const marketsQuery = useQuery({
    queryKey: ["twelve-markets"],
    queryFn: fetchTwelveMarketsSnapshot,
    enabled: isPro,
    staleTime: MARKETS_QUERY_STALE_MS,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });

  const calendarQuery = useQuery({
    queryKey: ["twelve-calendar"],
    queryFn: fetchEconomicCalendar,
    enabled: isPro,
    staleTime: MARKETS_QUERY_STALE_MS,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });

  const intelligenceQuery = useQuery({
    queryKey: ["market-intelligence"],
    queryFn: fetchMarketIntelligence,
    enabled: isPro && (activeTab === "charts" || activeTab === "intelligence"),
    staleTime: 20 * 60_000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });

  const cards = buildCategoryCards(activeCategory, marketsQuery.data);

  const showSkeleton = isPro && marketsQuery.isPending;
  const showPaywallUi = !isPro && isMarketsPaywallUiEnabled();

  function openAskWithPrefill(prompt: string) {
    router.push(`/ask?prefill=${encodeURIComponent(prompt)}`);
  }

  function openAssetInAsk(symbol: string) {
    const assetName = ASK_ASSET_NAMES[symbol] ?? symbol;
    openAskWithPrefill(`Brief me on ${assetName} before this session. Key levels, bias and what to watch.`);
  }

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
                  <div>
                    {/* Category Tabs */}
                    <div className="mb-4 flex flex-wrap gap-1.5">
                      {CATEGORIES.map((cat) => {
                        const config = CATEGORY_CONFIG[cat];
                        const isActive = cat === activeCategory;
                        return (
                          <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-all",
                              isActive
                                ? "bg-white/[0.08] text-white"
                                : "text-[var(--vt-muted)] hover:bg-white/[0.04] hover:text-white/80",
                            )}
                          >
                            <span
                              className={cn(
                                "size-1.5 rounded-full",
                                isActive ? "bg-[var(--vt-coral)]" : "bg-white/20",
                              )}
                              aria-hidden
                            />
                            {config.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Price Cards Grid */}
                    {showSkeleton ? (
                      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div
                            key={i}
                            className="h-28 animate-pulse rounded-xl border border-white/[0.04] bg-white/[0.02]"
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
                        {cards.map((card) => (
                          <MarketPriceCard
                            key={card.symbol}
                            data={card}
                            isSelected={false}
                            onClick={() => openAssetInAsk(card.symbol)}
                          />
                        ))}
                      </div>
                    )}

                  </div>
                ) : activeTab === "intelligence" ? (
                  <MarketIntelligenceSection
                    items={intelligenceQuery.data?.items ?? []}
                    sourceCount={intelligenceQuery.data?.sourceCount ?? null}
                    dailyBrief={intelligenceQuery.data?.dailyBrief ?? null}
                    updatedAt={intelligenceQuery.data?.updatedAt ?? null}
                    onAskPrompt={openAskWithPrefill}
                    isLoading={intelligenceQuery.isPending}
                    errorMessage={
                      intelligenceQuery.isError
                        ? intelligenceQuery.error instanceof Error
                          ? intelligenceQuery.error.message
                          : "Failed to load market intelligence."
                        : null
                    }
                  />
                ) : activeTab === "calendar" ? (
                  <MarketEventsSection
                    snapshot={calendarQuery.data}
                    onAskPrompt={openAskWithPrefill}
                    isLoading={calendarQuery.isPending}
                    errorMessage={
                      calendarQuery.isError
                        ? calendarQuery.error instanceof Error
                          ? calendarQuery.error.message
                          : "Failed to load economic calendar."
                        : null
                    }
                  />
                ) : activeTab === "journal" ? (
                  <MarketsTabUpcoming kind="journal" />
                ) : (
                  <MarketsTabUpcoming kind="mind" />
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
