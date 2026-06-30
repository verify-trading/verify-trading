import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/observability/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import { generateAskResponse, mergeToolOwnedNumbers } from "@/lib/ask/pipeline";
import { fallbackInsightCard, imageFallbackInsightCard } from "@/lib/ask/contracts";
import { DEFAULT_ANTHROPIC_MODEL } from "@/lib/ask/service/provider";

const insightCard = {
  type: "insight" as const,
  headline: "Pepperstone Checks Out",
  body: "Pepperstone is FCA registered with a strong record.",
  verdict: "Safe to use for UK retail trading.",
};

const setupCard = {
  type: "setup" as const,
  asset: "GOLD / XAUUSD",
  bias: "Bullish" as const,
  entry: "4650.00",
  stop: "4638.00",
  target: "4674.00",
  rr: "2:1",
  rationale: "Buy the reclaim only.",
  confidence: "Low" as const,
  verdict: "Wait for the reclaim before buying.",
};

const briefingToolCard = {
  type: "briefing" as const,
  asset: "BTC / USD",
  price: "66194.00",
  change: "-0.8%",
  direction: "down" as const,
  level1: "68500",
  level2: "64200",
  event: null,
  verdict: "Tool verdict.",
};

const chartCard = {
  type: "chart" as const,
  pattern: "Descending channel",
  bias: "Bearish" as const,
  entry: "4045.00",
  stop: "4060.00",
  target: "4000.00",
  rr: "3:1",
  confidence: "Medium" as const,
  verdict: "Short the rejection of channel resistance; do not chase weakness.",
};

/** Smallest valid 1x1 PNG, enough to pass the image decode/MIME gate. */
const TINY_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

function submitResult(card: unknown) {
  return { toolName: "submit_ask_card", output: { card } };
}

function textOnlyResult(text: string) {
  return { text, toolResults: [] };
}

function imageRequest(message: string) {
  return {
    message,
    image: TINY_PNG_DATA_URL,
    sessionId: crypto.randomUUID(),
    history: [],
  };
}

function textResult(toolResults: unknown[]) {
  return { text: "", toolResults };
}

function getCallModelId(mock: ReturnType<typeof vi.fn>, callIndex = 0): string | undefined {
  const model = vi.mocked(mock).mock.calls[callIndex]?.[0]?.model as
    | { modelId?: string }
    | undefined;
  return model?.modelId;
}

function getCallTools(mock: ReturnType<typeof vi.fn>, callIndex = 0): string[] {
  return Object.keys(vi.mocked(mock).mock.calls[callIndex]?.[0]?.tools ?? {});
}

function getCallMessages(mock: ReturnType<typeof vi.fn>, callIndex = 0) {
  return (vi.mocked(mock).mock.calls[callIndex]?.[0]?.messages ?? []) as Array<{
    role: string;
    content: unknown;
  }>;
}

const emptyKnowledge = { entityCandidates: [], chunks: [] };

function baseRequest(message: string) {
  return {
    message,
    sessionId: crypto.randomUUID(),
    history: [],
  };
}

describe("generateAskResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("answers queries with a single Sonnet model call", async () => {
    const generateTextImpl = vi
      .fn()
      .mockResolvedValue(textResult([submitResult(insightCard)])) as never;

    const response = await generateAskResponse(baseRequest("Is Pepperstone legit?"), {
      generateTextImpl,
      retrieveAskKnowledgeImpl: vi.fn().mockResolvedValue(emptyKnowledge),
    });

    expect(generateTextImpl).toHaveBeenCalledTimes(1);
    expect(getCallModelId(generateTextImpl)).toBe(DEFAULT_ANTHROPIC_MODEL);
    expect(getCallTools(generateTextImpl)).not.toContain("escalate");
    expect(response.data).toEqual(insightCard);
  });

  it("handles setup cards in a single Sonnet pass", async () => {
    const generateTextImpl = vi
      .fn()
      .mockResolvedValue(textResult([submitResult(setupCard)])) as never;

    const response = await generateAskResponse(
      baseRequest("Best trade right now across gold and BTC?"),
      {
        generateTextImpl,
        retrieveAskKnowledgeImpl: vi.fn().mockResolvedValue(emptyKnowledge),
      },
    );

    expect(generateTextImpl).toHaveBeenCalledTimes(1);
    expect(getCallModelId(generateTextImpl)).toBe(DEFAULT_ANTHROPIC_MODEL);
    expect(response.data).toEqual(setupCard);
  });

  it("returns setup card with tool-owned numbers merged", async () => {
    const marketSetupResult = {
      toolName: "get_market_setup",
      output: { card: setupCard },
    };
    const generateTextImpl = vi
      .fn()
      .mockResolvedValue(
        textResult([marketSetupResult, submitResult({ ...setupCard, verdict: "Sonnet verdict." })]),
      ) as never;

    const response = await generateAskResponse(baseRequest("Set up a gold long"), {
      generateTextImpl,
      retrieveAskKnowledgeImpl: vi.fn().mockResolvedValue(emptyKnowledge),
    });

    expect(generateTextImpl).toHaveBeenCalledTimes(1);
    expect(getCallModelId(generateTextImpl)).toBe(DEFAULT_ANTHROPIC_MODEL);
    expect(response.data).toMatchObject({ type: "setup", verdict: "Sonnet verdict." });
  });

  it("injects retrieved knowledge as an uncached system message", async () => {
    const generateTextImpl = vi
      .fn()
      .mockResolvedValue(textResult([submitResult(insightCard)])) as never;
    const retrieveAskKnowledgeImpl = vi.fn().mockResolvedValue({
      entityCandidates: [
        {
          id: "1",
          title: "FTMO",
          tags: { entity_type: "propfirm", status: "legitimate" },
          sourceId: "ftmo",
          matchType: "exact",
          similarity: 1,
        },
      ],
      chunks: [],
    });

    await generateAskResponse(baseRequest("Is FTMO worth it?"), {
      generateTextImpl,
      retrieveAskKnowledgeImpl,
    });

    expect(retrieveAskKnowledgeImpl).toHaveBeenCalledWith("Is FTMO worth it?");
    const messages = getCallMessages(generateTextImpl);
    const knowledgeMessage = messages.find(
      (message) =>
        message.role === "system" &&
        typeof message.content === "string" &&
        message.content.startsWith("RETRIEVED CONTEXT"),
    );
    expect(knowledgeMessage).toBeDefined();
    expect(String(knowledgeMessage?.content)).toContain("FTMO");
    expect(knowledgeMessage).not.toHaveProperty("providerOptions");
  });

  it("keeps tool-owned numbers when the model rewrites a briefing", async () => {
    const generateTextImpl = vi
      .fn()
      .mockResolvedValue(
        textResult([
          { toolName: "get_market_briefing", output: { card: briefingToolCard } },
          submitResult({
            ...briefingToolCard,
            price: "65000.00",
            level1: "70000",
            verdict: "Model verdict in trader words.",
          }),
        ]),
      ) as never;

    const response = await generateAskResponse(
      baseRequest("What is Bitcoin doing today and should I care?"),
      {
        generateTextImpl,
        retrieveAskKnowledgeImpl: vi.fn().mockResolvedValue(emptyKnowledge),
      },
    );

    expect(response.data).toMatchObject({
      type: "briefing",
      price: "66194.00",
      level1: "68500",
      verdict: "Model verdict in trader words.",
    });
  });

  it("throws when the single Sonnet call fails", async () => {
    const generateTextImpl = vi
      .fn()
      .mockRejectedValue(new Error("overloaded")) as never;

    await expect(
      generateAskResponse(baseRequest("tricky question"), {
        generateTextImpl,
        retrieveAskKnowledgeImpl: vi.fn().mockResolvedValue(emptyKnowledge),
      }),
    ).rejects.toThrow("overloaded");
  });

  it("salvages a chart card the model returned as text instead of submit_ask_card", async () => {
    const generateTextImpl = vi
      .fn()
      .mockResolvedValue(textOnlyResult(JSON.stringify(chartCard))) as never;

    const response = await generateAskResponse(imageRequest("analyse this chart"), {
      generateTextImpl,
      retrieveAskKnowledgeImpl: vi.fn().mockResolvedValue(emptyKnowledge),
      getActiveAnalysisRulesImpl: vi.fn().mockResolvedValue([]),
    });

    // Images skip the Haiku tier and go straight to Sonnet.
    expect(generateTextImpl).toHaveBeenCalledTimes(1);
    expect(getCallModelId(generateTextImpl)).toBe(DEFAULT_ANTHROPIC_MODEL);
    expect(response.data).toMatchObject({
      type: "chart",
      pattern: "Descending channel",
      bias: "Bearish",
    });
  });

  it("returns the image-specific fallback when an image yields no card", async () => {
    const generateTextImpl = vi.fn().mockResolvedValue(textOnlyResult("")) as never;

    const response = await generateAskResponse(imageRequest("analyse this chart"), {
      generateTextImpl,
      retrieveAskKnowledgeImpl: vi.fn().mockResolvedValue(emptyKnowledge),
      getActiveAnalysisRulesImpl: vi.fn().mockResolvedValue([]),
    });

    expect(response.data).toEqual(imageFallbackInsightCard);
  });

  it("wraps a prose answer into an insight instead of the generic fallback", async () => {
    const prose =
      "Gold is heavy here and momentum is against longs. Wait for a clean reclaim before buying.";
    const generateTextImpl = vi.fn().mockResolvedValue(textOnlyResult(prose)) as never;

    const response = await generateAskResponse(baseRequest("should I buy gold now?"), {
      generateTextImpl,
      retrieveAskKnowledgeImpl: vi.fn().mockResolvedValue(emptyKnowledge),
    });

    expect(response.data.type).toBe("insight");
    expect(response.data).not.toEqual(fallbackInsightCard);
    expect(String((response.data as { body?: string }).body)).toContain("Gold is heavy");
  });

  it("limits the static cached prefix to one system breakpoint", async () => {
    const generateTextImpl = vi
      .fn()
      .mockResolvedValue(textResult([submitResult(insightCard)])) as never;

    await generateAskResponse(
      {
        ...baseRequest("quick question"),
        sessionMemory: {
          activeAsset: "GOLD / XAUUSD",
          lastCardType: "setup" as const,
        },
      },
      {
        generateTextImpl,
        retrieveAskKnowledgeImpl: vi.fn().mockResolvedValue(emptyKnowledge),
      },
    );

    const messages = getCallMessages(generateTextImpl) as Array<{
      role: string;
      providerOptions?: unknown;
    }>;
    const cachedSystemMessages = messages.filter(
      (message) => message.role === "system" && message.providerOptions,
    );
    expect(cachedSystemMessages).toHaveLength(1);
  });
});

describe("mergeToolOwnedNumbers", () => {
  it("returns the model card untouched when no matching tool card exists", () => {
    expect(mergeToolOwnedNumbers(insightCard, [])).toEqual(insightCard);
  });

  it("copies setup levels from the tool card", () => {
    const modelCard = { ...setupCard, entry: "9999", verdict: "Model words." };
    const merged = mergeToolOwnedNumbers(modelCard, [
      { toolName: "get_market_setup", output: { card: setupCard } },
    ]);

    expect(merged).toMatchObject({ entry: "4650.00", verdict: "Model words." });
  });
});
