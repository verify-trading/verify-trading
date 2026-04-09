"use client";

import { useQuery } from "@tanstack/react-query";
import { Lock, RefreshCcw } from "lucide-react";
import { useEffect, useId, useState } from "react";

import {
  MARKETS_TIMEFRAMES,
  formatAssetPrice,
  formatChangePercent,
  type MarketsAssetPayload,
  type MarketsDashboardAssetId,
  type MarketsSnapshot,
  type MarketsTimeframe,
} from "@/lib/markets/dashboard";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";

type MarketCatalogItem = {
  id: MarketsDashboardAssetId;
  title: string;
  symbol: string;
  venue: string;
  fallbackSparkline: number[];
};

type MarketTile = {
  id: MarketsDashboardAssetId;
  title: string;
  symbol: string;
  venue: string;
  price: string;
  changePercent: string;
  changeValue: string;
  periodReturn: string;
  periodLabel: string;
  summary: string;
  updatedLabel: string;
  stats: Array<{ label: string; value: string }>;
  sparkline: number[];
  errorMessage: string | null;
};

type AccessTier = "loading" | "signed_out" | "free" | "pro";

const MARKETS_QUERY_STALE_MS = 15 * 60_000;

/**
 * FMP free plan is too tight for aggressive background polling because one dashboard refresh
 * fans out into several upstream symbol requests. Keep polling off for now and rely on
 * stale-time plus manual refresh until the paid plan or a batched backend lands.
 */
const MARKETS_QUERY_POLLING_INTERVAL_MS = 0;

const marketCatalog: MarketCatalogItem[] = [
  {
    id: "gold",
    title: "Gold Futures",
    symbol: "GCUSD",
    venue: "COMMODITY",
    fallbackSparkline: [19, 26, 42, 51, 58, 67, 72, 84, 92],
  },
  {
    id: "oil",
    title: "Brent Crude",
    symbol: "BZUSD",
    venue: "COMMODITY",
    fallbackSparkline: [92, 87, 79, 72, 68, 61, 57, 49, 43],
  },
  {
    id: "bitcoin",
    title: "Bitcoin",
    symbol: "BTCUSD",
    venue: "CRYPTO",
    fallbackSparkline: [34, 39, 51, 46, 61, 55, 68, 71, 66],
  },
  {
    id: "ethereum",
    title: "Ethereum",
    symbol: "ETHUSD",
    venue: "CRYPTO",
    fallbackSparkline: [22, 28, 35, 44, 41, 56, 61, 66, 74],
  },
  {
    id: "eurusd",
    title: "EUR/USD",
    symbol: "EURUSD",
    venue: "FOREX",
    fallbackSparkline: [12, 13, 14, 14, 15, 17, 16, 18, 19],
  },
  {
    id: "gbpusd",
    title: "GBP/USD",
    symbol: "GBPUSD",
    venue: "FOREX",
    fallbackSparkline: [11, 12, 13, 12, 14, 15, 15, 16, 17],
  },
  {
    id: "dow",
    title: "Dow Jones",
    symbol: "^DJI",
    venue: "INDEX",
    fallbackSparkline: [30, 34, 38, 49, 54, 57, 66, 73, 85],
  },
  {
    id: "nasdaq",
    title: "NASDAQ Composite",
    symbol: "^IXIC",
    venue: "INDEX",
    fallbackSparkline: [25, 33, 44, 41, 56, 63, 69, 76, 91],
  },
];

const lockedMockTiles: Record<MarketsDashboardAssetId, Omit<MarketTile, "errorMessage">> = {
  gold: {
    id: "gold",
    title: "Gold Futures",
    symbol: "GCUSD",
    venue: "COMMODITY",
    price: "4,761",
    changePercent: "+1.63%",
    changeValue: "+76.50",
    periodReturn: "+1.63%",
    periodLabel: "over 1 week",
    summary: "Gold is holding firm as defensive demand stays supported into the close.",
    updatedLabel: "Preview mode",
    stats: [
      { label: "Support", value: "4,698" },
      { label: "Resistance", value: "4,812" },
      { label: "Window", value: "1W" },
      { label: "Data points", value: "7" },
      { label: "Direction", value: "Bullish" },
      { label: "Source", value: "Preview" },
    ],
    sparkline: [19, 26, 42, 51, 58, 67, 72, 84, 92],
  },
  oil: {
    id: "oil",
    title: "Brent Crude",
    symbol: "BZUSD",
    venue: "COMMODITY",
    price: "94.43",
    changePercent: "-13.58%",
    changeValue: "-14.84",
    periodReturn: "-13.58%",
    periodLabel: "over 1 week",
    summary: "Brent remains under pressure as the market strips out part of the geopolitical risk premium.",
    updatedLabel: "Preview mode",
    stats: [
      { label: "Support", value: "90.01" },
      { label: "Resistance", value: "104.00" },
      { label: "Window", value: "1W" },
      { label: "Data points", value: "7" },
      { label: "Direction", value: "Bearish" },
      { label: "Source", value: "Preview" },
    ],
    sparkline: [92, 87, 79, 72, 68, 61, 57, 49, 43],
  },
  bitcoin: {
    id: "bitcoin",
    title: "Bitcoin",
    symbol: "BTCUSD",
    venue: "CRYPTO",
    price: "71,839",
    changePercent: "-0.10%",
    changeValue: "-71.41",
    periodReturn: "-0.10%",
    periodLabel: "over 1 week",
    summary: "Bitcoin is still trading like high-beta risk, with intraday reversals around headline flow.",
    updatedLabel: "Preview mode",
    stats: [
      { label: "Support", value: "70,684" },
      { label: "Resistance", value: "72,861" },
      { label: "Window", value: "1W" },
      { label: "Data points", value: "7" },
      { label: "Direction", value: "Mixed" },
      { label: "Source", value: "Preview" },
    ],
    sparkline: [34, 39, 51, 46, 61, 55, 68, 71, 66],
  },
  ethereum: {
    id: "ethereum",
    title: "Ethereum",
    symbol: "ETHUSD",
    venue: "CRYPTO",
    price: "3,584.22",
    changePercent: "+1.22%",
    changeValue: "+43.08",
    periodReturn: "+1.22%",
    periodLabel: "over 1 week",
    summary: "Ethereum is tracking the broader crypto bid while lagging Bitcoin’s headline sensitivity.",
    updatedLabel: "Preview mode",
    stats: [
      { label: "Support", value: "3,442.10" },
      { label: "Resistance", value: "3,622.50" },
      { label: "Window", value: "1W" },
      { label: "Data points", value: "7" },
      { label: "Direction", value: "Bullish" },
      { label: "Source", value: "Preview" },
    ],
    sparkline: [22, 28, 35, 44, 41, 56, 61, 66, 74],
  },
  eurusd: {
    id: "eurusd",
    title: "EUR/USD",
    symbol: "EURUSD",
    venue: "FOREX",
    price: "1.1738",
    changePercent: "+0.66%",
    changeValue: "+0.0077",
    periodReturn: "+0.66%",
    periodLabel: "over 1 week",
    summary: "EUR/USD remains supported while the dollar leg stays offered across the board.",
    updatedLabel: "Preview mode",
    stats: [
      { label: "Support", value: "1.1640" },
      { label: "Resistance", value: "1.1762" },
      { label: "Window", value: "1W" },
      { label: "Data points", value: "7" },
      { label: "Direction", value: "Bullish" },
      { label: "Source", value: "Preview" },
    ],
    sparkline: [12, 13, 14, 14, 15, 17, 16, 18, 19],
  },
  gbpusd: {
    id: "gbpusd",
    title: "GBP/USD",
    symbol: "GBPUSD",
    venue: "FOREX",
    price: "1.3258",
    changePercent: "+0.42%",
    changeValue: "+0.0055",
    periodReturn: "+0.42%",
    periodLabel: "over 1 week",
    summary: "Sterling is firm against the dollar, but still trading under nearby resistance.",
    updatedLabel: "Preview mode",
    stats: [
      { label: "Support", value: "1.3188" },
      { label: "Resistance", value: "1.3291" },
      { label: "Window", value: "1W" },
      { label: "Data points", value: "7" },
      { label: "Direction", value: "Bullish" },
      { label: "Source", value: "Preview" },
    ],
    sparkline: [11, 12, 13, 12, 14, 15, 15, 16, 17],
  },
  dow: {
    id: "dow",
    title: "Dow Jones",
    symbol: "^DJI",
    venue: "INDEX",
    price: "45,166.20",
    changePercent: "+2.85%",
    changeValue: "+1,252.17",
    periodReturn: "+2.85%",
    periodLabel: "over 1 week",
    summary: "The Dow is lifting with cyclicals and industrials as energy pressure cools.",
    updatedLabel: "Preview mode",
    stats: [
      { label: "Support", value: "44,112.33" },
      { label: "Resistance", value: "45,284.92" },
      { label: "Window", value: "1W" },
      { label: "Data points", value: "7" },
      { label: "Direction", value: "Bullish" },
      { label: "Source", value: "Preview" },
    ],
    sparkline: [30, 34, 38, 49, 54, 57, 66, 73, 85],
  },
  nasdaq: {
    id: "nasdaq",
    title: "NASDAQ Composite",
    symbol: "^IXIC",
    venue: "INDEX",
    price: "20,948.12",
    changePercent: "+2.89%",
    changeValue: "+589.71",
    periodReturn: "+2.89%",
    periodLabel: "over 1 week",
    summary: "The Nasdaq remains the clearest risk-on leader as growth names keep absorbing flows.",
    updatedLabel: "Preview mode",
    stats: [
      { label: "Support", value: "20,411.32" },
      { label: "Resistance", value: "21,084.44" },
      { label: "Window", value: "1W" },
      { label: "Data points", value: "7" },
      { label: "Direction", value: "Bullish" },
      { label: "Source", value: "Preview" },
    ],
    sparkline: [25, 33, 44, 41, 56, 63, 69, 76, 91],
  },
};

function buildSparklinePath(values: number[], width = 320, height = 120) {
  if (values.length === 0) {
    return "";
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);

  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * (height - 12) - 6;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function toneFromNumber(value: number) {
  return value < 0 ? "down" : "up";
}

function timeframeLabel(timeframe: MarketsTimeframe) {
  switch (timeframe) {
    case "1D":
      return "1 day";
    case "1W":
      return "1 week";
    case "1M":
      return "1 month";
    case "3M":
      return "3 months";
    case "1Y":
      return "1 year";
  }
}

function formatSignedPrice(assetId: MarketsDashboardAssetId, value: number) {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}${formatAssetPrice(assetId, Math.abs(value))}`;
}

function formatUpdatedLabel(updatedAt: string) {
  const diffMs = Math.max(Date.now() - Date.parse(updatedAt), 0);
  const diffMinutes = Math.round(diffMs / 60_000);

  if (diffMinutes <= 1) {
    return "Updated just now";
  }

  return `Updated ${diffMinutes} minutes ago`;
}

function buildSummary(item: MarketCatalogItem, asset: MarketsAssetPayload, timeframe: MarketsTimeframe) {
  if (!asset.series || !asset.quote) {
    return asset.error ?? `${item.title} is temporarily unavailable.`;
  }

  const price = asset.quote.price;
  const supportDistance = price - asset.series.support;
  const resistanceDistance = asset.series.resistance - price;
  const tone = asset.quote.direction === "up" ? "holding strength" : "trading under pressure";
  const nearestLevel =
    Math.abs(supportDistance) <= Math.abs(resistanceDistance)
      ? `Support sits near ${formatAssetPrice(item.id, asset.series.support)}`
      : `Resistance sits near ${formatAssetPrice(item.id, asset.series.resistance)}`;

  return `${item.title} is ${tone} on the ${timeframeLabel(timeframe)} view. ${nearestLevel}.`;
}

function buildStats(item: MarketCatalogItem, asset: MarketsAssetPayload, timeframe: MarketsTimeframe) {
  if (!asset.series || !asset.quote) {
    return [
      { label: "Status", value: "Unavailable" },
      { label: "Window", value: timeframe },
      { label: "Symbol", value: item.symbol },
      { label: "Source", value: "FMP" },
    ];
  }

  return [
    { label: "Support", value: formatAssetPrice(item.id, asset.series.support) },
    { label: "Resistance", value: formatAssetPrice(item.id, asset.series.resistance) },
    { label: "Window", value: timeframe },
    { label: "Data points", value: String(asset.series.closeValues.length) },
    { label: "Direction", value: asset.quote.direction === "up" ? "Bullish" : "Bearish" },
    { label: "Source", value: "FMP" },
  ];
}

function buildTile(
  item: MarketCatalogItem,
  asset: MarketsAssetPayload | undefined,
  timeframe: MarketsTimeframe,
  updatedAt: string | null,
): MarketTile {
  if (!asset?.quote || !asset.series) {
    return {
      id: item.id,
      title: item.title,
      symbol: item.symbol,
      venue: item.venue,
      price: "—",
      changePercent: "—",
      changeValue: "—",
      periodReturn: "Live data unavailable",
      periodLabel: "",
      summary: asset?.error ?? `${item.title} is waiting for live data.`,
      updatedLabel: updatedAt ? formatUpdatedLabel(updatedAt) : "Waiting for live update",
      stats: buildStats(
        item,
        {
          id: item.id,
          label: item.title,
          quote: null,
          series: null,
          error: asset?.error ?? "Live data unavailable.",
        },
        timeframe,
      ),
      sparkline: item.fallbackSparkline,
      errorMessage: asset?.error ?? "Live data unavailable.",
    };
  }

  const first = asset.series.closeValues[0];
  const last = asset.series.closeValues[asset.series.closeValues.length - 1];
  const absoluteChange = last - first;

  return {
    id: item.id,
    title: item.title,
    symbol: asset.quote.symbol,
    venue: item.venue,
    price: formatAssetPrice(item.id, asset.quote.price),
    changePercent: formatChangePercent(asset.quote.changePercent),
    changeValue: formatSignedPrice(item.id, absoluteChange),
    periodReturn: formatChangePercent(asset.quote.changePercent),
    periodLabel: `over ${timeframeLabel(timeframe)}`,
    summary: buildSummary(item, asset, timeframe),
    updatedLabel: updatedAt ? formatUpdatedLabel(updatedAt) : "Updated just now",
    stats: buildStats(item, asset, timeframe),
    sparkline: asset.series.closeValues,
    errorMessage: null,
  };
}

async function fetchMarketsSnapshot(timeframe: MarketsTimeframe) {
  const response = await fetch(`/api/markets?timeframe=${timeframe}`);
  if (!response.ok) {
    throw new Error(`Markets request failed with ${response.status}.`);
  }

  return (await response.json()) as MarketsSnapshot;
}

function Sparkline({
  values,
  tone,
  compact = false,
}: {
  values: number[];
  tone: "up" | "down";
  compact?: boolean;
}) {
  const gradientId = useId();
  const width = compact ? 180 : 320;
  const height = compact ? 56 : 120;
  const path = buildSparklinePath(values, width, height);
  const stroke = tone === "up" ? "var(--vt-green)" : "var(--vt-coral)";
  const fill =
    tone === "up"
      ? "rgba(34, 197, 94, 0.16)"
      : "rgba(242, 109, 109, 0.16)";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={compact ? "h-14 w-full" : "h-32 w-full"}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={fill} />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      <path
        d={`${path} L ${width} ${height} L 0 ${height} Z`}
        fill={`url(#${gradientId})`}
      />
      <path d={path} fill="none" stroke={stroke} strokeWidth={compact ? 2.5 : 3.2} strokeLinecap="round" />
    </svg>
  );
}

export function MarketsPage() {
  const { supabase, user, ready, isSignedIn } = useSupabaseAuth();
  const [selectedId, setSelectedId] = useState<MarketsDashboardAssetId>(marketCatalog[0]?.id ?? "gold");
  const [timeframe] = useState<MarketsTimeframe>(MARKETS_TIMEFRAMES[1] ?? "1W");
  const [accessTier, setAccessTier] = useState<AccessTier>("loading");

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
  const selectedTone =
    accessTier === "pro" && selectedAsset?.quote?.changePercent !== undefined
      ? toneFromNumber(selectedAsset.quote.changePercent)
      : selectedMarket.changePercent.startsWith("-")
        ? "down"
        : "up";
  const isLocked = accessTier !== "pro";
  const isRefreshDisabled = accessTier !== "pro" || marketsQuery.isFetching;
  const overlayTitle =
    accessTier === "signed_out"
      ? "Sign in and upgrade to Pro to unlock Markets."
      : accessTier === "loading"
        ? "Checking your Markets access."
        : "Markets is available on Pro only.";
  return (
    <div className="min-h-0 flex-1 bg-[radial-gradient(circle_at_top,rgba(76,110,245,0.14),transparent_36%),var(--vt-navy)]">
      <main className="mx-auto w-full max-w-7xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        <h1 className="sr-only">Markets</h1>

        <section className="relative">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black tracking-[-0.04em] text-white sm:text-2xl">Top Assets</h2>
              <p className="mt-1 text-sm text-[var(--vt-muted)]">
                Select a card to view the key levels, trend, and session detail.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden rounded-full border border-[color:var(--vt-border)] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-[var(--vt-muted)] sm:block">
                {selectedMarket.updatedLabel}
              </div>
              <button
                type="button"
                onClick={() => {
                  void marketsQuery.refetch();
                }}
                disabled={isRefreshDisabled}
                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--vt-border)] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCcw className={`size-3.5 ${marketsQuery.isFetching ? "animate-spin" : ""}`} aria-hidden />
                Refresh
              </button>
            </div>
          </div>

          {accessTier === "pro" && marketsQuery.isError ? (
            <div className="mb-4 rounded-2xl border border-[rgba(242,109,109,0.28)] bg-[rgba(242,109,109,0.08)] px-4 py-3 text-sm text-slate-200">
              Live market data is unavailable right now. The layout is still visible, but the feed could not be refreshed.
            </div>
          ) : null}

          <div className={`grid gap-4 lg:items-start lg:grid-cols-[1.15fr_0.85fr] ${isLocked ? "pointer-events-none select-none blur-[1px] saturate-75" : ""}`}>
            <div className="self-start grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="market-cards-grid">
              {tiles.map((market) => {
                const tone =
                  market.changePercent.startsWith("-") ||
                  market.changeValue.startsWith("-")
                    ? "down"
                    : "up";
                const isSelected = market.id === selectedMarket.id;

                return (
                  <button
                    key={market.id}
                    type="button"
                    onClick={() => setSelectedId(market.id)}
                    aria-label={`Open ${market.title} market card`}
                    className={`self-start rounded-[24px] border p-4 text-left transition ${
                      isSelected
                        ? "border-[rgba(242,109,109,0.34)] bg-[rgba(242,109,109,0.08)] shadow-[0_18px_40px_rgba(242,109,109,0.10)]"
                        : "border-[color:var(--vt-border)] bg-[var(--vt-card)] hover:bg-[var(--vt-card-alt)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white">{market.title}</div>
                        <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vt-muted)]">
                          {market.symbol}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-black tracking-[-0.03em] text-white">{market.price}</div>
                        <div className={`mt-1 text-xs font-bold ${tone === "up" ? "text-[var(--vt-green)]" : "text-[var(--vt-coral)]"}`}>
                          {market.changePercent}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <Sparkline values={market.sparkline} tone={tone} compact />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3 text-xs">
                      <span className="text-[var(--vt-muted)]">{market.venue}</span>
                      <span className={tone === "up" ? "text-[var(--vt-green)]" : "text-[var(--vt-coral)]"}>
                        {market.changeValue}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div
              className="rounded-[28px] border border-[color:var(--vt-border)] bg-[var(--vt-card)] p-5 shadow-[0_24px_60px_rgba(10,13,46,0.24)] sm:p-6"
              data-testid="market-focus-panel"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--vt-muted)]">
                    Focus Panel
                  </div>
                  <h3 className="mt-2 text-2xl font-black tracking-[-0.05em] text-white">
                    {selectedMarket.title}
                  </h3>
                  <div className="mt-1 text-sm font-semibold text-[var(--vt-muted)]">
                    {selectedMarket.symbol} · {selectedMarket.venue}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-black tracking-[-0.06em] text-white">{selectedMarket.price}</div>
                  <div className={`mt-2 text-sm font-bold ${selectedTone === "up" ? "text-[var(--vt-green)]" : "text-[var(--vt-coral)]"}`}>
                    {selectedMarket.changePercent} <span className="text-[var(--vt-muted)]">({selectedMarket.changeValue})</span>
                  </div>
                </div>
              </div>

              <p className="mt-4 text-sm leading-7 text-slate-300">{selectedMarket.summary}</p>

              <div className="mt-5 rounded-[24px] border border-[color:var(--vt-border)] bg-[rgba(255,255,255,0.03)] p-4">
                <div className={`text-sm font-bold ${selectedTone === "up" ? "text-[var(--vt-green)]" : "text-[var(--vt-coral)]"}`}>
                  {selectedMarket.periodReturn} {selectedMarket.periodLabel}
                </div>
                <div className="mt-3">
                  <Sparkline values={selectedMarket.sparkline} tone={selectedTone} />
                </div>
              </div>

              {selectedMarket.errorMessage ? (
                <div className="mt-5 rounded-2xl border border-[rgba(242,109,109,0.28)] bg-[rgba(242,109,109,0.08)] px-4 py-3 text-sm text-slate-200">
                  {selectedMarket.errorMessage}
                </div>
              ) : null}

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {selectedMarket.stats.map((stat) => (
                  <div
                    key={`${selectedMarket.id}-${stat.label}`}
                    className="rounded-2xl border border-[color:var(--vt-border)] bg-white/[0.03] px-4 py-3"
                  >
                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--vt-muted)]">
                      {stat.label}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white">{stat.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {isLocked ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center px-4">
              <div className="w-full max-w-xl rounded-[28px] border border-[rgba(255,255,255,0.12)] bg-[rgba(8,11,42,0.62)] px-6 py-7 text-center shadow-[0_24px_80px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-[rgba(255,255,255,0.14)] bg-white/[0.06] text-white">
                  <Lock className="size-5" strokeWidth={2.2} aria-hidden />
                </div>
                <div className="mt-4 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--vt-muted)]">
                  Pro Access
                </div>
                <h3 className="mt-2 text-2xl font-black tracking-[-0.04em] text-white">
                  {overlayTitle}
                </h3>
              </div>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
