import { z } from "zod";

import type { AskUiMeta, SetupCard } from "@/lib/ask/contracts";
import type { MarketQuote, MarketSeries } from "@/lib/ask/market";

export const getMarketSetupInputSchema = z.object({
  asset: z.string().min(1).describe("Market name or symbol such as Gold, Ethereum, EUR/USD, Nasdaq, AAPL, or TSLA."),
  timeframe: z.enum(["1D", "1W", "1M", "3M", "1Y"]).optional().default("1W").describe("Chart window for the setup."),
  side: z.enum(["buy", "sell"]).describe("Trade direction the user is asking about."),
});

export type MarketSetupInput = z.input<typeof getMarketSetupInputSchema>;

function formatPrice(value: number) {
  return value.toFixed(2);
}

function formatRange(min: number, max: number) {
  if (Math.abs(max - min) < 0.005) {
    return formatPrice(min);
  }

  return `${formatPrice(min)}-${formatPrice(max)}`;
}

export function buildMarketSetupCard(
  quote: MarketQuote,
  series: MarketSeries,
  side: "buy" | "sell",
): { card: SetupCard; uiMeta: AskUiMeta } {
  const supportCandidates = series.closeValues.filter((value) => value < quote.price);
  const resistanceCandidates = series.closeValues.filter((value) => value > quote.price);
  const support = supportCandidates.length > 0 ? Math.max(...supportCandidates) : quote.price;
  const resistance = resistanceCandidates.length > 0 ? Math.min(...resistanceCandidates) : quote.price;
  const range = Math.max(Math.abs(resistance - support), Math.abs(quote.price) * 0.002);

  if (side === "buy") {
    const counterTrend = quote.direction === "down";
    const entry = counterTrend ? resistance : support;
    const stop = counterTrend ? support : Math.max(0, support - range * 0.35);
    const risk = Math.max(entry - stop, range * 0.35);
    const target = entry + risk * 2;

    return {
      card: {
        type: "setup",
        asset: quote.asset,
        bias: "Bullish",
        entry: counterTrend
          ? formatPrice(entry)
          : formatRange(Math.max(0, support - range * 0.1), entry),
        stop: formatPrice(stop),
        target: formatPrice(target),
        rr: "2:1",
        rationale: counterTrend
          ? `${quote.asset} is still leaning heavy. For a long, wait for a clean reclaim above resistance instead of catching the knife into support.`
          : `${quote.asset} is holding up. Industry standard is buy the pullback into support, not chase the middle of the range.`,
        confidence: counterTrend ? "Low" : "Medium",
        verdict: counterTrend
          ? `Do not buy weakness here. Buy only if price reclaims ${formatPrice(entry)} and holds.`
          : `Buy the pullback only if support holds. Invalidation sits below ${formatPrice(stop)}.`,
      },
      uiMeta: {
        marketSeries: series.closeValues,
        marketLevelScopeLabel: "Near-term levels",
      },
    };
  }

  const counterTrend = quote.direction === "up";
  const entry = counterTrend ? support : resistance;
  const stop = counterTrend ? resistance : resistance + range * 0.35;
  const risk = Math.max(stop - entry, range * 0.35);
  const target = Math.max(0, entry - risk * 2);

  return {
    card: {
      type: "setup",
      asset: quote.asset,
      bias: "Bearish",
      entry: counterTrend
        ? formatPrice(entry)
        : formatRange(entry, resistance + range * 0.1),
      stop: formatPrice(stop),
      target: formatPrice(target),
      rr: "2:1",
      rationale: counterTrend
        ? `${quote.asset} is still bid. For a short, wait for a clean break below support instead of fading strength blindly.`
        : `${quote.asset} is leaning heavy. Industry standard is sell the pop into resistance, not chase the low after extension.`,
      confidence: counterTrend ? "Low" : "Medium",
      verdict: counterTrend
        ? `Do not short strength here. Sell only if price breaks below ${formatPrice(entry)} and stays offered.`
        : `Sell the rally only if resistance keeps capping price. Invalidation sits above ${formatPrice(stop)}.`,
    },
    uiMeta: {
      marketSeries: series.closeValues,
      marketLevelScopeLabel: "Near-term levels",
    },
  };
}
