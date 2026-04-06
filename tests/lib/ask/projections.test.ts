import { describe, expect, it } from "vitest";

import { generateProjectionCard, generateProjectionInputSchema } from "@/lib/ask/projections";

describe("generateProjectionCard", () => {
  it("uses the new base-case assumptions when return inputs are omitted", () => {
    const parsed = generateProjectionCard(generateProjectionInputSchema.parse({
      months: 18,
      startBalance: 10_000,
      monthlyAdd: 500,
    }));

    expect(parsed.lossEvents).toBe(6);
    expect(parsed.verdict).toContain("Base case uses");
    expect(parsed.verdict).toContain("3% monthly returns");
    expect(parsed.verdict).toContain("8% drawdowns every 3 months");
    expect(parsed.verdict).toContain("real return and drawdown profile");
  });

  it("generates a deterministic equity curve", () => {
    const card = generateProjectionCard({
      months: 6,
      startBalance: 10_000,
      monthlyAdd: 500,
      monthlyReturnPercent: 4,
      drawdownEveryMonths: 0,
      drawdownPercent: 0,
    });

    expect(card.type).toBe("projection");
    expect(card.dataPoints).toHaveLength(6);
    expect(card.lossEvents).toBe(0);
    expect(card.projectedBalance).toBeGreaterThan(10_000);
  });

  it("applies scheduled drawdowns", () => {
    const card = generateProjectionCard({
      months: 12,
      startBalance: 10_000,
      monthlyAdd: 0,
      monthlyReturnPercent: 5,
      drawdownEveryMonths: 4,
      drawdownPercent: 10,
    });

    expect(card.lossEvents).toBe(3);
    expect(card.dataPoints).toHaveLength(12);
  });

  it("describes explicit user assumptions without calling them a base case", () => {
    const card = generateProjectionCard({
      months: 8,
      startBalance: 10_000,
      monthlyAdd: 500,
      monthlyReturnPercent: 5,
      drawdownEveryMonths: 4,
      drawdownPercent: 10,
    });

    expect(card.lossEvents).toBe(2);
    expect(card.verdict).toBe("Using 5% monthly returns with 10% drawdowns every 4 months.");
  });
});
