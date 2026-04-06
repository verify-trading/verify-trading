import { z } from "zod";

import type { CalcCard } from "@/lib/ask/contracts";

const supportedAccountCurrencySchema = z.enum(["GBP", "USD", "EUR"]);
const genericCurrencySchema = z.string().trim().regex(/^[A-Z]{3}$/);
const forexPairSchema = z.string().trim().regex(/^[A-Z]{3}\/?[A-Z]{3}$/);

export const calculatePositionSizeInputSchema = z.object({
  accountSize: z.number().positive().describe("Trading account balance."),
  riskPercent: z.number().positive().describe("Percentage of the account to risk."),
  stopLossPips: z.number().positive().describe("Stop loss distance in pips."),
  pipValuePerLot: z.number().positive().optional().describe("Pip value for one standard lot when already known."),
  pair: forexPairSchema.optional().describe("Forex pair such as EUR/USD."),
  quoteToAccountRate: z.number().positive().optional().describe("Quote-currency to account-currency conversion rate when needed."),
  exchangeRate: z.number().positive().optional().describe("Live pair price used when the account currency matches the pair base currency."),
  accountCurrency: supportedAccountCurrencySchema.optional().default("GBP").describe("Account currency."),
});

export const calculateRiskRewardInputSchema = z
  .object({
    direction: z.enum(["long", "short"]).optional(),
    riskPips: z.number().positive().optional().describe("Distance from entry to stop in pips."),
    rewardPips: z.number().positive().optional().describe("Distance from entry to target in pips."),
    entryPrice: z.number().positive().optional().describe("Trade entry price."),
    stopPrice: z.number().positive().optional().describe("Stop loss price."),
    targetPrice: z.number().positive().optional().describe("Take profit price."),
  })
  .superRefine((value, ctx) => {
    const hasPipInputs = value.riskPips && value.rewardPips;
    const hasPriceInputs = value.entryPrice && value.stopPrice && value.targetPrice;

    if (!hasPipInputs && !hasPriceInputs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Provide either riskPips and rewardPips, or entryPrice, stopPrice, and targetPrice.",
      });
    }
  });

export const calculatePipValueInputSchema = z.object({
  pair: forexPairSchema.describe("Forex pair such as EUR/USD."),
  lotSize: z.number().positive().describe("Lot size in standard lots."),
  contractSize: z.number().positive().optional().default(100_000).describe("Units per lot."),
  accountCurrency: genericCurrencySchema.optional().describe("Account currency."),
  quoteToAccountRate: z.number().positive().optional().describe("Quote-currency to account-currency conversion rate."),
  exchangeRate: z.number().positive().optional().describe("Base-to-quote exchange rate when the account currency matches the base currency."),
});

export const calculateMarginRequirementInputSchema = z.object({
  pair: forexPairSchema.describe("Forex pair such as EUR/USD."),
  lotSize: z.number().positive().describe("Lot size in standard lots."),
  price: z.number().positive().optional().describe("Current or entry price."),
  leverage: z.number().positive().optional().describe("Account leverage, for example 30 for 30:1."),
  marginRate: z.number().positive().max(1).optional().describe("Margin rate as a decimal, for example 0.0333."),
  contractSize: z.number().positive().optional().default(100_000).describe("Units per lot."),
  accountCurrency: genericCurrencySchema.optional().describe("Account currency."),
  baseToAccountRate: z.number().positive().optional().describe("Base-currency to account-currency conversion rate when needed."),
});

export const calculateProfitLossInputSchema = z.object({
  pair: forexPairSchema.describe("Forex pair such as EUR/USD."),
  direction: z.enum(["long", "short"]).describe("Trade direction."),
  entryPrice: z.number().positive().describe("Trade entry price."),
  exitPrice: z.number().positive().describe("Trade exit price."),
  lotSize: z.number().positive().describe("Lot size in standard lots."),
  contractSize: z.number().positive().optional().default(100_000).describe("Units per lot."),
  accountCurrency: genericCurrencySchema.optional().describe("Account currency."),
  quoteToAccountRate: z.number().positive().optional().describe("Quote-currency to account-currency conversion rate when needed."),
});

export type CalculatePositionSizeInput = z.input<typeof calculatePositionSizeInputSchema>;
export type CalculateRiskRewardInput = z.input<typeof calculateRiskRewardInputSchema>;
export type CalculatePipValueInput = z.input<typeof calculatePipValueInputSchema>;
export type CalculateMarginRequirementInput = z.input<
  typeof calculateMarginRequirementInputSchema
>;
export type CalculateProfitLossInput = z.input<typeof calculateProfitLossInputSchema>;

export interface RiskRewardResult {
  riskDistance: number;
  rewardDistance: number;
  ratio: number;
}

export interface PipValueResult {
  pair: string;
  lotSize: number;
  pipSize: number;
  pipValue: number;
  currency: string;
}

export interface MarginRequirementResult {
  pair: string;
  lotSize: number;
  marginRate: number;
  marginRequired: number;
  currency: string;
}

export interface ProfitLossResult {
  pair: string;
  direction: "long" | "short";
  lotSize: number;
  profitLoss: number;
  pipsMoved: number;
  currency: string;
}

export function normalizeForexPair(pair: string) {
  const normalized = pair.toUpperCase().replace("/", "");
  if (!/^[A-Z]{6}$/.test(normalized)) {
    throw new Error(`Unsupported forex pair format: ${pair}`);
  }

  return {
    pair: `${normalized.slice(0, 3)}/${normalized.slice(3, 6)}`,
    base: normalized.slice(0, 3),
    quote: normalized.slice(3, 6),
  };
}

export function getPipSize(pair: string) {
  const { quote } = normalizeForexPair(pair);
  return quote === "JPY" ? 0.01 : 0.0001;
}

export function calculateRiskAmount(accountSize: number, riskPercent: number) {
  return (accountSize * riskPercent) / 100;
}

function formatNumber(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function formatCurrency(amount: number, currency: string) {
  const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : null;
  const formattedAmount = amount.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return symbol ? `${symbol}${formattedAmount}` : `${currency} ${formattedAmount}`;
}

function resolveQuoteToAccountRate({
  pair,
  accountCurrency,
  quoteToAccountRate,
  exchangeRate,
}: {
  pair: string;
  accountCurrency?: string;
  quoteToAccountRate?: number;
  exchangeRate?: number;
}) {
  const { base, quote } = normalizeForexPair(pair);
  const homeCurrency = accountCurrency ?? quote;

  if (homeCurrency === quote) {
    return 1;
  }

  if (quoteToAccountRate) {
    return quoteToAccountRate;
  }

  if (homeCurrency === base && exchangeRate) {
    return 1 / exchangeRate;
  }

  throw new Error("Quote-to-account conversion data is required for this currency setup.");
}

function resolveBaseToAccountRate({
  pair,
  price,
  accountCurrency,
  baseToAccountRate,
}: {
  pair: string;
  price: number;
  accountCurrency?: string;
  baseToAccountRate?: number;
}) {
  const { base, quote } = normalizeForexPair(pair);
  const homeCurrency = accountCurrency ?? quote;

  if (homeCurrency === base) {
    return 1;
  }

  if (homeCurrency === quote) {
    return price;
  }

  if (baseToAccountRate) {
    return baseToAccountRate;
  }

  throw new Error("Base-to-account conversion data is required for this currency setup.");
}

export function calculatePipValue(input: CalculatePipValueInput): PipValueResult {
  const parsed = calculatePipValueInputSchema.parse(input);
  const pipSize = getPipSize(parsed.pair);
  const { pair, quote } = normalizeForexPair(parsed.pair);
  const units = parsed.lotSize * parsed.contractSize;
  const quoteToAccountRate = resolveQuoteToAccountRate({
    pair,
    accountCurrency: parsed.accountCurrency,
    quoteToAccountRate: parsed.quoteToAccountRate,
    exchangeRate: parsed.exchangeRate,
  });
  const pipValue = units * pipSize * quoteToAccountRate;

  return {
    pair,
    lotSize: parsed.lotSize,
    pipSize,
    pipValue: formatNumber(pipValue, 4),
    currency: parsed.accountCurrency ?? quote,
  };
}

export function calculatePositionSize(input: CalculatePositionSizeInput) {
  const parsed = calculatePositionSizeInputSchema.parse(input);
  const riskAmount = calculateRiskAmount(parsed.accountSize, parsed.riskPercent);
  const pipValuePerLot =
    parsed.pipValuePerLot ??
    (parsed.pair
      ? calculatePipValue({
          pair: parsed.pair,
          lotSize: 1,
          contractSize: 100_000,
          accountCurrency: parsed.accountCurrency,
          quoteToAccountRate: parsed.quoteToAccountRate,
          exchangeRate: parsed.exchangeRate,
        }).pipValue
      : 10);
  const lots = riskAmount / (parsed.stopLossPips * pipValuePerLot);

  return {
    lots,
    riskAmount,
    pipValuePerLot,
  };
}

export function calculatePositionSizeCard(input: CalculatePositionSizeInput): CalcCard {
  const parsed = calculatePositionSizeInputSchema.parse(input);
  const result = calculatePositionSize(parsed);

  return {
    type: "calc",
    lots: result.lots.toFixed(2),
    risk_amount: formatCurrency(result.riskAmount, parsed.accountCurrency),
    account: formatCurrency(parsed.accountSize, parsed.accountCurrency),
    risk_pct: `${parsed.riskPercent}%`,
    sl_pips: `${parsed.stopLossPips}`,
    verdict: "Size down first. Protect the downside before chasing the upside.",
  };
}

export function calculateRiskReward(input: CalculateRiskRewardInput): RiskRewardResult {
  const parsed = calculateRiskRewardInputSchema.parse(input);

  const riskDistance =
    parsed.riskPips ??
    Math.abs(
      parsed.direction === "short"
        ? Number(parsed.stopPrice) - Number(parsed.entryPrice)
        : Number(parsed.entryPrice) - Number(parsed.stopPrice),
    );
  const rewardDistance =
    parsed.rewardPips ??
    Math.abs(
      parsed.direction === "short"
        ? Number(parsed.entryPrice) - Number(parsed.targetPrice)
        : Number(parsed.targetPrice) - Number(parsed.entryPrice),
    );

  return {
    riskDistance: formatNumber(riskDistance, 4),
    rewardDistance: formatNumber(rewardDistance, 4),
    ratio: formatNumber(rewardDistance / riskDistance, 4),
  };
}

export function calculateMarginRequirement(
  input: CalculateMarginRequirementInput,
): MarginRequirementResult {
  const parsed = calculateMarginRequirementInputSchema.parse(input);
  if (!parsed.price) {
    throw new Error("Price is required to calculate margin.");
  }
  const { pair, quote } = normalizeForexPair(parsed.pair);
  const marginRate =
    parsed.marginRate ?? (parsed.leverage ? 1 / parsed.leverage : 1 / 30);
  const units = parsed.lotSize * parsed.contractSize;
  const baseToAccountRate = resolveBaseToAccountRate({
    pair,
    price: parsed.price,
    accountCurrency: parsed.accountCurrency,
    baseToAccountRate: parsed.baseToAccountRate,
  });
  const marginRequired = units * baseToAccountRate * marginRate;

  return {
    pair,
    lotSize: parsed.lotSize,
    marginRate: formatNumber(marginRate, 6),
    marginRequired: formatNumber(marginRequired, 2),
    currency: parsed.accountCurrency ?? quote,
  };
}

export function calculateProfitLoss(input: CalculateProfitLossInput): ProfitLossResult {
  const parsed = calculateProfitLossInputSchema.parse(input);
  const pipSize = getPipSize(parsed.pair);
  const { pair, quote } = normalizeForexPair(parsed.pair);
  const units = parsed.lotSize * parsed.contractSize;
  const rawMove =
    parsed.direction === "long"
      ? parsed.exitPrice - parsed.entryPrice
      : parsed.entryPrice - parsed.exitPrice;
  const quoteToAccountRate = resolveQuoteToAccountRate({
    pair,
    accountCurrency: parsed.accountCurrency,
    quoteToAccountRate: parsed.quoteToAccountRate,
    exchangeRate: parsed.exitPrice,
  });
  const profitLoss = rawMove * units * quoteToAccountRate;

  return {
    pair,
    direction: parsed.direction,
    lotSize: parsed.lotSize,
    profitLoss: formatNumber(profitLoss, 2),
    pipsMoved: formatNumber(rawMove / pipSize, 1),
    currency: parsed.accountCurrency ?? quote,
  };
}
