import { describe, expect, it } from "vitest";

import { breakEvenWinRate, marginRequired, needsPrice, needsQuoteRate, pipValuePerLot, riskReward, sizePosition } from "@/lib/marketing/tools";

describe("pipValuePerLot", () => {
  it("is 10 USD per standard lot for a USD-quoted pair on a USD account", () => {
    expect(pipValuePerLot({ pair: "EUR/USD", account: "USD" })?.pipValue).toBe(10);
  });
  it("converts a USD-base pair using its price (USD/JPY at 150 = 1000 JPY / 150)", () => {
    expect(pipValuePerLot({ pair: "USD/JPY", account: "USD", price: 150 })?.pipValue).toBeCloseTo(6.6667, 3);
  });
  it("needs a price for a USD-base pair and a rate for an unrelated account currency", () => {
    expect(pipValuePerLot({ pair: "USD/JPY", account: "USD" })).toBeNull();
    expect(needsPrice("USD/JPY", "USD")).toBe(true);
    expect(needsQuoteRate("EUR/USD", "GBP")).toBe(true);
    expect(pipValuePerLot({ pair: "EUR/USD", account: "GBP" })).toBeNull();
  });
  it("uses the supplied quote-to-account rate", () => {
    expect(pipValuePerLot({ pair: "EUR/USD", account: "GBP", quoteToAccountRate: 0.8 })?.pipValue).toBe(8);
  });
  it("scales with lot size", () => {
    expect(pipValuePerLot({ pair: "EUR/USD", account: "USD", lots: 0.1 })?.pipValue).toBe(1);
  });
});

describe("sizePosition", () => {
  it("10,000 at 1% with a 20 pip stop and 10 per pip is 0.50 lots", () => {
    const r = sizePosition({ accountSize: 10_000, riskPercent: 1, stopPips: 20, pipValuePerLot: 10 })!;
    expect(r.lots).toBeCloseTo(0.5);
    expect(r.riskAmount).toBe(100);
    expect(r.units).toBeCloseTo(50_000);
  });
  it("halves when the stop doubles", () => {
    expect(sizePosition({ accountSize: 10_000, riskPercent: 1, stopPips: 50, pipValuePerLot: 10 })!.lots).toBeCloseTo(0.2);
  });
  it("rejects non-positive inputs", () => {
    expect(sizePosition({ accountSize: 0, riskPercent: 1, stopPips: 20, pipValuePerLot: 10 })).toBeNull();
    expect(sizePosition({ accountSize: 100, riskPercent: 1, stopPips: 0, pipValuePerLot: 10 })).toBeNull();
  });
});

describe("riskReward", () => {
  it("long 1.0850 / 1.0820 / 1.0940 is 1:3 with 30 and 90 pips", () => {
    const r = riskReward({ pair: "EUR/USD", direction: "long", entry: 1.085, stop: 1.082, target: 1.094 });
    if (!r.ok) throw new Error(r.message);
    expect(r.ratio).toBeCloseTo(3);
    expect(r.riskPips).toBeCloseTo(30);
    expect(r.rewardPips).toBeCloseTo(90);
    expect(r.breakEven).toBeCloseTo(0.25);
  });
  it("uses 0.01 pips for yen pairs", () => {
    const r = riskReward({ pair: "USD/JPY", direction: "short", entry: 150, stop: 150.5, target: 149 });
    if (!r.ok) throw new Error(r.message);
    expect(r.riskPips).toBeCloseTo(50);
    expect(r.ratio).toBeCloseTo(2);
  });
  it("rejects a stop on the wrong side", () => {
    expect(riskReward({ pair: "EUR/USD", direction: "long", entry: 1.085, stop: 1.09, target: 1.095 }).ok).toBe(false);
    expect(riskReward({ pair: "EUR/USD", direction: "short", entry: 1.085, stop: 1.08, target: 1.07 }).ok).toBe(false);
  });
});

describe("breakEvenWinRate", () => {
  it("is 50% at 1:1, 1/3 at 1:2, 25% at 1:3", () => {
    expect(breakEvenWinRate(1)).toBe(0.5);
    expect(breakEvenWinRate(2)).toBeCloseTo(1 / 3);
    expect(breakEvenWinRate(3)).toBe(0.25);
    expect(breakEvenWinRate(0)).toBeNull();
  });
});

describe("marginRequired", () => {
  it("1 lot EUR/USD at 1.0850 with 30:1 on a USD account is 3,616.67", () => {
    expect(marginRequired({ pair: "EUR/USD", lots: 1, price: 1.085, leverage: 30, account: "USD" })?.margin).toBeCloseTo(3616.67, 1);
  });
  it("on a EUR account the base is the account currency so margin is 100000/30", () => {
    expect(marginRequired({ pair: "EUR/USD", lots: 1, price: 1.085, leverage: 30, account: "EUR" })?.margin).toBeCloseTo(3333.33, 1);
  });
  it("needs a rate for an unrelated account currency", () => {
    expect(marginRequired({ pair: "EUR/USD", lots: 1, price: 1.085, leverage: 30, account: "GBP" })).toBeNull();
    expect(marginRequired({ pair: "EUR/USD", lots: 1, price: 1.085, leverage: 30, account: "GBP", baseToAccountRate: 0.86 })?.margin).toBeCloseTo(2866.67, 1);
  });
});
