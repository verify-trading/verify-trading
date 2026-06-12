import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/observability/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import { generateAskCascadeResponse, mergeToolOwnedNumbers } from "@/lib/ask/cascade";
import {
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_ANTHROPIC_SIMPLE_MODEL,
} from "@/lib/ask/service/provider";

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

function submitResult(card: unknown) {
  return { toolName: "submit_ask_card", output: { card } };
}

function escalateResult(reason = "needs live setup judgment") {
  return { toolName: "escalate", output: { escalated: true, reason } };
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

describe("generateAskCascadeResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("answers easy queries on the Haiku tier with a single model call", async () => {
    const generateTextImpl = vi
      .fn()
      .mockResolvedValue(textResult([submitResult(insightCard)])) as never;

    const response = await generateAskCascadeResponse(baseRequest("Is Pepperstone legit?"), {
      generateTextImpl,
      retrieveAskKnowledgeImpl: vi.fn().mockResolvedValue(emptyKnowledge),
    });

    expect(generateTextImpl).toHaveBeenCalledTimes(1);
    expect(getCallModelId(generateTextImpl)).toBe(DEFAULT_ANTHROPIC_SIMPLE_MODEL);
    expect(getCallTools(generateTextImpl)).toContain("escalate");
    expect(response.data).toEqual(insightCard);
  });

  it("runs Sonnet when the Haiku tier escalates, without the escalate tool", async () => {
    const generateTextImpl = vi
      .fn()
      .mockResolvedValueOnce(textResult([escalateResult()]))
      .mockResolvedValueOnce(textResult([submitResult(setupCard)])) as never;

    const response = await generateAskCascadeResponse(
      baseRequest("Best trade right now across gold and BTC?"),
      {
        generateTextImpl,
        retrieveAskKnowledgeImpl: vi.fn().mockResolvedValue(emptyKnowledge),
      },
    );

    expect(generateTextImpl).toHaveBeenCalledTimes(2);
    expect(getCallModelId(generateTextImpl, 0)).toBe(DEFAULT_ANTHROPIC_SIMPLE_MODEL);
    expect(getCallModelId(generateTextImpl, 1)).toBe(DEFAULT_ANTHROPIC_MODEL);
    expect(getCallTools(generateTextImpl, 1)).not.toContain("escalate");
    expect(response.data).toEqual(setupCard);
  });

  it("guards trade-action cards: Haiku setups rerun on Sonnet with forwarded evidence", async () => {
    const marketSetupResult = {
      toolName: "get_market_setup",
      output: { card: setupCard },
    };
    const generateTextImpl = vi
      .fn()
      .mockResolvedValueOnce(textResult([marketSetupResult, submitResult(setupCard)]))
      .mockResolvedValueOnce(
        textResult([submitResult({ ...setupCard, verdict: "Sonnet verdict." })]),
      ) as never;

    const response = await generateAskCascadeResponse(baseRequest("Set up a gold long"), {
      generateTextImpl,
      retrieveAskKnowledgeImpl: vi.fn().mockResolvedValue(emptyKnowledge),
    });

    expect(generateTextImpl).toHaveBeenCalledTimes(2);
    expect(getCallModelId(generateTextImpl, 1)).toBe(DEFAULT_ANTHROPIC_MODEL);

    const tier2Messages = getCallMessages(generateTextImpl, 1);
    const evidence = tier2Messages.find(
      (message) =>
        message.role === "system" &&
        typeof message.content === "string" &&
        message.content.includes("TOOL EVIDENCE FROM A PRIOR PASS"),
    );
    expect(evidence).toBeDefined();
    expect(String(evidence?.content)).toContain("get_market_setup");

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

    await generateAskCascadeResponse(baseRequest("Is FTMO worth it?"), {
      generateTextImpl,
      retrieveAskKnowledgeImpl,
    });

    expect(retrieveAskKnowledgeImpl).toHaveBeenCalledWith("Is FTMO worth it?");
    const messages = getCallMessages(generateTextImpl);
    const knowledgeMessage = messages.find(
      (message) =>
        message.role === "system" &&
        typeof message.content === "string" &&
        message.content.includes("RETRIEVED CONTEXT"),
    );
    expect(knowledgeMessage).toBeDefined();
    expect(String(knowledgeMessage?.content)).toContain("FTMO");
    expect(knowledgeMessage).not.toHaveProperty("providerOptions");
  });

  it("keeps tool-owned numbers when the model rewrites a briefing", async () => {
    const generateTextImpl = vi
      .fn()
      .mockResolvedValueOnce(textResult([escalateResult()]))
      .mockResolvedValueOnce(
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

    const response = await generateAskCascadeResponse(
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

  it("falls back to the Haiku card when the Sonnet tier fails", async () => {
    const generateTextImpl = vi
      .fn()
      .mockResolvedValueOnce(textResult([escalateResult(), submitResult(insightCard)]))
      .mockRejectedValueOnce(new Error("overloaded")) as never;

    const response = await generateAskCascadeResponse(baseRequest("tricky question"), {
      generateTextImpl,
      retrieveAskKnowledgeImpl: vi.fn().mockResolvedValue(emptyKnowledge),
    });

    expect(response.data).toEqual(insightCard);
  });

  it("limits the static cached prefix to two system breakpoints", async () => {
    const generateTextImpl = vi
      .fn()
      .mockResolvedValue(textResult([submitResult(insightCard)])) as never;

    await generateAskCascadeResponse(
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
    expect(cachedSystemMessages).toHaveLength(2);
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
