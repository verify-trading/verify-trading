import { describe, expect, it } from "vitest";

import {
  askCardSchema,
  askRequestSchema,
  fallbackInsightCard,
  sanitizeCard,
  sanitizeUiMeta,
} from "@/lib/ask/contracts";

describe("ask contracts", () => {
  it("accepts a valid ask request with history and attachment metadata", () => {
    const parsed = askRequestSchema.parse({
      message: "Analyse this chart",
      sessionId: crypto.randomUUID(),
      image: "data:image/png;base64,Zm9v",
      attachmentMeta: {
        fileName: "gold.png",
        mimeType: "image/png",
        size: 1024,
      },
      history: [
        { role: "user", content: "What is Gold doing?" },
        { role: "assistant", content: JSON.stringify(fallbackInsightCard) },
      ],
    });

    expect(parsed.history).toHaveLength(2);
    expect(parsed.attachmentMeta?.fileName).toBe("gold.png");
  });

  it("preserves concise card text after validation", () => {
    const card = sanitizeCard({
      type: "insight",
      headline: "Clear Risk Check",
      body: "Wait for the setup to confirm before risking money.",
      verdict: "Protect the account first.",
    });

    expect(card.type).toBe("insight");
    if (card.type !== "insight") {
      throw new Error("Expected an insight card.");
    }

    expect(card.headline).toBe("Clear Risk Check");
    expect(card.body).toBe("Wait for the setup to confirm before risking money.");
    expect(card.verdict).toBe("Protect the account first.");
  });

  it("trims long natural language fields at sentence boundaries", () => {
    const card = sanitizeCard({
      type: "insight",
      headline: "This headline is far too long",
      body:
        "First sentence gives the answer. Second sentence gives the reason. Third sentence gives the action. Fourth sentence should not appear.",
      verdict: "First verdict sentence stays. Second verdict sentence stays. Third verdict sentence should not appear.",
    });

    expect(card.type).toBe("insight");
    if (card.type !== "insight") {
      throw new Error("Expected an insight card.");
    }

    expect(card.headline).toBe("This headline is far");
    expect(card.body).toBe(
      "First sentence gives the answer. Second sentence gives the reason. Third sentence gives the action.",
    );
    expect(card.verdict).toBe("First verdict sentence stays. Second verdict sentence stays.");
  });

  it("removes dash punctuation from natural language response fields", () => {
    const card = sanitizeCard({
      type: "briefing",
      asset: "GOLD",
      price: "4543.60",
      change: "-3.02%",
      direction: "down",
      level1: "4561.90",
      level2: "4540.00",
      event: "CPI-hot - dollar bid",
      verdict: "Gold is weak — wait for rate-cut noise to settle.",
    });

    expect(card.type).toBe("briefing");
    if (card.type !== "briefing") {
      throw new Error("Expected a briefing card.");
    }

    expect(card.change).toBe("-3.02%");
    expect(card.event).toBe("CPI hot, dollar bid");
    expect(card.verdict).toBe("Gold is weak, wait for rate cut noise to settle.");
  });

  it("preserves ui metadata text without truncation", () => {
    const uiMeta = sanitizeUiMeta({
      marketSeries: [1, 2, 3],
      projectionMarkers: [0, 2],
    });

    expect(uiMeta).toEqual({
      marketSeries: [1, 2, 3],
      projectionMarkers: [0, 2],
    });
  });

  it("normalizes chart bias from long or short wording", () => {
    const bullishCard = askCardSchema.parse({
      type: "chart",
      pattern: "V-recovery",
      bias: "Long",
      entry: "21,880",
      stop: "21,370",
      target: "21,950",
      rr: "1.4:1",
      confidence: "Medium",
      verdict: "Wait for confirmation.",
    });
    const bearishCard = askCardSchema.parse({
      type: "chart",
      pattern: "Breakdown",
      bias: "Short",
      entry: "21,880",
      stop: "21,950",
      target: "21,370",
      rr: "1.4:1",
      confidence: "Medium",
      verdict: "Wait for confirmation.",
    });

    expect(bullishCard.type).toBe("chart");
    expect(bullishCard.type === "chart" ? bullishCard.bias : null).toBe("Bullish");
    expect(bearishCard.type === "chart" ? bearishCard.bias : null).toBe("Bearish");
  });

  it("accepts a valid setup card", () => {
    const card = askCardSchema.parse({
      type: "setup",
      asset: "GOLD / XAUUSD",
      bias: "Bullish",
      entry: "4649.77",
      stop: "4645.10",
      target: "4659.11",
      rr: "2:1",
      rationale: "Wait for reclaim above resistance instead of buying straight into weakness.",
      confidence: "Low",
      verdict: "Buy only after confirmation.",
    });

    expect(card.type).toBe("setup");
    expect(card.type === "setup" ? card.bias : null).toBe("Bullish");
  });

  it("accepts a valid growth plan card", () => {
    const card = askCardSchema.parse({
      type: "plan",
      startBalance: 500,
      monthlyAdd: 100,
      currencySymbol: "$",
      dailyTarget: "$1.25-$2.50",
      weeklyTarget: "$5-$10",
      monthlyTarget: "$20-$40",
      maxDailyLoss: "$5",
      projectionMonths: 12,
      projectedBalance: 1800.25,
      projectionReturn: "35.0%",
      rationale: "Keep the targets realistic and scale only after consistency.",
      verdict: "Protect downside first.",
    });

    expect(card.type).toBe("plan");
    expect(card.type === "plan" ? card.currencySymbol : null).toBe("$");
  });

  it("accepts a projection card with an explicit currency symbol", () => {
    const card = askCardSchema.parse({
      type: "projection",
      months: 12,
      startBalance: 500,
      monthlyAdd: 100,
      currencySymbol: "$",
      projectedBalance: 1400,
      dataPoints: [525, 651, 781],
      totalReturn: "40.0%",
      lossEvents: 2,
      verdict: "Base case uses conservative assumptions.",
    });

    expect(card.type).toBe("projection");
    expect(card.type === "projection" ? card.currencySymbol : null).toBe("$");
  });

  it("accepts an image-only ask request", () => {
    const parsed = askRequestSchema.parse({
      message: "",
      image: "data:image/png;base64,Zm9v",
    });

    expect(parsed.message).toBe("");
    expect(parsed.image).toBe("data:image/png;base64,Zm9v");
  });
});
