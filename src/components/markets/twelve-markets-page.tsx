"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { ProPlansPricingPanel } from "@/components/pricing/pro-plans-pricing-panel";
import { useAccountMenuQuery } from "@/lib/auth/use-account-menu-query";
import type { PublicBillingPricing } from "@/lib/billing/config";
import type { PricingPageBillingContext } from "@/lib/billing/pricing-page-data";
import { deriveMarketsAccessTier } from "@/lib/markets/derive-markets-access-tier";
import type { MarketSeriesTimeframe } from "@/lib/markets/twelve-data-adapter";
import type { MarketsAccessTier } from "@/lib/markets/markets-access-tier";
import {
  buildCategoryCards,
  buildSparklinePath,
  CATEGORY_CONFIG,
  fetchEconomicCalendar,
  fetchMarketIntelligence,
  fetchTwelveMarketsSnapshot,
  formatPrice,
  type MarketsCategory,
} from "@/lib/markets/twelve-markets-data";
import { cn } from "@/lib/utils";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";

import { MarketEventsSection } from "./market-events-section";
import { MarketIntelligenceSection } from "./market-intelligence-section";
import { MarketPriceCard } from "./market-price-card";
import { MarketsCommunityCtas } from "./markets-community-ctas";
import { MarketsViewTabs, type MarketsTabId } from "./markets-view-tabs";

const CATEGORIES: MarketsCategory[] = ["major_pairs", "commodities", "crypto"];
const DETAIL_TIMEFRAMES: MarketSeriesTimeframe[] = ["1D", "1W", "1M", "3M"];

const MARKETS_QUERY_STALE_MS = 5 * 60_000;

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

function formatPeriodReturn(values: number[]): string {
  if (values.length < 2) {
    return "—";
  }
  const first = values[0]!;
  const last = values[values.length - 1]!;
  if (!Number.isFinite(first) || !Number.isFinite(last) || first === 0) {
    return "—";
  }
  const pct = ((last - first) / first) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}% this period`;
}

export type MarketsPageProps = {
  initialTier?: "pro" | "free";
  pricing: PublicBillingPricing;
  billingContext: PricingPageBillingContext | null;
};

export function TwelveMarketsPage({ initialTier, pricing, billingContext }: MarketsPageProps) {
  const { ready, isSignedIn } = useSupabaseAuth();
  const accountMenuQuery = useAccountMenuQuery();
  const [activeCategory, setActiveCategory] = useState<MarketsCategory>("major_pairs");
  const [activeTab, setActiveTab] = useState<MarketsTabId>("charts");
  const [detailTimeframe, setDetailTimeframe] = useState<MarketSeriesTimeframe>("1D");

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
    enabled: isPro && activeTab === "intelligence",
    staleTime: 20 * 60_000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });

  const cards = buildCategoryCards(activeCategory, marketsQuery.data);
  const [selectedSymbol, setSelectedSymbol] = useState<string>(cards[0]?.symbol ?? "EUR/USD");
  const selectedCard = cards.find((c) => c.symbol === selectedSymbol) ?? cards[0];
  const cachedSelectedSeries = selectedCard
    ? marketsQuery.data?.seriesByTimeframe?.[detailTimeframe]?.[selectedCard.symbol]
    : undefined;
  const selectedSeries = cachedSelectedSeries ?? (detailTimeframe === "1D" ? selectedCard?.sparkline : undefined) ?? [];
  const selectedPeriodReturn = formatPeriodReturn(selectedSeries);
  const selectedTone = selectedSeries.length >= 2
    ? selectedSeries[selectedSeries.length - 1]! >= selectedSeries[0]!
    : selectedCard?.isUp;

  const showSkeleton = isPro && marketsQuery.isPending;
  const showPaywallUi = !isPro && isMarketsPaywallUiEnabled();

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
                    <div className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-1.5">
                      {CATEGORIES.map((cat) => {
                        const config = CATEGORY_CONFIG[cat];
                        const isActive = cat === activeCategory;
                        return (
                          <button
                            key={cat}
                            onClick={() => {
                              setActiveCategory(cat);
                              setSelectedSymbol(CATEGORY_CONFIG[cat].symbols[0] ?? "EUR/USD");
                            }}
                            className={cn(
                              "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all",
                              isActive
                                ? "border border-[var(--vt-coral)]/45 bg-[var(--vt-coral)]/[0.1] text-white"
                                : "border border-transparent text-[var(--vt-muted)] hover:bg-white/[0.05] hover:text-white",
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
                      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div
                            key={i}
                            className="h-32 animate-pulse rounded-2xl border border-white/[0.04] bg-white/[0.02]"
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                        {cards.map((card) => (
                          <MarketPriceCard
                            key={card.symbol}
                            data={card}
                            isSelected={card.symbol === selectedSymbol}
                            onClick={() => setSelectedSymbol(card.symbol)}
                          />
                        ))}
                      </div>
                    )}

                    {/* Selected Detail */}
                    {selectedCard && (
                      <div className="mt-6 rounded-2xl border border-white/[0.06] bg-[var(--vt-card)] p-5 sm:p-6">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-[var(--vt-muted)]">
                              {selectedCard.name}
                            </p>
                            <p className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl">
                              {formatPrice(selectedCard.symbol, selectedCard.price)}
                            </p>
                          </div>
                          <div
                            className={cn(
                              "text-right text-lg font-bold",
                              selectedCard.isUp ? "text-emerald-400" : "text-rose-400",
                            )}
                          >
                            <span className="mr-1">{selectedCard.isUp ? "▲" : "▼"}</span>
                            {selectedCard.percent_change.toFixed(2)}%
                          </div>
                        </div>

                        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                          <div
                            className={cn(
                              "text-sm font-bold",
                              selectedTone ? "text-emerald-400" : "text-rose-400",
                            )}
                          >
                            {selectedPeriodReturn !== "—" ? (
                              <>
                                <span className="mr-1">{selectedTone ? "▲" : "▼"}</span>
                                {selectedPeriodReturn}
                              </>
                            ) : (
                              "Period data loading..."
                            )}
                          </div>

                          <div className="inline-flex rounded-xl border border-white/[0.07] bg-white/[0.035] p-1">
                            {DETAIL_TIMEFRAMES.map((timeframe) => {
                              const isActive = detailTimeframe === timeframe;
                              return (
                                <button
                                  key={timeframe}
                                  type="button"
                                  onClick={() => setDetailTimeframe(timeframe)}
                                  className={cn(
                                    "rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
                                    isActive
                                      ? "bg-[var(--vt-green)] text-[var(--vt-navy)]"
                                      : "text-[var(--vt-muted)] hover:bg-white/[0.06] hover:text-white",
                                  )}
                                >
                                  {timeframe}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Detail sparkline */}
                        <div className="mt-4 h-32 w-full">
                          {selectedSeries.length >= 2 ? (
                            <svg viewBox="0 0 480 128" className="h-full w-full" preserveAspectRatio="none">
                              <defs>
                                <linearGradient id="selected-market-chart-fill" x1="0" y1="0" x2="0" y2="1">
                                  <stop
                                    offset="0%"
                                    stopColor={selectedTone ? "#34d399" : "#fb7185"}
                                    stopOpacity="0.22"
                                  />
                                  <stop
                                    offset="100%"
                                    stopColor={selectedTone ? "#34d399" : "#fb7185"}
                                    stopOpacity="0"
                                  />
                                </linearGradient>
                              </defs>
                              <line
                                x1="0"
                                y1="96"
                                x2="480"
                                y2="96"
                                stroke="rgba(255,255,255,0.22)"
                                strokeDasharray="5 5"
                              />
                              <path
                                d={`${buildSparklinePath(selectedSeries, 480, 128)} L 480 128 L 0 128 Z`}
                                fill="url(#selected-market-chart-fill)"
                              />
                              <path
                                d={buildSparklinePath(selectedSeries, 480, 128)}
                                fill="none"
                                stroke={selectedTone ? "#34d399" : "#fb7185"}
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <circle
                                cx="476"
                                cy={(() => {
                                  const min = Math.min(...selectedSeries);
                                  const max = Math.max(...selectedSeries);
                                  const range = max - min || 1;
                                  const last = selectedSeries[selectedSeries.length - 1]!;
                                  return 126 - ((last - min) / range) * 124;
                                })()}
                                r="4.5"
                                fill={selectedTone ? "#34d399" : "#fb7185"}
                              />
                            </svg>
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <span className="text-sm text-[var(--vt-muted)]">Chart data loading...</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : activeTab === "intelligence" ? (
                  <MarketIntelligenceSection
                    items={intelligenceQuery.data?.items ?? []}
                    isLoading={intelligenceQuery.isPending}
                    errorMessage={
                      intelligenceQuery.isError
                        ? intelligenceQuery.error instanceof Error
                          ? intelligenceQuery.error.message
                          : "Failed to load market intelligence."
                        : null
                    }
                  />
                ) : (
                  <MarketEventsSection
                    snapshot={calendarQuery.data}
                    isLoading={calendarQuery.isPending}
                    errorMessage={
                      calendarQuery.isError
                        ? calendarQuery.error instanceof Error
                          ? calendarQuery.error.message
                          : "Failed to load economic calendar."
                        : null
                    }
                  />
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
