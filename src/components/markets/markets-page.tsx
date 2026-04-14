"use client";

import { useQuery } from "@tanstack/react-query";
import { Lock, RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MARKETS_TIMEFRAMES, type MarketsTimeframe } from "@/lib/markets/dashboard";
import {
  buildTile,
  fetchMarketsSnapshot,
  lockedMockTiles,
  marketCatalog,
  readProxyAssumption,
  toneFromNumber,
} from "@/lib/markets/markets-page-data";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";

import { MarketCard } from "./market-card";
import { MarketFocusPanel, type MarketsAccessTier } from "./market-focus-panel";
import { MarketCardSkeleton, MarketFocusPanelSkeleton } from "./markets-skeletons";

const MARKETS_QUERY_STALE_MS = 15 * 60_000;

/** Polling off: see comment in prior markets-page revision. */
const MARKETS_QUERY_POLLING_INTERVAL_MS = 0;

export type MarketsPageProps = {
  /** From the server so Pro users never see the locked preview flash while auth hydrates. */
  initialTier?: "pro" | "free";
};

function initialAccessTierFromProps(initialTier: MarketsPageProps["initialTier"]): MarketsAccessTier {
  if (initialTier === "pro") {
    return "pro";
  }
  if (initialTier === "free") {
    return "free";
  }
  return "loading";
}

export function MarketsPage({ initialTier }: MarketsPageProps = {}) {
  const { supabase, user, ready, isSignedIn } = useSupabaseAuth();
  const [selectedId, setSelectedId] = useState(marketCatalog[0]?.id ?? "gold");
  const [timeframe] = useState<MarketsTimeframe>(MARKETS_TIMEFRAMES[1] ?? "1W");
  const [accessTier, setAccessTier] = useState<MarketsAccessTier>(() => initialAccessTierFromProps(initialTier));

  useEffect(() => {
    if (!ready) {
      return;
    }

    if (!isSignedIn || !user?.id || !supabase) {
      setAccessTier("signed_out");
      return;
    }

    let cancelled = false;

    void supabase
      .from("profiles")
      .select("tier")
      .eq("id", user.id)
      .maybeSingle()
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (result.error) {
          setAccessTier("free");
          return;
        }

        setAccessTier(result.data?.tier === "pro" ? "pro" : "free");
      });

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, ready, supabase, user?.id]);

  const marketsQuery = useQuery({
    queryKey: ["markets", timeframe],
    queryFn: () => fetchMarketsSnapshot(timeframe),
    enabled: accessTier === "pro",
    staleTime: MARKETS_QUERY_STALE_MS,
    refetchInterval: MARKETS_QUERY_POLLING_INTERVAL_MS > 0 ? MARKETS_QUERY_POLLING_INTERVAL_MS : false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!selectedId && marketCatalog[0]) {
      setSelectedId(marketCatalog[0].id);
    }
  }, [selectedId]);

  const assetsById = new Map(marketsQuery.data?.assets.map((asset) => [asset.id, asset]) ?? []);
  const lockedTiles = marketCatalog.map((item) => ({
    ...lockedMockTiles[item.id],
    errorMessage: null,
  }));
  const liveTiles = marketCatalog.map((item) =>
    buildTile(item, assetsById.get(item.id), timeframe, marketsQuery.data?.updatedAt ?? null),
  );
  const tiles = accessTier === "pro" ? liveTiles : lockedTiles;
  const selectedMarket = tiles.find((market) => market.id === selectedId) ?? tiles[0];
  const selectedAsset = assetsById.get(selectedMarket.id);
  const selectedProxyAssumption = readProxyAssumption(selectedAsset);
  const selectedTone =
    accessTier === "pro" && selectedAsset?.quote?.changePercent !== undefined
      ? toneFromNumber(selectedAsset.quote.changePercent)
      : selectedMarket.changePercent.startsWith("-")
        ? "down"
        : "up";
  const isLocked = accessTier !== "pro";
  const isMarketsDataLoading = accessTier === "pro" && marketsQuery.isPending;
  const selectedCatalogItem = marketCatalog.find((item) => item.id === selectedId) ?? marketCatalog[0]!;
  const isRefreshDisabled = accessTier !== "pro" || marketsQuery.isFetching;
  const overlayTitle =
    accessTier === "signed_out"
      ? "Sign in and upgrade to Pro to unlock Markets."
      : accessTier === "loading"
        ? "Checking your Markets access."
        : "Markets is available on Pro only.";

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(76,110,245,0.14),transparent_36%),var(--vt-navy)]">
      <main className="mx-auto w-full max-w-7xl px-4 pb-[max(7rem,calc(env(safe-area-inset-bottom,0px)+2rem))] pt-6 sm:px-6 lg:px-8">
        <h1 className="sr-only">Markets</h1>

        <section className="relative">
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
                  {accessTier === "pro" && !isMarketsDataLoading && !marketsQuery.isFetching ? (
                    <span className="size-1.5 shrink-0 rounded-full bg-[var(--vt-green)] animate-pulse" />
                  ) : null}
                  {isMarketsDataLoading ? "Loading live data…" : selectedMarket.updatedLabel}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="pillCompact"
                  className="gap-2 border-[color:var(--vt-border)] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => {
                    void marketsQuery.refetch();
                  }}
                  disabled={isRefreshDisabled}
                >
                  <RefreshCcw className={`size-3.5 ${marketsQuery.isFetching ? "animate-spin" : ""}`} aria-hidden />
                  Refresh
                </Button>
              </div>
            </div>
          </header>

          {accessTier === "pro" && marketsQuery.isError ? (
            <div className="mb-4 rounded-2xl border border-[rgba(242,109,109,0.28)] bg-[rgba(242,109,109,0.08)] px-4 py-3 text-sm text-slate-200">
              Live market data is unavailable right now. The layout is still visible, but the feed could not be refreshed.
            </div>
          ) : null}

          <div
            className={cn(
              "grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start",
              isLocked && "pointer-events-none select-none opacity-[0.92] saturate-75",
            )}
          >
            <div
              className="min-w-0 self-start grid auto-rows-auto grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
              data-testid="market-cards-grid"
            >
              {isMarketsDataLoading
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

            {isMarketsDataLoading ? (
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

          {isLocked ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center px-4">
              <div className="w-full max-w-xl rounded-[28px] border border-[rgba(255,255,255,0.12)] bg-[rgba(8,11,42,0.72)] px-6 py-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-2xl">
                <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-[rgba(76,110,245,0.3)] bg-gradient-to-br from-[rgba(76,110,245,0.15)] to-transparent text-white shadow-[0_8px_24px_rgba(76,110,245,0.15)]">
                  <Lock className="size-6" strokeWidth={2} aria-hidden />
                </div>
                <div className="mt-4 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--vt-muted)]">
                  Pro Access
                </div>
                <h3 className="mt-2 text-2xl font-black tracking-[-0.04em] text-white">
                  {overlayTitle}
                </h3>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-slate-400">
                  Upgrade to Pro for live market data, full dashboard access, and unlimited Ask chats.
                </p>
              </div>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
