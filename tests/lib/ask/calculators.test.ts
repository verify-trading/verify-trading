import { describe, expect, it } from "vitest";

import {
  calculateMarginRequirement,
  calculatePipValue,
  calculatePositionSize,
  calculatePositionSizeCard,
  calculateProfitLoss,
  calculateRiskAmount,
  calculateRiskReward,
  getPipSize,
} from "@/lib/ask/calculators";

describe("calculator formulas", () => {
  it("calculates risk amount from account size and risk percent", () => {
    expect(calculateRiskAmount(10_000, 1)).toBe(100);
    expect(calculateRiskAmount(5_000, 2)).toBe(100);
  });

  it("uses standard forex pip sizes", () => {
    expect(getPipSize("EUR/USD")).toBe(0.0001);
    expect(getPipSize("USD/JPY")).toBe(0.01);
  });

  it("calculates a standard GBP lot size card", () => {
    const card = calculatePositionSizeCard({
      accountSize: 10_000,
      riskPercent: 1,
      stopLossPips: 20,
      pipValuePerLot: 10,
      accountCurrency: "GBP",
    });

    expect(card.type).toBe("calc");
    expect(card.lots).toBe("0.50");
    expect(card.risk_amount).toBe("£100.00");
    expect(card.account).toBe("£10,000.00");
  });

  it("derives position size from a pair when pip value is not provided", () => {
    const result = calculatePositionSize({
      accountSize: 10_000,
      riskPercent: 1,
      stopLossPips: 20,
      pair: "EUR/USD",
      accountCurrency: "USD",
    });

    expect(result.pipValuePerLot).toBe(10);
    expect(result.lots).toBeCloseTo(0.5, 6);
  });

  it("calculates risk-reward from pips", () => {
    const result = calculateRiskReward({
      riskPips: 20,
      rewardPips: 50,
    });

    expect(result.riskDistance).toBe(20);
    expect(result.rewardDistance).toBe(50);
    expect(result.ratio).toBe(2.5);
  });

  it("calculates risk-reward from entry, stop, and target prices", () => {
    const result = calculateRiskReward({
      direction: "long",
      entryPrice: 1.1,
      stopPrice: 1.095,
      targetPrice: 1.1125,
    });

    expect(result.riskDistance).toBeCloseTo(0.005, 4);
    expect(result.rewardDistance).toBeCloseTo(0.0125, 4);
    expect(result.ratio).toBeCloseTo(2.5, 4);
  });

  it("calculates pip value for a standard EUR/USD lot", () => {
    const result = calculatePipValue({
      pair: "EUR/USD",
      lotSize: 1,
      accountCurrency: "USD",
    });

    expect(result.pipValue).toBe(10);
    expect(result.currency).toBe("USD");
  });

  it("calculates pip value for USD/JPY in JPY", () => {
    const result = calculatePipValue({
      pair: "USD/JPY",
      lotSize: 1,
      accountCurrency: "JPY",
    });

    expect(result.pipValue).toBe(1000);
    expect(result.currency).toBe("JPY");
  });

  it("converts pip value into another account currency", () => {
    const result = calculatePipValue({
      pair: "EUR/USD",
      lotSize: 1,
      accountCurrency: "GBP",
      quoteToAccountRate: 0.79,
    });

    expect(result.pipValue).toBeCloseTo(7.9, 4);
    expect(result.currency).toBe("GBP");
  });

  it("calculates required margin from leverage", () => {
    const result = calculateMarginRequirement({
      pair: "EUR/USD",
      lotSize: 1,
      price: 1.08,
      leverage: 30,
      accountCurrency: "USD",
    });

    expect(result.marginRate).toBeCloseTo(1 / 30, 6);
    expect(result.marginRequired).toBeCloseTo(3600, 0);
    expect(result.currency).toBe("USD");
  });

  it("calculates profit for a long forex trade", () => {
    const result = calculateProfitLoss({
      pair: "EUR/USD",
      direction: "long",
      entryPrice: 1.1,
      exitPrice: 1.105,
      lotSize: 1,
      accountCurrency: "USD",
    });

    expect(result.profitLoss).toBeCloseTo(500, 2);
    expect(result.pipsMoved).toBe(50);
  });

  it("calculates profit for a short forex trade", () => {
    const result = calculateProfitLoss({
      pair: "EUR/USD",
      direction: "short",
      entryPrice: 1.105,
      exitPrice: 1.1,
      lotSize: 1,
      accountCurrency: "USD",
    });

    expect(result.profitLoss).toBeCloseTo(500, 2);
    expect(result.pipsMoved).toBe(50);
  });
});
