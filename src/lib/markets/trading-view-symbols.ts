import {
  MARKETS_DASHBOARD_ASSETS,
  type MarketsDashboardAssetId,
} from "@/lib/markets/dashboard";

/** Default instrument when opening the Advanced Chart (users can change symbol in-widget). */
export const TRADINGVIEW_DEFAULT_CHART_SYMBOL = "OANDA:XAUUSD";

/**
 * TradingView Symbol Overview tabs aligned with {@link MARKETS_DASHBOARD_ASSETS} order
 * and the same instruments the app uses in `resolveSupportedAsset` (USO/DIA/QQQ proxies, etc.).
 */
const TRADINGVIEW_TAB_BY_ASSET_ID: Record<
  MarketsDashboardAssetId,
  { label: string; symbolWithRange: string }
> = {
  gold: { label: "Gold", symbolWithRange: "OANDA:XAUUSD|1D" },
  oil: { label: "Oil (WTI)", symbolWithRange: "AMEX:USO|1D" },
  bitcoin: { label: "Bitcoin", symbolWithRange: "COINBASE:BTCUSD|1D" },
  ethereum: { label: "Ethereum", symbolWithRange: "COINBASE:ETHUSD|1D" },
  eurusd: { label: "EUR/USD", symbolWithRange: "FX:EURUSD|1D" },
  gbpusd: { label: "GBP/USD", symbolWithRange: "FX:GBPUSD|1D" },
  dow: { label: "Dow Jones", symbolWithRange: "AMEX:DIA|1D" },
  nasdaq: { label: "Nasdaq", symbolWithRange: "NASDAQ:QQQ|1D" },
};

export const TRADINGVIEW_APP_SYMBOL_TABS: ReadonlyArray<readonly [string, string]> =
  MARKETS_DASHBOARD_ASSETS.map((asset) => {
    const row = TRADINGVIEW_TAB_BY_ASSET_ID[asset.id];
    return [row.label, row.symbolWithRange] as const;
  });
