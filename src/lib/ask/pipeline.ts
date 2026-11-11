import { routeAskMessage, type AskRoute } from "@/lib/ask/routing";
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
import { createAskTools, resolveVerificationToolResult } from "@/lib/ask/service/tools";
import { btsVerificationGate } from "@/lib/compare/bts-research";
import { cardStatus, statusColor } from "@/lib/compare/bts";
import type { BtsAskContext } from "@/lib/compare/bts-data";
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
type AskStep = { toolResults?: ToolResultRecord[] };

type AskGenerationDependencies = AskServiceDependencies & {
  retrieveAskKnowledgeImpl?: typeof retrieveAskKnowledge;
  route?: AskRoute;
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

function parseToolCard(toolResult: ToolResultRecord): AskCard | null {
  const output =
    toolResult.output && typeof toolResult.output === "object"
      ? (toolResult.output as { card?: unknown })
      : null;
  const parsed = askCardSchema.safeParse(output?.card);
  return parsed.success ? parsed.data : null;
}

function lastStepToolResults(steps: AskStep[]): ToolResultRecord[] {
  return steps[steps.length - 1]?.toolResults ?? [];
}

function finalCardIn(toolResults: ToolResultRecord[]): boolean {
  return toolResults.some((toolResult) => {
    const endsTurn =
      toolResult.toolName === "submit_ask_card" ||
      Boolean(toolResult.toolName && DETERMINISTIC_CARD_TOOLS.has(toolResult.toolName));
    return endsTurn && Boolean(parseToolCard(toolResult));
  });
}

export function stopAfterFinalToolResult({ steps }: { steps: AskStep[] }): boolean {
  return finalCardIn(lastStepToolResults(steps));
}

/** Advice questions ("is £200 enough?") need the numbers explained, so a calculator card can't end the turn. */
const ADVICE_QUESTION = /\b(?:enough|worth|should i|is it (?:ok|okay|good|wise|safe)|can i|good idea|realistic|beginner|new to)\b/i;

function stopAfterSubmittedCard({ steps }: { steps: AskStep[] }) {
  return lastStepToolResults(steps).some(
    (toolResult) => toolResult.toolName === "submit_ask_card" && Boolean(parseToolCard(toolResult)),
  );
}

function plainSystemMessage(content: string): ModelMessage {
  return { role: "system", content };
}

function buildAskMessages({
  route,
  request,
  normalizedMessage,
  image,
  analysisRulesMessage,
  knowledgeContextBlock,
}: {
  request: AskRequest;
  route: AskRoute;
  normalizedMessage: string;
  image: ReturnType<typeof parseImageDataUrl>;
  analysisRulesMessage: string | null;
  knowledgeContextBlock: string | null;
}): ModelMessage[] {
  const profile = route.kind !== "safety" ? route.profile : undefined;
  const memory = deriveAskSessionMemory(request.history, request.sessionMemory ?? null);
  const sessionMemoryMessage = buildSessionMemoryMessage(profile ? { ...memory, brokerPreferences: profile } : memory);

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

/** The engine context verify_entity returned for this card's firm (exact name match only), if any. */
function findEngineVerdict(toolResults: ToolResultRecord[], cardName: string): BtsAskContext | null {
  const name = cardName.trim().toLowerCase();
  for (let index = toolResults.length - 1; index >= 0; index -= 1) {
    const toolResult = toolResults[index];
    if (toolResult.toolName !== "verify_entity" || !toolResult.output || typeof toolResult.output !== "object") continue;
    const bts = (toolResult.output as { bts?: BtsAskContext }).bts;
    if (bts && bts.firm.replace(/\s*\(.*\)$/, "").trim().toLowerCase() === name) return bts;
  }
  return null;
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
      const card = parseToolCard(toolResult);
      if (card?.type === type) {
        return card;
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
    const gated = findEngineVerdict(toolResults, card.name);
    const sameFirm = (candidate: AskCard | null): candidate is Extract<AskCard, { type: "broker" }> =>
      candidate?.type === "broker" && candidate.name.trim().toLowerCase() === card.name.trim().toLowerCase();

    if (sameFirm(verifiedDbCard) && gated && btsVerificationGate(gated.operatingStatus, gated.researchStatus)) return verifiedDbCard;
    if (sameFirm(verifiedDbCard)) {
      return { ...card, score: verifiedDbCard.score, status: verifiedDbCard.status, fca: verifiedDbCard.fca, complaints: verifiedDbCard.complaints, color: verifiedDbCard.color };
    }
    // A firm the engine scored but the site has no page for: the engine's number and verdict, verbatim.
    if (gated) {
      const { verdict, score } = gated.shown;
      const status = cardStatus(verdict);
      return { ...card, score: score === null ? "No score" : `${score}/100`, status, complaints: gated.conductRecord, color: statusColor(status) };
    }
    return { ...card, score: "N/A" };
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
  explain = false,
}: {
  messages: ModelMessage[];
  tools: Record<string, unknown>;
  maxSteps: number;
  explain?: boolean;
  generateTextImpl: typeof generateText;
  sessionId: string;
  messageId: string;
  callbacks: AskGenerationCallbacks;
}): Promise<AskRunResult> {
  const modelId = getAskPrimaryModelId();
  const collectedToolResults: ToolResultRecord[] = [];
  let stepStartedAt = Date.now();

  const result = await generateTextImpl({
    model: getAskModel(),
    maxOutputTokens: ASK_MAX_OUTPUT_TOKENS,
    maxRetries: ASK_MODEL_MAX_RETRIES,
    stopWhen: [stepCountIs(maxSteps), explain ? stopAfterSubmittedCard : stopAfterFinalToolResult],
    messages,
    tools: tools as Parameters<typeof generateText>[0]["tools"],
    experimental_onStepStart({ stepNumber }) {
      stepStartedAt = Date.now();
      logger.info("Ask model step started.", { sessionId, messageId, modelId, stepNumber });
    },
    experimental_onToolCallStart({ toolCall }) {
      callbacks.onToolCall?.({ toolName: toolCall.toolName, input: toolCall.input });
    },
    experimental_onToolCallFinish({ stepNumber, toolCall, durationMs, success }) {
      logger.info("Ask tool finished.", {
        sessionId,
        messageId,
        stepNumber,
        toolName: toolCall.toolName,
        durationMs,
        success,
      });
    },
    onStepFinish({ stepNumber, toolCalls, toolResults, finishReason, usage }) {
      collectedToolResults.push(...(toolResults as ToolResultRecord[]));

      logger.info("Ask step finished.", {
        sessionId,
        messageId,
        modelId,
        stepNumber,
        durationMs: Date.now() - stepStartedAt,
        finishReason,
        toolCalls: toolCalls.map((toolCall) => ({
          toolName: toolCall.toolName,
          input: toolCall.input,
        })),
        usage,
      });

      toolCalls.forEach((toolCall) => {
        // Provider-run tools do not invoke the local execution hooks above.
        if (toolCall.providerExecuted) {
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
 * Ask pipeline: retrieve knowledge (RAG) → one model pass with the full
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
  const route = dependencies.route ?? await routeAskMessage(request);
  if (route.kind === "questionnaire") return askResponseSchema.parse({ data: route.clarification, sessionId, messageId });
  const profile = route.kind === "model" ? route.profile : undefined;
  const generationStartedAt = Date.now();

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

  logger.info("Ask context prepared.", {
    sessionId,
    messageId,
    durationMs: Date.now() - generationStartedAt,
  });

  const knowledgeContextBlock = buildKnowledgeContextBlock(knowledge);
  const messages = buildAskMessages({
    route,
    request,
    normalizedMessage,
    image,
    analysisRulesMessage,
    knowledgeContextBlock,
  });

  // A shortlist checks several firms at once; a shorter live-check wait keeps the reply inside the app timeout.
  const baseTools = createAskTools({ ...dependencies, brokerPreferences: profile ?? request.sessionMemory?.brokerPreferences, ...(route.kind === "model" && route.pick ? { liveCheckWaitMs: 60_000 } : {}) });
  const finalize = (
    card: AskCard,
    source: string,
    toolResults: ToolResultRecord[],
  ) => {
    const resolved = mergeToolOwnedNumbers(card, toolResults);
    const comparison = resolved.type === "insight" && (toolResults.some(result => result.toolName === "list_verified_entities" && result.output && typeof result.output === "object" && "bts" in result.output));
    const merged: AskCard = comparison ? { ...resolved, variant: "broker_discovery" } : resolved;

    logger.info("Ask generation completed.", {
      sessionId,
      messageId,
      durationMs: Date.now() - generationStartedAt,
      cardSource: source,
      finalCardType: merged.type,
      toolNames: toolResults.map((toolResult) => toolResult.toolName ?? "unknown"),
    });

    const extracted = extractUiMeta(merged, toolResults);
    // The engine scores software too; its card shows the type instead of a regulator.
    const isTool = merged.type === "broker" && findEngineVerdict(toolResults, merged.name)?.type === "tool";
    const uiMeta = withFollowups(isTool ? { ...extracted, verificationKind: "tool" as const } : extracted, toolResults);
    // A card that asks the user something wants their answer, not a suggestion chip.
    if (uiMeta?.followups?.length && /\?\s*$/.test(merged.verdict)) uiMeta.followups = [];

    return askResponseSchema.parse({
      data: sanitizeCard(merged),
      ...(uiMeta ? { uiMeta: sanitizeUiMeta(uiMeta) } : {}),
      sessionId,
      messageId,
    });
  };

  // A reviewed exact match already has a complete, deterministic card. Serving it here
  // avoids two slow gateway model turns (select verify_entity, then submit_ask_card) while
  // keeping fuzzy/unknown names on the model path where clarification and research matter.
  // A question about a place ("is IG safe in South Africa") goes to the model, which picks the country.
  if (route.kind === "safety") {
    const verification = await resolveVerificationToolResult(route.firm, dependencies, dependencies.country);
    if ("card" in verification) {
      const c = verification.card;
      // The direct path skips the model, so it brings its own next questions for a scored firm.
      const followups = c.type === "broker" && /\/100$/.test(c.score)
        ? c.status === "AVOID"
          ? [`Why is ${c.name} rated so low?`, "Show me safer alternatives", `What if I already deposited?`]
          : [`What should I ask ${c.name} first?`, `How does ${c.name} compare to others?`, "Show me alternatives for my country"]
        : [];
      return finalize(
        c,
        "exact_verified_entity",
        [{ toolName: "verify_entity", output: verification }, ...(followups.length ? [{ toolName: "submit_ask_card", output: { card: c, followups } }] : [])],
      );
    }
  }

  const result = await runAskGeneration({
    messages,
    tools: baseTools,
    maxSteps: ASK_MAX_STEPS,
    explain: ADVICE_QUESTION.test(normalizedMessage),
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
