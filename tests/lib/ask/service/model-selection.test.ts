import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/observability/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import { fallbackInsightCard } from "@/lib/ask/contracts";
import { generateAskResponse, streamAskResponse } from "@/lib/ask/service";
import {
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_ANTHROPIC_SIMPLE_MODEL,
} from "@/lib/ask/service/provider";
import { logger } from "@/lib/observability/logger";

function createFallbackTextResult() {
  return {
    text: JSON.stringify(fallbackInsightCard),
    toolResults: [],
  };
}

function getCallModelId(mock: ReturnType<typeof vi.fn>, callIndex = 0): string | undefined {
  const model = vi.mocked(mock).mock.calls[callIndex]?.[0]?.model as
    | { modelId?: string }
    | undefined;

  return model?.modelId;
}

function getCallTools(mock: ReturnType<typeof vi.fn>, callIndex = 0): string[] {
  const tools = vi.mocked(mock).mock.calls[callIndex]?.[0]?.tools;
  return Object.keys(tools ?? {}).sort();
}

describe("Ask service model selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    {
      name: "pure broker checks",
      message: "is completely unknown broker regulated?",
      modelId: DEFAULT_ANTHROPIC_SIMPLE_MODEL,
      tools: ["submit_ask_card", "verify_entity"],
      exactTools: true,
    },
    {
      name: "straightforward education questions",
      message: "what is spread in forex?",
      modelId: DEFAULT_ANTHROPIC_SIMPLE_MODEL,
      tools: [],
      exactTools: true,
    },
    {
      name: "trade decisions",
      message: "Should I buy gold after this breakout?",
      modelId: DEFAULT_ANTHROPIC_MODEL,
      tools: ["get_market_setup", "search_news", "submit_ask_card"],
    },
    {
      name: "short market level/session prompts",
      message: "Gold: key levels before London open",
      modelId: DEFAULT_ANTHROPIC_MODEL,
      tools: ["get_market_briefing", "get_market_setup", "submit_ask_card"],
    },
  ])("routes $name", async ({ message, modelId, tools, exactTools }) => {
    const generateTextImpl = vi.fn().mockResolvedValue(createFallbackTextResult());

    await generateAskResponse(
      {
        message,
        sessionId: crypto.randomUUID(),
        history: [],
      },
      { generateTextImpl },
    );

    expect(getCallModelId(generateTextImpl)).toBe(modelId);
    expect(getCallTools(generateTextImpl)).toEqual(expect.arrayContaining(tools));
    if (exactTools) {
      expect(getCallTools(generateTextImpl)).toHaveLength(tools.length);
    }
  });

  it("keeps active setup follow-ups on the primary model", async () => {
    const generateTextImpl = vi.fn().mockResolvedValue(createFallbackTextResult());

    await generateAskResponse(
      {
        message: "Can you refine the risk on this?",
        sessionId: crypto.randomUUID(),
        sessionMemory: {
          activeAsset: "GOLD / XAUUSD",
          activeSide: "buy",
          lastCardType: "setup",
        },
        history: [],
      },
      { generateTextImpl },
    );

    expect(getCallModelId(generateTextImpl)).toBe(DEFAULT_ANTHROPIC_MODEL);
  });

  it("reroutes simple-model trade cards through the primary model", async () => {
    const simpleSetupCard = {
      type: "setup" as const,
      asset: "GOLD / XAUUSD",
      bias: "Bullish" as const,
      entry: "4649.77",
      stop: "4640.00",
      target: "4669.31",
      rr: "2:1",
      rationale: "Wait for reclaim.",
      confidence: "Low" as const,
      verdict: "Buy only after confirmation.",
    };
    const primaryInsightCard = {
      type: "insight" as const,
      headline: "Spread",
      body: "The spread is the gap between bid and ask. It is the trading cost you pay before the trade moves in your favor.",
      verdict: "Use tighter spreads for short term trades.",
    };
    const generateTextImpl = vi
      .fn()
      .mockResolvedValueOnce({
        text: JSON.stringify(simpleSetupCard),
        toolResults: [],
      })
      .mockResolvedValueOnce({
        text: JSON.stringify(primaryInsightCard),
        toolResults: [],
      });

    const response = await generateAskResponse(
      {
        message: "what is spread in forex?",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      { generateTextImpl },
    );

    expect(generateTextImpl).toHaveBeenCalledTimes(2);
    expect(getCallModelId(generateTextImpl, 0)).toBe(DEFAULT_ANTHROPIC_SIMPLE_MODEL);
    expect(getCallModelId(generateTextImpl, 1)).toBe(DEFAULT_ANTHROPIC_MODEL);
    expect(getCallTools(generateTextImpl, 0)).toEqual([]);
    expect(getCallTools(generateTextImpl, 1)).toEqual(
      expect.arrayContaining(["get_market_setup", "search_news", "submit_ask_card"]),
    );
    expect(response.data).toEqual(primaryInsightCard);
    expect(logger.warn).toHaveBeenCalledWith(
      "Ask simple model result escalated to primary model.",
      expect.objectContaining({
        escalationReason: "trade_action_card",
        cardType: "setup",
      }),
    );
  });

  it("retries simple-model failures on the primary model", async () => {
    const primaryInsightCard = {
      type: "insight" as const,
      headline: "Spread",
      body: "The spread is the gap between bid and ask. It is the first cost a trade must overcome.",
      verdict: "Account for spread before entering.",
    };
    const generateTextImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error("overloaded"))
      .mockResolvedValueOnce({
        text: JSON.stringify(primaryInsightCard),
        toolResults: [],
      });

    const response = await generateAskResponse(
      {
        message: "what is spread in forex?",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      { generateTextImpl },
    );

    expect(generateTextImpl).toHaveBeenCalledTimes(2);
    expect(getCallModelId(generateTextImpl, 0)).toBe(DEFAULT_ANTHROPIC_SIMPLE_MODEL);
    expect(getCallModelId(generateTextImpl, 1)).toBe(DEFAULT_ANTHROPIC_MODEL);
    expect(response.data).toEqual(primaryInsightCard);
  });

  it("routes streaming asks through the same simple model path", async () => {
    const streamTextImpl = vi.fn().mockReturnValue({ stream: "mock" });

    await streamAskResponse(
      {
        message: "what is leverage?",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      {},
      { streamTextImpl },
    );

    expect(getCallModelId(streamTextImpl)).toBe(DEFAULT_ANTHROPIC_SIMPLE_MODEL);
  });
});
