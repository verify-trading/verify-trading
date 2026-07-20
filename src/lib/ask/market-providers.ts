import { MARKET_CATEGORIES, type TwelveDataQuote, type TwelveDataSparkline } from "@/lib/markets/twelve-data-adapter";
import type { MarketInstrument, MarketQuote } from "./market";

/**
 * Bridges the Ask market path (canonical FMP-style symbols) to Twelve Data.
 * Twelve Data uses slash pairs for forex/commodity/crypto ("GBP/USD", "XAU/USD",
 * "BTC/USD") and bare tickers for stocks/ETFs ("QQQ"). We keep the FMP symbol on
 * the returned card unchanged and only translate at the Twelve Data call boundary.
 */

/** compact form ("GBPUSD") → Twelve Data slash form ("GBP/USD"), derived from the Markets tab lists. */
const SLASH_BY_COMPACT = new Map<string, string>(
  Object.values(MARKET_CATEGORIES)
    .flatMap((category) => category.symbols)
    .map((symbol) => [symbol.replace(/\//g, ""), symbol] as const),
);

/**
 * FMP serves several instruments as futures symbols that Twelve Data exposes as
 * spot pairs, so the compact/slash rule alone can't reach them. Gold, silver, and
 * Brent are the ones the Ask supported-asset list resolves to.
 */
const FMP_FUTURES_ALIASES: Record<string, string> = {
  GCUSD: "XAU/USD", // gold futures → gold spot
  SIUSD: "XAG/USD", // silver futures → silver spot
  BZUSD: "XBR/USD", // Brent crude futures → Brent spot
};

/**
 * Translate a canonical FMP-style symbol to the symbol Twelve Data expects.
 * Returns null when Twelve Data can't serve it (index symbols like ^IXIC/^DJI on
 * the free tier), signalling the caller to skip straight to the FMP fallback.
 */
export function toTwelveDataSymbol(canonicalSymbol: string): string | null {
  const symbol = canonicalSymbol.trim().toUpperCase();
  if (!symbol) {
    return null;
  }

  const alias = FMP_FUTURES_ALIASES[symbol];
  if (alias) {
    return alias;
  }

  // FMP index symbols (^IXIC, ^DJI) are not on the Twelve Data free tier → let FMP serve them.
  if (symbol.startsWith("^")) {
    return null;
  }

  const known = SLASH_BY_COMPACT.get(symbol);
  if (known) {
    return known;
  }

  // Any other 6-letter pair (e.g. a searched NZDUSD) → insert the slash.
  if (/^[A-Z]{6}$/.test(symbol)) {
    return `${symbol.slice(0, 3)}/${symbol.slice(3)}`;
  }

  // Bare stock/ETF ticker (QQQ, AAPL, TSLA) → Twelve Data uses it verbatim.
  return symbol;
}

/** Normalize a Twelve Data quote into the Ask MarketQuote shape, keeping the FMP label + symbol. */
export function twelveDataQuoteToMarketQuote(
  instrument: MarketInstrument,
  quote: TwelveDataQuote,
): MarketQuote {
  return {
    asset: instrument.asset,
    symbol: instrument.symbol,
    price: quote.price,
    changePercent: quote.percent_change,
    direction: quote.percent_change >= 0 ? "up" : "down",
    isMarketOpen: quote.is_market_open,
    ...(instrument.proxyAssumption ? { proxyAssumption: instrument.proxyAssumption } : {}),
  };
}

/** Twelve Data sparklines are already oldest-first close values; keep the finite ones. */
export function twelveDataSparklineToCloseValues(sparkline: TwelveDataSparkline): number[] {
  return sparkline.values.filter((value) => Number.isFinite(value));
}
