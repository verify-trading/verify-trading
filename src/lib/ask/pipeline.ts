import { generateText, stepCountIs, type ModelMessage } from "ai";

import {
  buildAnalysisRulesPrompt,
  getActiveAnalysisRules,
} from "@/lib/ask/analysis-rules";
import {
  askCardSchema,
  askRequestSchema,
  askResponseSchema,
  fallbackInsightCard,
  imageFallbackInsightCard,
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
import { askSystemPrompt } from "@/lib/ask/system-prompt";
import { itveVerificationFramework } from "@/lib/ask/itve-prompt";
import { askImageResponseGuide, defaultAskImagePrompt } from "@/lib/ask/prompt";
import {
  extractSubmitAskCard,
  extractToolCard,
  extractUiMeta,
  parseImageDataUrl,
  withFollowups,
} from "@/lib/ask/service/context";
import { salvageCardFromText } from "@/lib/ask/service/card-output";
import {
  createSystemMessage,
  getAskModel,
  getAskPrimaryModelId,
} from "@/lib/ask/service/provider";
import { createAskTools } from "@/lib/ask/service/tools";
import type {
  AskGenerationCallbacks,
  AskServiceDependencies,
} from "@/lib/ask/service/types";
import {
  buildSessionMemoryMessage,
  deriveAskSessionMemory,
} from "@/lib/ask/session-memory";
import { expandPromptTemplate } from "@/lib/site-config";

const ASK_MAX_OUTPUT_TOKENS = 2500;
const ASK_MODEL_MAX_RETRIES = 2;
/**
 * Step budget for one Ask turn — headroom to chain a few tools (verify + web
 * search + a market tool) and still reach submit_ask_card.
 */
const ASK_MAX_STEPS = 10;

/** Recent turns kept verbatim; older context is carried by session memory. */
const MAX_HISTORY_TURNS = 12;

type ToolResultRecord = { toolName?: string; output?: unknown };

type AskGenerationDependencies = AskServiceDependencies & {
  retrieveAskKnowledgeImpl?: typeof retrieveAskKnowledge;
};

/**
 * Tools whose result IS the final card — deterministic calc/plan/projection
 * cards the model would otherwise just echo into submit_ask_card at the cost of
 * a full second round-trip. Excludes verify_entity (evidence, must synthesize),
 * get_market_setup (the model rewrites it in trader language), and the market/
 * news tools whose numbers still need folding into a synthesized answer.
 */
const DETERMINISTIC_CARD_TOOLS = new Set([
  "calculate_position_size",
  "calculate_risk_reward",
  "calculate_pip_value",
  "calculate_margin_required",
  "calculate_profit_loss",
  "generate_projection",
  "generate_growth_plan",
]);

function toolResultHasCompleteCard(toolResult: {
  toolName?: string;
  output?: unknown;
}): boolean {
  if (!toolResult.toolName || !DETERMINISTIC_CARD_TOOLS.has(toolResult.toolName)) {
    return false;
  }
  const output =
    toolResult.output && typeof toolResult.output === "object"
      ? (toolResult.output as { card?: unknown })
      : null;
  return askCardSchema.safeParse(output?.card).success;
}

export function stopAfterFinalToolResult({
  steps,
}: {
  steps: Array<{ toolResults?: Array<{ toolName?: string; output?: unknown }> }>;
}) {
  const lastStep = steps[steps.length - 1];
  const toolResults = lastStep?.toolResults ?? [];
  return toolResults.some(
    (toolResult) =>
      toolResult.toolName === "submit_ask_card" || toolResultHasCompleteCard(toolResult),
  );
}

function plainSystemMessage(content: string): ModelMessage {
  return { role: "system", content };
}

function buildAskMessages({
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
    createSystemMessage(expandPromptTemplate(askSystemPrompt)),
    // Volatile context stays uncached so it never invalidates the prefix.
    ...(sessionMemoryMessage ? [plainSystemMessage(sessionMemoryMessage)] : []),
    ...(image ? [plainSystemMessage(askImageResponseGuide)] : []),
    // Chart present => trade-verification mode: the ITVE engine framework with
    // the analysis rules (Engine 5's reference data) appended in the same block.
    ...(image
      ? [
          plainSystemMessage(
            analysisRulesMessage
              ? `${itveVerificationFramework}\n\n${analysisRulesMessage}`
              : itveVerificationFramework,
          ),
        ]
      : []),
    ...(knowledgeContextBlock ? [plainSystemMessage(knowledgeContextBlock)] : []),
    ...(request.history ?? []).slice(-MAX_HISTORY_TURNS).map((message) => ({
      role: message.role,
      content: message.content,
    })),
    userMessage,
  ];
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

  if (card.type === "broker") {
    // A numeric trust score is only ours to show when verify_entity matched a
    // reviewed record: copy that exact score from the tool card. With no DB
    // match (coverage miss, FCA-only, or a web-researched firm), the number is
    // not ours — force "N/A" so a model-assembled score never reads as a rating.
    const verifiedDbCard = findToolCard("verify_entity", "broker");
    return { ...card, score: verifiedDbCard?.type === "broker" ? verifiedDbCard.score : "N/A" };
  }

  return card;
}

type AskRunResult = {
  toolResults: ToolResultRecord[];
  card: AskCard | null;
  /** The model's final free text, kept so a non-tool answer can still be salvaged. */
  text: string;
};

async function runAskGeneration({
  messages,
  tools,
  maxSteps,
  generateTextImpl,
  sessionId,
  messageId,
  callbacks,
}: {
  messages: ModelMessage[];
  tools: Record<string, unknown>;
  maxSteps: number;
  generateTextImpl: typeof generateText;
  sessionId: string;
  messageId: string;
  callbacks: AskGenerationCallbacks;
}): Promise<AskRunResult> {
  const modelId = getAskPrimaryModelId();
  const collectedToolResults: ToolResultRecord[] = [];

  const result = await generateTextImpl({
    model: getAskModel(),
    temperature: 0.2,
    maxOutputTokens: ASK_MAX_OUTPUT_TOKENS,
    maxRetries: ASK_MODEL_MAX_RETRIES,
    stopWhen: [stepCountIs(maxSteps), stopAfterFinalToolResult],
    messages,
    tools: tools as Parameters<typeof generateText>[0]["tools"],
    onStepFinish({ stepNumber, toolCalls, toolResults, finishReason, usage }) {
      collectedToolResults.push(...(toolResults as ToolResultRecord[]));

      logger.info("Ask step finished.", {
        sessionId,
        messageId,
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
        callbacks.onToolCall?.({ toolName: toolCall.toolName, input: toolCall.input });
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

  return {
    toolResults: collectedToolResults,
    card: extractSubmitAskCard(collectedToolResults, askCardSchema),
    text: typeof result.text === "string" ? result.text : "",
  };
}

function resolveRunCard(run: AskRunResult): AskCard | null {
  return run.card ?? extractToolCard(run.toolResults, askCardSchema);
}

/**
 * Ask pipeline: retrieve knowledge (RAG) → one Sonnet pass with the full
 * toolset → tool-owned numeric merge → final card.
 */
export async function generateAskResponse(
  input: AskRequest,
  dependencies: AskGenerationDependencies = {},
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

  logger.info("Ask generation started.", {
    sessionId,
    messageId,
    hasImage: Boolean(image),
    historyCount: request.history.length,
    promptPreview: normalizedMessage.slice(0, 160),
  });

  const [knowledge, analysisRulesMessage] = await Promise.all([
    retrieveAskKnowledgeImpl(normalizedMessage).catch((error: unknown) => {
      logger.warn("Ask knowledge retrieval failed.", {
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
  const messages = buildAskMessages({
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
  ) => {
    const merged = mergeToolOwnedNumbers(card, toolResults);

    logger.info("Ask generation completed.", {
      sessionId,
      messageId,
      cardSource: source,
      finalCardType: merged.type,
      toolNames: toolResults.map((toolResult) => toolResult.toolName ?? "unknown"),
    });

    const uiMeta = withFollowups(extractUiMeta(merged, toolResults), toolResults);

    return askResponseSchema.parse({
      data: sanitizeCard(merged),
      ...(uiMeta ? { uiMeta: sanitizeUiMeta(uiMeta) } : {}),
      sessionId,
      messageId,
    });
  };

  const result = await runAskGeneration({
    messages,
    tools: baseTools,
    maxSteps: ASK_MAX_STEPS,
    generateTextImpl,
    sessionId,
    messageId,
    callbacks,
  });

  const toolCard = resolveRunCard(result);
  const card = toolCard ?? salvageCardFromText(result.text);
  if (card) {
    const source = result.card
      ? "submit_ask_card"
      : toolCard
        ? "tool_result"
        : "model_text";
    return finalize(card, source, result.toolResults);
  }

  logger.warn("Ask produced no card; returning fallback insight.", {
    sessionId,
    messageId,
    hasImage: Boolean(image),
  });
  return finalize(
    image ? imageFallbackInsightCard : fallbackInsightCard,
    "fallback",
    result.toolResults,
  );
}
