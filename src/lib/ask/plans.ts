import { z } from "zod";

import type { PlanCard } from "@/lib/ask/contracts";
import { generateProjectionCard } from "@/lib/ask/projections";

export const generateGrowthPlanInputSchema = z.object({
  startBalance: z.number().nonnegative().describe("Starting trading balance or deposited capital."),
  monthlyAdd: z.number().nonnegative().optional().describe("Optional monthly top-up amount."),
  currencySymbol: z.string().min(1).max(4).optional().describe("Display currency symbol such as $, £, or €."),
  projectionMonths: z.number().int().positive().max(120).optional().describe("Projection length in months."),
});

export type GenerateGrowthPlanInput = z.input<typeof generateGrowthPlanInputSchema>;

const DEFAULT_CURRENCY_SYMBOL = "£";
const DEFAULT_MONTHLY_ADD = 0;
const DEFAULT_PROJECTION_MONTHS = 12;
const DEFAULT_MONTHLY_RETURN_PERCENT = 4;
const DEFAULT_DRAWDOWN_EVERY_MONTHS = 4;
const DEFAULT_DRAWDOWN_PERCENT = 5;

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function formatMoney(value: number, currencySymbol: string) {
  const rounded = roundMoney(value);
  const hasDecimals = Math.abs(rounded % 1) > Number.EPSILON;
  const formatted = rounded.toLocaleString("en-GB", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: hasDecimals ? 2 : 0,
  });

  return `${currencySymbol}${formatted}`;
}

function formatMoneyRange(low: number, high: number, currencySymbol: string) {
  return `${formatMoney(low, currencySymbol)}-${formatMoney(high, currencySymbol)}`;
}

function parseFlexibleNumber(fragment: string) {
  const normalized = fragment.replace(/,/g, "").trim().toLowerCase();
  const multiplier = normalized.endsWith("k") ? 1_000 : normalized.endsWith("m") ? 1_000_000 : 1;
  const numeric = Number.parseFloat(normalized.replace(/[^\d.]/g, ""));

  if (!Number.isFinite(numeric)) {
    return null;
  }

  return numeric * multiplier;
}

function extractCurrencySymbol(amountText: string) {
  const symbol = amountText.match(/[$£€]/)?.[0];
  return symbol ?? DEFAULT_CURRENCY_SYMBOL;
}

function extractAmount(
  message: string,
  patterns: RegExp[],
): {
  value: number;
  currencySymbol: string;
} | null {
  for (const pattern of patterns) {
    const match = message.match(pattern);
    const amountText = match?.[1];

    if (!amountText) {
      continue;
    }

    const value = parseFlexibleNumber(amountText);
    if (!value || value < 0) {
      continue;
    }

    return {
      value,
      currencySymbol: extractCurrencySymbol(amountText),
    };
  }

  return null;
}

function resolveGrowthPlanInput(input: GenerateGrowthPlanInput) {
  return {
    startBalance: roundMoney(input.startBalance),
    monthlyAdd: roundMoney(input.monthlyAdd ?? DEFAULT_MONTHLY_ADD),
    currencySymbol: input.currencySymbol ?? DEFAULT_CURRENCY_SYMBOL,
    projectionMonths: input.projectionMonths ?? DEFAULT_PROJECTION_MONTHS,
  };
}

export function generateGrowthPlanCard(input: GenerateGrowthPlanInput): PlanCard {
  const resolved = resolveGrowthPlanInput(input);
  const { startBalance, monthlyAdd, currencySymbol, projectionMonths } = resolved;

  const dailyLow = startBalance * 0.0025;
  const dailyHigh = startBalance * 0.005;
  const weeklyLow = startBalance * 0.01;
  const weeklyHigh = startBalance * 0.02;
  const monthlyLow = startBalance * 0.04;
  const monthlyHigh = startBalance * 0.08;
  const maxDailyLoss = startBalance * 0.01;

  const projection = generateProjectionCard({
    months: projectionMonths,
    startBalance,
    monthlyAdd,
    currencySymbol,
    monthlyReturnPercent: DEFAULT_MONTHLY_RETURN_PERCENT,
    drawdownEveryMonths: DEFAULT_DRAWDOWN_EVERY_MONTHS,
    drawdownPercent: DEFAULT_DRAWDOWN_PERCENT,
  });

  const topUpMessage =
    monthlyAdd > 0
      ? ` Projection includes a ${formatMoney(monthlyAdd, currencySymbol)} monthly top-up.`
      : "";

  return {
    type: "plan",
    startBalance,
    monthlyAdd,
    currencySymbol,
    dailyTarget: formatMoneyRange(dailyLow, dailyHigh, currencySymbol),
    weeklyTarget: formatMoneyRange(weeklyLow, weeklyHigh, currencySymbol),
    monthlyTarget: formatMoneyRange(monthlyLow, monthlyHigh, currencySymbol),
    maxDailyLoss: formatMoney(maxDailyLoss, currencySymbol),
    projectionMonths,
    projectedBalance: projection.projectedBalance,
    projectionReturn: projection.totalReturn,
    rationale: `This plan is built around consistency targets for a small account, not aggressive income expectations. Aim for clean execution first and only move size up after you can hold the low end of the range for several months.${topUpMessage}`,
    verdict: `Keep daily loss capped near ${formatMoney(maxDailyLoss, currencySymbol)}. Treat the daily range as a ceiling, not a quota, and focus on ${formatMoney(monthlyLow, currencySymbol)}-${formatMoney(monthlyHigh, currencySymbol)} per month before scaling.`,
  };
}

function isGrowthPlanRequest(message: string) {
  return (
    /\b(plan|target|goal|aim)\b/.test(message) &&
    /\b(daily|weekly|monthly|month)\b/.test(message)
  );
}

export function extractGrowthPlanShortcutCard(message: string) {
  const normalized = message.toLowerCase();
  if (!isGrowthPlanRequest(normalized)) {
    return null;
  }

  const startAmount = extractAmount(normalized, [
    /(?:deposit(?:ed)?|balance|capital|account|start(?:ing)?(?: with)?|from)\s+([$£€]?\s*\d[\d,]*(?:\.\d+)?\s*[km]?)/i,
    /([$£€]?\s*\d[\d,]*(?:\.\d+)?\s*[km]?)\s+(?:deposit|balance|capital|account)/i,
    /(?:have|got)\s+([$£€]?\s*\d[\d,]*(?:\.\d+)?\s*[km]?)/i,
  ]);

  if (!startAmount) {
    return null;
  }

  const monthlyAddAmount = extractAmount(normalized, [
    /(?:top\s*up|add|adding|contribute|deposit)\s+([$£€]?\s*\d[\d,]*(?:\.\d+)?\s*[km]?)\s*(?:\/\s*month|per month|monthly|each month)/i,
  ]);

  const monthsMatch = normalized.match(/(\d{1,3})\s*[- ]?(?:month|months|mo)\b/i);
  const projectionMonths = monthsMatch?.[1] ? Number.parseInt(monthsMatch[1], 10) : undefined;

  return generateGrowthPlanCard({
    startBalance: startAmount.value,
    monthlyAdd: monthlyAddAmount?.value,
    currencySymbol: startAmount.currencySymbol,
    projectionMonths,
  });
}
