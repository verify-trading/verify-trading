/** Markets data layer for Twelve Data integration.
 *  Reads from cached DB snapshots (populated by cron job).
 */

import type { MarketSeriesTimeframe, TwelveDataQuote } from "@/lib/markets/twelve-data-adapter";
import type { MarketIntelligenceSnapshot } from "@/lib/markets/market-intelligence";

export type MarketsCategory = "major_pairs" | "commodities" | "crypto" | "indices";

export const CATEGORY_CONFIG: Record<MarketsCategory, { label: string; symbols: string[]; displayNames?: Record<string, string> }> = {
  major_pairs: {
    label: "Major Pairs",
    symbols: ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD", "USD/CHF"],
  },
  commodities: {
    label: "Commodities",
    symbols: ["XAU/USD", "XAG/USD", "WTI/USD", "XBR/USD", "XPT/USD", "XPD/USD"],
  },
  crypto: {
    label: "Crypto",
    symbols: ["BTC/USD", "ETH/USD", "SOL/USD", "XRP/USD", "BNB/USD", "ADA/USD"],
  },
  indices: {
    label: "Indices",
    symbols: ["QQQ", "DIA", "EWU", "EWG", "EWJ", "EWH"],
    displayNames: {
      QQQ: "Nasdaq",
      DIA: "Dow",
      EWU: "FTSE",
      EWG: "DAX",
      EWJ: "Nikkei",
      EWH: "Hong Kong",
    },
  },
};

export type MarketCardData = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  percent_change: number;
  isUp: boolean;
  exchange: string;
  sparkline: number[];
};

export type TwelveMarketsSnapshot = {
  updatedAt: string | null;
  quotes: Record<string, TwelveDataQuote>;
  sparklines: Record<string, number[]>;
  seriesByTimeframe?: Partial<Record<MarketSeriesTimeframe, Record<string, number[]>>>;
};

export async function fetchTwelveMarketsSnapshot(): Promise<TwelveMarketsSnapshot> {
  const response = await fetch("/api/markets");
  if (!response.ok) {
    throw new Error(`Markets request failed with ${response.status}.`);
  }
  return (await response.json()) as TwelveMarketsSnapshot;
}

export function buildCategoryCards(
  category: MarketsCategory,
  snapshot: TwelveMarketsSnapshot | undefined,
): MarketCardData[] {
  const config = CATEGORY_CONFIG[category];
  return config.symbols.map((sym) => {
    const quote = snapshot?.quotes?.[sym];
    const sparkline = snapshot?.sparklines?.[sym] ?? [];
    const displayName = config.displayNames?.[sym] ?? sym;

    if (!quote) {
      return {
        symbol: sym,
        name: displayName,
        price: 0,
        change: 0,
        percent_change: 0,
        isUp: false,
        exchange: "—",
        sparkline: [],
      };
    }

    return {
      symbol: sym,
      name: config.displayNames?.[sym] ?? quote.name ?? sym,
      price: quote.price,
      change: quote.change,
      percent_change: quote.percent_change,
      isUp: quote.percent_change >= 0,
      exchange: quote.exchange,
      sparkline,
    };
  });
}

export function formatPrice(symbol: string, price: number): string {
  if (!Number.isFinite(price) || price <= 0) return "—";

  // Forex: 5 decimals
  if (symbol.includes("/USD") && !symbol.startsWith("X")) {
    return price.toFixed(5);
  }
  // Crypto: 2 decimals for large, 4 for small
  if (["BTC/USD", "ETH/USD", "BNB/USD"].includes(symbol)) {
    return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (["SOL/USD", "XRP/USD"].includes(symbol)) {
    return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  // Commodities: 2 decimals
  if (symbol.startsWith("X") || symbol.includes("WTI") || symbol.includes("XBR")) {
    return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  return price.toFixed(2);
}

export function formatChange(percent: number): string {
  const sign = percent >= 0 ? "+" : "";
  return `${sign}${percent.toFixed(2)}%`;
}

export function formatAbsoluteChange(symbol: string, change: number): string {
  if (!Number.isFinite(change)) return "—";

  const sign = change >= 0 ? "+" : "";
  const absolute = Math.abs(change);

  if (symbol.includes("/") && !symbol.startsWith("X")) {
    return `${sign}${absolute.toFixed(5)}`;
  }

  const formatted = absolute.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${sign}US$${formatted}`;
}

import type { EconomicCalendarSnapshot } from "@/lib/markets/economic-calendar";

export async function fetchEconomicCalendar(): Promise<EconomicCalendarSnapshot> {
  const response = await fetch("/api/markets/calendar");
  if (!response.ok) {
    throw new Error(`Calendar request failed with ${response.status}.`);
  }
  return response.json() as Promise<EconomicCalendarSnapshot>;
}

export async function fetchMarketIntelligence(): Promise<MarketIntelligenceSnapshot> {
  const response = await fetch("/api/markets/intelligence");
  if (!response.ok) {
    throw new Error(`Market intelligence request failed with ${response.status}.`);
  }
  return response.json() as Promise<MarketIntelligenceSnapshot>;
}

export function buildSparklinePath(values: number[], width = 120, height = 40): string {
  if (values.length < 2) return "";

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 2;
  const innerH = height - pad * 2;

  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - pad - ((v - min) / range) * innerH;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}
