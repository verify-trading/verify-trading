import { z } from "zod";

import type { ProjectionCard } from "@/lib/ask/contracts";

export const generateProjectionInputSchema = z.object({
  months: z.number().int().positive().max(120).describe("Projection length in months."),
  startBalance: z.number().nonnegative().describe("Starting account balance."),
  monthlyAdd: z.number().nonnegative().optional().describe("Monthly deposit or top-up."),
  monthlyReturnPercent: z.number().positive().optional().describe("Expected monthly percentage return."),
  drawdownEveryMonths: z.number().int().positive().optional().describe("How often a drawdown event happens in months."),
  drawdownPercent: z.number().nonnegative().optional().describe("Percentage hit applied on each drawdown event."),
});

export type GenerateProjectionInput = z.input<typeof generateProjectionInputSchema>;

type ResolvedProjectionInput = {
  months: number;
  startBalance: number;
  monthlyAdd: number;
  monthlyReturnPercent: number;
  drawdownEveryMonths: number;
  drawdownPercent: number;
};

const DEFAULT_MONTHLY_ADD = 0;
const DEFAULT_MONTHLY_RETURN_PERCENT = 3;
const DEFAULT_DRAWDOWN_EVERY_MONTHS = 3;
const DEFAULT_DRAWDOWN_PERCENT = 8;

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

export function calculateCompoundBalance(
  startBalance: number,
  monthlyReturnPercent: number,
  months: number,
) {
  return roundMoney(startBalance * Math.pow(1 + monthlyReturnPercent / 100, months));
}

function resolveProjectionInput(input: GenerateProjectionInput): ResolvedProjectionInput {
  return {
    months: input.months,
    startBalance: input.startBalance,
    monthlyAdd: input.monthlyAdd ?? DEFAULT_MONTHLY_ADD,
    monthlyReturnPercent: input.monthlyReturnPercent ?? DEFAULT_MONTHLY_RETURN_PERCENT,
    drawdownEveryMonths: input.drawdownEveryMonths ?? DEFAULT_DRAWDOWN_EVERY_MONTHS,
    drawdownPercent: input.drawdownPercent ?? DEFAULT_DRAWDOWN_PERCENT,
  };
}

function buildProjectionVerdict(input: GenerateProjectionInput, resolved: ResolvedProjectionInput) {
  const usesDefaultReturn = input.monthlyReturnPercent == null;
  const usesDefaultDrawdownEveryMonths = input.drawdownEveryMonths == null;
  const usesDefaultDrawdownPercent = input.drawdownPercent == null;
  const usesBaseCase =
    usesDefaultReturn || usesDefaultDrawdownEveryMonths || usesDefaultDrawdownPercent;

  if (resolved.drawdownEveryMonths > 0 && resolved.drawdownPercent > 0) {
    if (usesBaseCase) {
      return `Base case uses ${resolved.monthlyReturnPercent}% monthly returns with ${resolved.drawdownPercent}% drawdowns every ${resolved.drawdownEveryMonths} months. Use your real return and drawdown profile for a tighter forecast.`;
    }

    return `Using ${resolved.monthlyReturnPercent}% monthly returns with ${resolved.drawdownPercent}% drawdowns every ${resolved.drawdownEveryMonths} months.`;
  }

  if (usesBaseCase) {
    return `Base case uses ${resolved.monthlyReturnPercent}% monthly returns with no drawdown model. Treat that as optimistic, not guaranteed.`;
  }

  return `Using ${resolved.monthlyReturnPercent}% monthly returns with no drawdown model.`;
}

export function generateProjectionCard(input: GenerateProjectionInput): ProjectionCard {
  const resolved = resolveProjectionInput(input);
  let balance = resolved.startBalance;
  let lossEvents = 0;
  const dataPoints: number[] = [];

  for (let month = 1; month <= resolved.months; month += 1) {
    balance += resolved.monthlyAdd;
    balance *= 1 + resolved.monthlyReturnPercent / 100;

    if (
      resolved.drawdownEveryMonths > 0 &&
      resolved.drawdownPercent > 0 &&
      month % resolved.drawdownEveryMonths === 0
    ) {
      balance *= 1 - resolved.drawdownPercent / 100;
      lossEvents += 1;
    }

    dataPoints.push(roundMoney(balance));
  }

  const totalContributed = resolved.startBalance + resolved.monthlyAdd * resolved.months;
  const totalReturn = totalContributed === 0 ? 0 : ((balance - totalContributed) / totalContributed) * 100;

  return {
    type: "projection",
    months: resolved.months,
    startBalance: roundMoney(resolved.startBalance),
    monthlyAdd: roundMoney(resolved.monthlyAdd),
    projectedBalance: roundMoney(balance),
    dataPoints,
    totalReturn: `${totalReturn.toFixed(1)}%`,
    lossEvents,
    verdict: buildProjectionVerdict(input, resolved),
  };
}
