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
    expect(parsed.verdict).toBe(
      "Using default 3% monthly return, plus default drawdowns of 8% every 3 months. Change the drawdown profile for a tighter forecast.",
    );
  });

  it("separates user return from default drawdown assumptions", () => {
    const card = generateProjectionCard({
      months: 24,
      startBalance: 100_000,
      monthlyReturnPercent: 3,
    });

    expect(card.lossEvents).toBe(8);
    expect(card.projectedBalance).toBe(104_326.83);
    expect(card.verdict).toBe(
      "Using your 3% monthly return, plus default drawdowns of 8% every 3 months. Change the drawdown profile for a tighter forecast.",
    );
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
    expect(card.verdict).toBe("Using your 5% monthly return with your 10% drawdowns every 4 months.");
  });

  it("honors an explicit no-drawdown assumption", () => {
    const card = generateProjectionCard({
      months: 24,
      startBalance: 100_000,
      monthlyReturnPercent: 3,
      drawdownEveryMonths: 0,
      drawdownPercent: 0,
    });

    expect(card.lossEvents).toBe(0);
    expect(card.projectedBalance).toBe(203_279.41);
    expect(card.verdict).toBe(
      "Using your 3% monthly return with your no drawdown assumption. Treat that as optimistic, not guaranteed.",
    );
  });

  it("includes currencySymbol on the card when the input provides one", () => {
    const card = generateProjectionCard({
      months: 6,
      startBalance: 500,
      monthlyAdd: 100,
      currencySymbol: "$",
    });

    expect(card.currencySymbol).toBe("$");
    expect(card.startBalance).toBe(500);
  });

  it("omits currencySymbol when the input does not provide one", () => {
    const card = generateProjectionCard({
      months: 6,
      startBalance: 500,
    });

    expect(card.currencySymbol).toBeUndefined();
  });
});
