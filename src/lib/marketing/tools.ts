import {
  calculateMarginRequirement,
  calculatePipValue,
  calculatePositionSize,
  calculateRiskReward,
  getPipSize,
  normalizeForexPair,
} from "@/lib/ask/calculators";

/**
 * Thin, pure wrappers over the shared calculators in src/lib/ask/calculators.ts, used by the
 * public tool pages. They add the currency-conversion rules for a chosen account currency and
 * return null (never throw) so the UI can show a hint instead of a crash.
 */

export const TOOL_PAIRS = ["EUR/USD", "GBP/USD", "AUD/USD", "NZD/USD", "USD/JPY", "USD/CAD", "USD/CHF", "EUR/GBP", "EUR/JPY", "GBP/JPY"] as const;
export const ACCOUNT_CURRENCIES = ["USD", "GBP", "EUR"] as const;
export const CONTRACT_SIZE = 100_000;

/** True when neither side of the pair is the account currency, so the user must supply a rate. */
export function needsQuoteRate(pair: string, account: string): boolean {
  const { base, quote } = normalizeForexPair(pair);
  return account !== base && account !== quote;
}

/** True when the pair's base is the account currency, so the pair price is needed to convert. */
export function needsPrice(pair: string, account: string): boolean {
  return normalizeForexPair(pair).base === account;
}

export function pipValuePerLot(input: {
  pair: string;
  lots?: number;
  account: string;
  price?: number;
  quoteToAccountRate?: number;
}): { pipValue: number; pipSize: number } | null {
  try {
    const needRate = needsQuoteRate(input.pair, input.account);
    if (needRate && !(input.quoteToAccountRate && input.quoteToAccountRate > 0)) return null;
    if (needsPrice(input.pair, input.account) && !(input.price && input.price > 0)) return null;
    const r = calculatePipValue({
      pair: input.pair,
      lotSize: input.lots ?? 1,
      contractSize: CONTRACT_SIZE,
      accountCurrency: input.account,
      quoteToAccountRate: needRate ? input.quoteToAccountRate : undefined,
      exchangeRate: input.price,
    });
    return { pipValue: r.pipValue, pipSize: r.pipSize };
  } catch {
    return null;
  }
}

export function sizePosition(input: { accountSize: number; riskPercent: number; stopPips: number; pipValuePerLot: number }) {
  if (![input.accountSize, input.riskPercent, input.stopPips, input.pipValuePerLot].every((n) => n > 0)) return null;
  const r = calculatePositionSize({
    accountSize: input.accountSize,
    riskPercent: input.riskPercent,
    stopLossPips: input.stopPips,
    pipValuePerLot: input.pipValuePerLot,
  });
  return { lots: r.lots, riskAmount: r.riskAmount, units: r.lots * CONTRACT_SIZE };
}

/** Share of trades that must win to break even at a reward:risk ratio, before costs: 1 / (1 + ratio). */
export const breakEvenWinRate = (ratio: number) => (ratio > 0 ? 1 / (1 + ratio) : null);

export type RiskRewardCheck =
  | { ok: true; ratio: number; riskDistance: number; rewardDistance: number; riskPips: number; rewardPips: number; breakEven: number }
  | { ok: false; message: string };

export function riskReward(input: { pair: string; direction: "long" | "short"; entry: number; stop: number; target: number }): RiskRewardCheck {
  const { direction: d, entry, stop, target } = input;
  if (![entry, stop, target].every((n) => n > 0)) return { ok: false, message: "Enter an entry, stop and target price." };
  const valid = d === "long" ? stop < entry && target > entry : stop > entry && target < entry;
  if (!valid) {
    return { ok: false, message: d === "long" ? "For a long trade the stop must be below the entry and the target above it." : "For a short trade the stop must be above the entry and the target below it." };
  }
  const r = calculateRiskReward({ direction: d, entryPrice: entry, stopPrice: stop, targetPrice: target });
  const pip = getPipSize(input.pair);
  return {
    ok: true,
    ratio: r.ratio,
    riskDistance: r.riskDistance,
    rewardDistance: r.rewardDistance,
    riskPips: r.riskDistance / pip,
    rewardPips: r.rewardDistance / pip,
    breakEven: 1 / (1 + r.ratio),
  };
}

export function marginRequired(input: {
  pair: string;
  lots: number;
  price: number;
  leverage: number;
  account: string;
  baseToAccountRate?: number;
}) {
  try {
    if (![input.lots, input.price, input.leverage].every((n) => n > 0)) return null;
    const { base, quote } = normalizeForexPair(input.pair);
    const rateNeeded = input.account !== base && input.account !== quote;
    if (rateNeeded && !(input.baseToAccountRate && input.baseToAccountRate > 0)) return null;
    const r = calculateMarginRequirement({
      pair: input.pair,
      lotSize: input.lots,
      price: input.price,
      leverage: input.leverage,
      contractSize: CONTRACT_SIZE,
      accountCurrency: input.account,
      baseToAccountRate: rateNeeded ? input.baseToAccountRate : undefined,
    });
    return { margin: r.marginRequired, marginRate: r.marginRate };
  } catch {
    return null;
  }
}
