import { getMarketQuote, getMarketSeries } from "@/lib/ask/market";
import type { HeroLiveBriefing } from "@/components/landing/hero-ask-demo/types";

export type { HeroLiveBriefing };

function usd(value: number, decimals: number): string {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/** Normalise a close series to 0..1 for the inline sparkline. */
function normalizeSeries(values: number[]): number[] {
  if (values.length < 2) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (!(max > min)) return [];
  return values.map((v) => Number(((v - min) / (max - min)).toFixed(3)));
}

async function buildGoldBriefing(): Promise<HeroLiveBriefing | null> {
  // No { live: true } → rides Next's data cache, so the public landing page
  // reuses the cached quote rather than hitting the provider on every render.
  const [quote, series] = await Promise.all([
    getMarketQuote("XAU/USD"),
    getMarketSeries("XAU/USD", "1D"),
  ]);

  const seriesNorm = normalizeSeries(series.closeValues);
  if (!Number.isFinite(quote.price) || quote.price <= 0 || seriesNorm.length < 2) {
    return null;
  }

  const up = quote.direction === "up" || quote.changePercent >= 0;
  const support = usd(Math.round(series.support), 0);
  const resistance = usd(Math.round(series.resistance), 0);

  return {
    price: usd(quote.price, 2),
    change: `${Math.abs(quote.changePercent).toFixed(2)}%`,
    direction: up ? "up" : "down",
    level1: resistance,
    level2: support,
    series: seriesNorm,
    verdict: up
      ? `Holding above ${support} keeps the intraday bias bullish. Lose it and the move stalls.`
      : `Back below ${resistance} keeps the bias heavy. Reclaim it and the tone turns bullish.`,
    event: undefined,
  };
}

/**
 * Real gold briefing for the landing hero, from the same cached market data the
 * Ask briefing card uses. Capped at 2.5s and returns null on any failure so the
 * public page never blocks and the demo falls back to its scripted card.
 */
export async function getHeroGoldBriefing(): Promise<HeroLiveBriefing | null> {
  try {
    return await Promise.race([
      buildGoldBriefing(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
    ]);
  } catch {
    return null;
  }
}
