import type { MarketQuote, MarketSeries } from "@/lib/ask/market";

/** Keys must match `resolveSupportedAsset` in `@/lib/ask/market`. */
export const MARKETS_DASHBOARD_ASSETS = [
  { id: "gold", label: "GOLD", query: "gold" },
  { id: "oil", label: "OIL", query: "oil" },
  { id: "bitcoin", label: "BITCOIN", query: "bitcoin" },
  { id: "ethereum", label: "ETHEREUM", query: "ethereum" },
  { id: "eurusd", label: "EUR/USD", query: "eurusd" },
  { id: "gbpusd", label: "GBP/USD", query: "gbpusd" },
  { id: "dow", label: "DOW JONES", query: "dow" },
  { id: "nasdaq", label: "NASDAQ", query: "nasdaq" },
] as const;

export type MarketsDashboardAssetId = (typeof MARKETS_DASHBOARD_ASSETS)[number]["id"];

export type MarketsTimeframe = MarketSeries["timeframe"];

export const MARKETS_TIMEFRAMES: readonly MarketsTimeframe[] = ["1D", "1W", "1M", "3M", "1Y"];

export type MarketsAssetPayload = {
  id: MarketsDashboardAssetId;
  label: string;
  quote: MarketQuote | null;
  series: MarketSeries | null;
  error: string | null;
};

export type MarketsSnapshot = {
  updatedAt: string;
  timeframe: MarketsTimeframe;
  assets: MarketsAssetPayload[];
};

export function formatAssetPrice(assetId: MarketsDashboardAssetId, price: number): string {
  if (!Number.isFinite(price)) {
    return "—";
  }

  switch (assetId) {
    case "gold":
    case "bitcoin":
      return new Intl.NumberFormat("en-GB", {
        maximumFractionDigits: 0,
        minimumFractionDigits: 0,
      }).format(price);
    case "ethereum":
    case "oil":
    case "dow":
    case "nasdaq":
      return new Intl.NumberFormat("en-GB", {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      }).format(price);
    case "eurusd":
    case "gbpusd":
      return new Intl.NumberFormat("en-GB", {
        maximumFractionDigits: 5,
        minimumFractionDigits: 4,
      }).format(price);
    default:
      return String(price);
  }
}

export function formatChangePercent(changePercent: number): string {
  const sign = changePercent >= 0 ? "+" : "";
  return `${sign}${changePercent.toFixed(2)}%`;
}
