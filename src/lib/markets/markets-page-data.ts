/** Markets dashboard catalog, locked preview tiles, and pure helpers to build live tiles from API snapshots. */
import {
  formatAssetPrice,
  formatChangePercent,
  type MarketsAssetPayload,
  type MarketsDashboardAssetId,
  type MarketsSnapshot,
  type MarketsTimeframe,
} from "@/lib/markets/dashboard";

export type MarketCatalogItem = {
  id: MarketsDashboardAssetId;
  title: string;
  symbol: string;
  venue: string;
  fallbackSparkline: number[];
};

export type MarketTile = {
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

export const marketCatalog: MarketCatalogItem[] = [
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

export const lockedMockTiles: Record<MarketsDashboardAssetId, Omit<MarketTile, "errorMessage">> = {
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
    summary: "Ethereum is tracking the broader crypto bid while lagging Bitcoin's headline sensitivity.",
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

export function buildSparklinePath(values: number[], width = 480, height = 168) {
  if (values.length === 0) {
    return "";
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const rawRange = max - min;
  const topPad = 6;
  const bottomPad = 6;
  const innerH = height - topPad - bottomPad;

  // When every close is identical (or feed duplicates), min === max. Using range=1 mapped all
  // points to the bottom edge — looks broken on forex. Draw a flat line through the vertical center.
  if (!Number.isFinite(rawRange) || rawRange === 0) {
    const midY = topPad + innerH / 2;
    return values
      .map((_, index) => {
        const x = (index / Math.max(values.length - 1, 1)) * width;
        return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${midY.toFixed(2)}`;
      })
      .join(" ");
  }

  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - bottomPad - ((value - min) / rawRange) * innerH;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export function toneFromNumber(value: number) {
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

export function readProxyAssumption(asset: MarketsAssetPayload | undefined) {
  return asset?.quote?.proxyAssumption ?? asset?.series?.proxyAssumption ?? null;
}

export function formatSourceLabel(asset: MarketsAssetPayload | undefined) {
  return readProxyAssumption(asset) ? "FMP proxy feed" : "FMP daily feed";
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
      { label: "Window", value: timeframeLabel(timeframe) },
      { label: "Symbol", value: item.symbol },
      { label: "Source", value: "FMP" },
    ];
  }

  return [
    { label: "Support", value: formatAssetPrice(item.id, asset.series.support) },
    { label: "Resistance", value: formatAssetPrice(item.id, asset.series.resistance) },
    { label: "Window", value: timeframeLabel(timeframe) },
    { label: "Data points", value: String(asset.series.closeValues.length) },
    { label: "Asset", value: asset.quote.asset },
    { label: "Symbol", value: asset.quote.symbol },
    { label: "Direction", value: asset.quote.direction === "up" ? "Bullish" : "Bearish" },
    { label: "Source", value: formatSourceLabel(asset) },
  ];
}

export function buildTile(
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

export async function fetchMarketsSnapshot(timeframe: MarketsTimeframe) {
  const response = await fetch(`/api/markets?timeframe=${timeframe}`);
  if (!response.ok) {
    throw new Error(`Markets request failed with ${response.status}.`);
  }

  return (await response.json()) as MarketsSnapshot;
}
