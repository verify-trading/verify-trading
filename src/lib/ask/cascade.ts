import { generateText, stepCountIs, tool, type ModelMessage } from "ai";
import { z } from "zod";

import {
  buildAnalysisRulesPrompt,
  getActiveAnalysisRules,
} from "@/lib/ask/analysis-rules";
import {
  askCardSchema,
  askRequestSchema,
  askResponseSchema,
  fallbackInsightCard,
  sanitizeCard,
  sanitizeUiMeta,
  type AskCard,
  type AskRequest,
  type AskResponse,
} from "@/lib/ask/contracts";
import {
  buildKnowledgeContextBlock,
  retrieveAskKnowledge,
} from "@/lib/ask/knowledge/retrieve";
import { logger } from "@/lib/observability/logger";
import { cascadeAskSystemPrompt } from "@/lib/ask/cascade-prompt";
import { askImageResponseGuide, defaultAskImagePrompt } from "@/lib/ask/prompt";
import {
  extractSubmitAskCard,
  extractToolCard,
  extractUiMeta,
  parseImageDataUrl,
} from "@/lib/ask/service/context";
import {
  createSystemMessage,
  getAskModel,
  getAskPrimaryModelId,
  getAskSimpleModel,
  getAskSimpleModelId,
} from "@/lib/ask/service/provider";
import { createAskTools } from "@/lib/ask/service/tools";
import type { AskServiceDependencies } from "@/lib/ask/service/types";
import {
  buildSessionMemoryMessage,
  deriveAskSessionMemory,
} from "@/lib/ask/session-memory";
import { expandPromptTemplate } from "@/lib/site-config";
import type { AskGenerationCallbacks } from "@/lib/ask/service";

const CASCADE_MAX_OUTPUT_TOKENS = 1500;
const CASCADE_MODEL_MAX_RETRIES = 2;
const TIER1_MAX_STEPS = 5;
const TIER2_MAX_STEPS = 7;

/** Recent turns kept verbatim; older context is carried by session memory. */
const MAX_HISTORY_TURNS = 12;

/** Tool evidence forwarded from tier 1 to tier 2 is truncated per result. */
const MAX_FORWARDED_EVIDENCE_CHARS = 1200;

type ToolResultRecord = { toolName?: string; output?: unknown };

type CascadeDependencies = AskServiceDependencies & {
  retrieveAskKnowledgeImpl?: typeof retrieveAskKnowledge;
};

const escalateInputSchema = z.object({
  reason: z
    .string()
    .min(1)
    .describe("One short sentence on why this needs the deeper model."),
});

function createEscalateTool() {
  return tool({
    description:
      "Hand this question to the deeper analysis model instead of answering yourself. " +
      "Call it when the question needs a live trade setup, chart or market-structure judgment, " +
      "comparing multiple markets to pick a trade, or a nuanced risk decision with conflicting factors. " +
      "Do NOT call it for broker/prop-firm/guru verification, calculators, projections, growth plans, " +
      "price checks, scheduled economic events, education, psychology basics, or acknowledgements: " +
      "answer those yourself with the other tools.",
    inputSchema: escalateInputSchema,
    execute: async ({ reason }) => ({ escalated: true, reason }),
  });
}

function hasToolResultNamed(toolResults: ToolResultRecord[], toolName: string) {
  return toolResults.some((toolResult) => toolResult.toolName === toolName);
}

function stopAfterFinalToolResult({
  steps,
}: {
  steps: Array<{ toolResults?: Array<{ toolName?: string }> }>;
}) {
  const lastStep = steps[steps.length - 1];
  return (
    lastStep?.toolResults?.some(
      (toolResult) =>
        toolResult.toolName === "submit_ask_card" || toolResult.toolName === "escalate",
    ) ?? false
  );
}

function plainSystemMessage(content: string): ModelMessage {
  return { role: "system", content };
}

function buildCascadeMessages({
  request,
  normalizedMessage,
  image,
  analysisRulesMessage,
  knowledgeContextBlock,
}: {
  request: AskRequest;
  normalizedMessage: string;
  image: ReturnType<typeof parseImageDataUrl>;
  analysisRulesMessage: string | null;
  knowledgeContextBlock: string | null;
}): ModelMessage[] {
  const sessionMemoryMessage = buildSessionMemoryMessage(
    deriveAskSessionMemory(request.history, request.sessionMemory ?? null),
  );

  const userMessage: ModelMessage = image
    ? {
        role: "user",
        content: [
          { type: "file" as const, data: image.base64, mediaType: image.mediaType },
          { type: "text" as const, text: normalizedMessage },
        ],
      }
    : { role: "user", content: normalizedMessage };

  return [
    // Single cached static block — one stable cache breakpoint.
    createSystemMessage(expandPromptTemplate(cascadeAskSystemPrompt)),
    // Volatile context stays uncached so it never invalidates the prefix.
    ...(sessionMemoryMessage ? [plainSystemMessage(sessionMemoryMessage)] : []),
    ...(image ? [plainSystemMessage(askImageResponseGuide)] : []),
    ...(analysisRulesMessage ? [plainSystemMessage(analysisRulesMessage)] : []),
    ...(knowledgeContextBlock ? [plainSystemMessage(knowledgeContextBlock)] : []),
    ...(request.history ?? []).slice(-MAX_HISTORY_TURNS).map((message) => ({
      role: message.role,
      content: message.content,
    })),
    userMessage,
  ];
}

function summarizeEvidence(toolResults: ToolResultRecord[]) {
  return toolResults
    .filter(
      (toolResult) =>
        toolResult.toolName &&
        toolResult.toolName !== "escalate" &&
        toolResult.toolName !== "submit_ask_card",
    )
    .map((toolResult) => {
      const serialized = JSON.stringify(toolResult.output);
      const clipped =
        serialized.length > MAX_FORWARDED_EVIDENCE_CHARS
          ? `${serialized.slice(0, MAX_FORWARDED_EVIDENCE_CHARS)}…`
          : serialized;
      return `${toolResult.toolName}: ${clipped}`;
    });
}

function buildEvidenceMessage(toolResults: ToolResultRecord[]): ModelMessage | null {
  const lines = summarizeEvidence(toolResults);
  if (lines.length === 0) {
    return null;
  }

  return plainSystemMessage(
    [
      "TOOL EVIDENCE FROM A PRIOR PASS",
      "These tool results were already fetched for this exact question. Reuse them instead of calling the same tool with the same input again. Call tools only for data that is missing.",
      "",
      ...lines,
    ].join("\n"),
  );
}

/**
 * Tool results own the numbers; the model owns the words. When the model's
 * final card matches the type of a card produced by a market/data tool this
 * turn, the live numeric fields are copied from the tool card.
 */
export function mergeToolOwnedNumbers(
  card: AskCard,
  toolResults: ToolResultRecord[],
): AskCard {
  const findToolCard = (toolName: string, type: AskCard["type"]) => {
    for (let index = toolResults.length - 1; index >= 0; index -= 1) {
      const toolResult = toolResults[index];
      if (toolResult.toolName !== toolName) {
        continue;
      }
      const output =
        toolResult.output && typeof toolResult.output === "object"
          ? (toolResult.output as { card?: unknown })
          : null;
      const parsed = askCardSchema.safeParse(output?.card);
      if (parsed.success && parsed.data.type === type) {
        return parsed.data;
      }
    }
    return null;
  };

  if (card.type === "briefing") {
    const toolCard = findToolCard("get_market_briefing", "briefing");
    if (toolCard && toolCard.type === "briefing") {
      return {
        ...card,
        asset: toolCard.asset,
        price: toolCard.price,
        change: toolCard.change,
        ...(toolCard.direction ? { direction: toolCard.direction } : {}),
        level1: toolCard.level1,
        level2: toolCard.level2,
      };
    }
  }

  if (card.type === "setup") {
    const toolCard = findToolCard("get_market_setup", "setup");
    if (toolCard && toolCard.type === "setup") {
      return {
        ...card,
        asset: toolCard.asset,
        entry: toolCard.entry,
        stop: toolCard.stop,
        target: toolCard.target,
        rr: toolCard.rr,
      };
    }
  }

  return card;
}

type TierRunResult = {
  toolResults: ToolResultRecord[];
  card: AskCard | null;
  escalated: boolean;
  escalationReason: string | null;
};

type TierLabel = "haiku" | "sonnet";

async function runTier({
  tier,
  model,
  modelId,
  messages,
  tools,
  maxSteps,
  generateTextImpl,
  sessionId,
  messageId,
  callbacks,
}: {
  tier: TierLabel;
  model: ReturnType<typeof getAskModel>;
  modelId: string;
  messages: ModelMessage[];
  tools: Record<string, unknown>;
  maxSteps: number;
  generateTextImpl: typeof generateText;
  sessionId: string;
  messageId: string;
  callbacks: AskGenerationCallbacks;
}): Promise<TierRunResult> {
  const collectedToolResults: ToolResultRecord[] = [];

  const result = await generateTextImpl({
    model,
    temperature: 0.2,
    maxOutputTokens: CASCADE_MAX_OUTPUT_TOKENS,
    maxRetries: CASCADE_MODEL_MAX_RETRIES,
    stopWhen: [stepCountIs(maxSteps), stopAfterFinalToolResult],
    messages,
    tools: tools as Parameters<typeof generateText>[0]["tools"],
    onStepFinish({ stepNumber, toolCalls, toolResults, finishReason, usage }) {
      collectedToolResults.push(...(toolResults as ToolResultRecord[]));

      logger.info("Ask cascade step finished.", {
        sessionId,
        messageId,
        tier,
        modelId,
        stepNumber,
        finishReason,
        toolCalls: toolCalls.map((toolCall) => ({
          toolName: toolCall.toolName,
          input: toolCall.input,
        })),
        usage,
      });

      toolCalls.forEach((toolCall) => {
        if (toolCall.toolName !== "escalate") {
          callbacks.onToolCall?.({ toolName: toolCall.toolName, input: toolCall.input });
        }
      });
    },
  });

  const finalToolResults = Array.isArray(result.toolResults)
    ? (result.toolResults as ToolResultRecord[])
    : [];
  for (const toolResult of finalToolResults) {
    if (!collectedToolResults.includes(toolResult)) {
      collectedToolResults.push(toolResult);
    }
  }

  const escalateResult = collectedToolResults.find(
    (toolResult) => toolResult.toolName === "escalate",
  );
  const escalationReason =
    escalateResult?.output && typeof escalateResult.output === "object"
      ? String((escalateResult.output as { reason?: unknown }).reason ?? "")
      : null;

  return {
    toolResults: collectedToolResults,
    card: extractSubmitAskCard(collectedToolResults, askCardSchema),
    escalated: hasToolResultNamed(collectedToolResults, "escalate"),
    escalationReason,
  };
}

function resolveTierCard(run: TierRunResult): AskCard | null {
  return run.card ?? extractToolCard(run.toolResults, askCardSchema);
}

/** Haiku may not finalize trade-action cards; those always get Sonnet's judgment. */
function requiresEscalationGuard(card: AskCard | null) {
  return card?.type === "setup" || card?.type === "chart";
}

/**
 * Cascade Ask pipeline (env flag ASK_PIPELINE=cascade):
 * retrieve → Haiku with full tools + escalate() → Sonnet only when escalated
 * (reusing tier-1 tool evidence) → tool-owned numeric merge.
 */
export async function generateAskCascadeResponse(
  input: AskRequest,
  dependencies: CascadeDependencies = {},
  callbacks: AskGenerationCallbacks = {},
): Promise<AskResponse> {
  const request = askRequestSchema.parse(input);
  const generateTextImpl = dependencies.generateTextImpl ?? generateText;
  const retrieveAskKnowledgeImpl =
    dependencies.retrieveAskKnowledgeImpl ?? retrieveAskKnowledge;
  const getActiveAnalysisRulesImpl =
    dependencies.getActiveAnalysisRulesImpl ?? getActiveAnalysisRules;

  const sessionId = request.sessionId ?? request.chatSessionId ?? crypto.randomUUID();
  const messageId = crypto.randomUUID();
  const image = parseImageDataUrl(request.image);
  const normalizedMessage = request.message || (image ? defaultAskImagePrompt : "");

  logger.info("Ask cascade generation started.", {
    sessionId,
    messageId,
    hasImage: Boolean(image),
    historyCount: request.history.length,
    promptPreview: normalizedMessage.slice(0, 160),
  });

  const [knowledge, analysisRulesMessage] = await Promise.all([
    retrieveAskKnowledgeImpl(normalizedMessage).catch((error: unknown) => {
      logger.warn("Ask cascade knowledge retrieval failed.", {
        sessionId,
        messageId,
        error: error instanceof Error ? error.message : String(error),
      });
      return { entityCandidates: [], chunks: [] };
    }),
    image
      ? getActiveAnalysisRulesImpl().then(buildAnalysisRulesPrompt)
      : Promise.resolve(null),
  ]);

  const knowledgeContextBlock = buildKnowledgeContextBlock(knowledge);
  const messages = buildCascadeMessages({
    request,
    normalizedMessage,
    image,
    analysisRulesMessage,
    knowledgeContextBlock,
  });

  const baseTools = createAskTools(dependencies);
  const finalize = (
    card: AskCard,
    source: string,
    toolResults: ToolResultRecord[],
    tier: TierLabel,
  ) => {
    const merged = mergeToolOwnedNumbers(card, toolResults);

    logger.info("Ask cascade generation completed.", {
      sessionId,
      messageId,
      tier,
      cardSource: source,
      finalCardType: merged.type,
      toolNames: toolResults.map((toolResult) => toolResult.toolName ?? "unknown"),
    });

    const uiMeta = extractUiMeta(merged, toolResults);

    return askResponseSchema.parse({
      data: sanitizeCard(merged),
      ...(uiMeta ? { uiMeta: sanitizeUiMeta(uiMeta) } : {}),
      sessionId,
      messageId,
    });
  };

  // Images skip the cheap tier: chart reading is a Sonnet job.
  let tier1: TierRunResult | null = null;
  if (!image) {
    try {
      tier1 = await runTier({
        tier: "haiku",
        model: getAskSimpleModel(),
        modelId: getAskSimpleModelId(),
        messages,
        tools: { ...baseTools, escalate: createEscalateTool() },
        maxSteps: TIER1_MAX_STEPS,
        generateTextImpl,
        sessionId,
        messageId,
        callbacks,
      });
    } catch (error) {
      logger.warn("Ask cascade tier 1 failed; falling through to tier 2.", {
        sessionId,
        messageId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (tier1 && !tier1.escalated) {
      const card = resolveTierCard(tier1);
      if (card && !requiresEscalationGuard(card)) {
        return finalize(card, tier1.card ? "submit_ask_card" : "tool_result", tier1.toolResults, "haiku");
      }

      if (card) {
        logger.info("Ask cascade guard escalated a trade-action card to tier 2.", {
          sessionId,
          messageId,
          cardType: card.type,
        });
      }
    } else if (tier1?.escalated) {
      logger.info("Ask cascade model escalated to tier 2.", {
        sessionId,
        messageId,
        reason: tier1.escalationReason,
      });
    }
  }

  const evidenceMessage = tier1 ? buildEvidenceMessage(tier1.toolResults) : null;
  const tier2Messages = evidenceMessage
    ? [...messages.slice(0, -1), evidenceMessage, messages[messages.length - 1]]
    : messages;

  let tier2: TierRunResult;
  try {
    tier2 = await runTier({
      tier: "sonnet",
      model: getAskModel(),
      modelId: getAskPrimaryModelId(),
      messages: tier2Messages,
      tools: baseTools,
      maxSteps: TIER2_MAX_STEPS,
      generateTextImpl,
      sessionId,
      messageId,
      callbacks,
    });
  } catch (error) {
    // Recover anything usable from either tier before surfacing the failure.
    const recovered = tier1 ? resolveTierCard(tier1) : null;
    if (recovered) {
      logger.warn("Ask cascade tier 2 failed; returning tier 1 card.", {
        sessionId,
        messageId,
        error: error instanceof Error ? error.message : String(error),
      });
      return finalize(recovered, "tier1_recovery", tier1?.toolResults ?? [], "haiku");
    }
    throw error;
  }

  const tier2Card = resolveTierCard(tier2);
  if (tier2Card) {
    return finalize(
      tier2Card,
      tier2.card ? "submit_ask_card" : "tool_result",
      tier2.toolResults,
      "sonnet",
    );
  }

  const tier1Card = tier1 ? resolveTierCard(tier1) : null;
  if (tier1Card) {
    return finalize(tier1Card, "tier1_recovery", tier1?.toolResults ?? [], "haiku");
  }

  logger.warn("Ask cascade produced no card; returning fallback insight.", {
    sessionId,
    messageId,
  });
  return finalize(fallbackInsightCard, "fallback", tier2.toolResults, "sonnet");
}
