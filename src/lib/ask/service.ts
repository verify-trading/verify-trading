import { APICallError, generateText, RetryError, stepCountIs, streamText, type ModelMessage } from "ai";

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
import { logger } from "@/lib/observability/logger";
import {
  askImageResponseGuide,
  askResponseGuide,
  defaultAskImagePrompt,
  verifyTradingSystemPrompt,
} from "@/lib/ask/prompt";
import { generateProjectionCard } from "@/lib/ask/projections";
import { extractGrowthPlanShortcutCard } from "@/lib/ask/plans";
import { expandPromptTemplate } from "@/lib/site-config";
import {
  extractJson,
  extractSubmitAskCard,
  extractToolCard,
  extractUiMeta,
  parseImageDataUrl,
} from "@/lib/ask/service/context";
import {
  createSystemMessage,
  getAskFallbackModel,
  getAskFallbackModelId,
  getAskModel,
  getAskPrimaryModelId,
} from "@/lib/ask/service/provider";
import { createAskTools } from "@/lib/ask/service/tools";
import type { AskServiceDependencies } from "@/lib/ask/service/types";

const ASK_MODEL_MAX_RETRIES = 2;

/** Model + tool turns (e.g. search_news + get_market_briefing + submit_ask_card). */
export const ASK_MAX_TOOL_STEPS = 6;

const ASK_MODEL_MAX_OUTPUT_TOKENS = 800;

export type AskGenerationCallbacks = {
  onToolCall?: (event: { toolName: string; input: unknown }) => void;
};

function isCapacityOrTransientApiError(error: unknown): boolean {
  if (APICallError.isInstance(error)) {
    const code = error.statusCode;
    if (code === 401 || code === 403) {
      return false;
    }
    if (code === 408 || code === 429 || code === 503 || code === 529) {
      return true;
    }
    if (code !== undefined && code >= 500) {
      return true;
    }
  }

  if (error instanceof Error) {
    const m = error.message.toLowerCase();
    return (
      /overloaded|over capacity|rate limit|too many requests|temporarily unavailable|try again|timeout|529|503|502|504/.test(
        m,
      ) || m.includes("econnreset") || m.includes("econnrefused")
    );
  }

  return false;
}

function shouldAttemptAskFallbackModel(error: unknown): boolean {
  if (getAskPrimaryModelId() === getAskFallbackModelId()) {
    return false;
  }

  if (RetryError.isInstance(error)) {
    if (error.reason !== "maxRetriesExceeded") {
      return false;
    }
    if (isCapacityOrTransientApiError(error.lastError)) {
      return true;
    }
    return isCapacityOrTransientApiError(error);
  }

  return isCapacityOrTransientApiError(error);
}

function summarizeToolResults(toolResults: Array<{ toolName?: string; output?: unknown }>) {
  return toolResults.map((toolResult) => {
    const output = toolResult.output;

    if (output && typeof output === "object") {
      const value = output as Record<string, unknown>;

      return {
        toolName: toolResult.toolName ?? "unknown",
        outputKeys: Object.keys(value),
      };
    }

    return {
      toolName: toolResult.toolName ?? "unknown",
      outputType: typeof output,
    };
  });
}

function buildInsightCard(headline: string, body: string, verdict: string) {
  return {
    type: "insight" as const,
    headline,
    body,
    verdict,
  };
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function clampWords(value: string, maxWords: number) {
  const words = normalizeWhitespace(value).split(" ");
  if (words.length <= maxWords) {
    return words.join(" ");
  }

  return `${words.slice(0, maxWords).join(" ")}…`;
}

function buildInsightCardFromModelText(text: string) {
  const normalized = normalizeWhitespace(text);
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("{") || normalized.startsWith("[")) {
    return null;
  }

  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const first = sentences[0] ?? normalized;
  const second = sentences[1] ?? "";
  const asksForInput = /\?/.test(normalized) || /\b(i need|send|give me|what)\b/i.test(first);

  return buildInsightCard(
    asksForInput ? "Need Input" : "Quick Take",
    clampWords(first, 60),
    clampWords(second || (asksForInput ? "Reply with the missing detail." : "Ask a sharper follow-up if you want me to refine it."), 60),
  );
}

type DerivedSessionState = {
  activeAsset?: string;
  activeCardType?: AskCard["type"];
  activeSide?: "buy" | "sell";
  lastSetup?: {
    entry: string;
    stop: string;
    target: string;
    bias: "Bullish" | "Bearish" | "Neutral";
  };
  lastProjection?: {
    months: number;
    startBalance: number;
    monthlyAdd: number;
    totalReturn: string;
  };
  lastPlan?: {
    startBalance: number;
    monthlyAdd: number;
    dailyTarget: string;
    monthlyTarget: string;
    projectionReturn: string;
  };
  lastVerifiedEntity?: {
    name: string;
    status: string;
    kind: "broker" | "guru";
  };
  recentUserMessages: string[];
};

function inferTradeSideFromCard(card: AskCard): "buy" | "sell" | undefined {
  if (card.type !== "setup" && card.type !== "chart") {
    return undefined;
  }

  if (card.bias === "Bullish") {
    return "buy";
  }
  if (card.bias === "Bearish") {
    return "sell";
  }

  return undefined;
}

function deriveSessionState(history: AskRequest["history"] | undefined): DerivedSessionState | null {
  const messages = history ?? [];

  if (!messages.length) {
    return null;
  }

  const state: DerivedSessionState = {
    recentUserMessages: [],
  };

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message.role === "user") {
      if (message.content.trim() && state.recentUserMessages.length < 2) {
        state.recentUserMessages.push(clampWords(message.content, 20));
      }
      continue;
    }

    const parsed = askCardSchema.safeParse(extractJson(message.content));
    if (!parsed.success) {
      continue;
    }

    const card = parsed.data;

    state.activeCardType ??= card.type;

    if ((card.type === "briefing" || card.type === "setup") && !state.activeAsset) {
      state.activeAsset = card.asset;
    }

    if (card.type === "setup" && !state.lastSetup) {
      state.lastSetup = {
        entry: card.entry,
        stop: card.stop,
        target: card.target,
        bias: card.bias,
      };
      state.activeSide ??= inferTradeSideFromCard(card);
    }

    if (card.type === "projection" && !state.lastProjection) {
      state.lastProjection = {
        months: card.months,
        startBalance: card.startBalance,
        monthlyAdd: card.monthlyAdd,
        totalReturn: card.totalReturn,
      };
    }

    if (card.type === "plan" && !state.lastPlan) {
      state.lastPlan = {
        startBalance: card.startBalance,
        monthlyAdd: card.monthlyAdd,
        dailyTarget: card.dailyTarget,
        monthlyTarget: card.monthlyTarget,
        projectionReturn: card.projectionReturn,
      };
    }

    if ((card.type === "broker" || card.type === "guru") && !state.lastVerifiedEntity) {
      state.lastVerifiedEntity = {
        name: card.name,
        status: card.status,
        kind: card.type,
      };
    }
  }

  return Object.keys(state).length > 1 ? state : null;
}

function buildSessionStateMessage(state: DerivedSessionState | null) {
  if (!state) {
    return null;
  }

  const lines = [
    "SESSION STATE",
    "Use this only to resolve omitted context in follow-up questions. Explicit user input overrides it.",
  ];

  if (state.activeAsset) {
    lines.push(`Active asset: ${state.activeAsset}`);
  }
  if (state.activeCardType) {
    lines.push(`Last card type: ${state.activeCardType}`);
  }
  if (state.activeSide) {
    lines.push(`Active trade side: ${state.activeSide}`);
  }
  if (state.lastSetup) {
    lines.push(
      `Last setup: bias ${state.lastSetup.bias}, entry ${state.lastSetup.entry}, stop ${state.lastSetup.stop}, target ${state.lastSetup.target}`,
    );
  }
  if (state.lastProjection) {
    lines.push(
      `Last projection: ${state.lastProjection.months} months, start ${state.lastProjection.startBalance}, monthly add ${state.lastProjection.monthlyAdd}, total return ${state.lastProjection.totalReturn}`,
    );
  }
  if (state.lastPlan) {
    lines.push(
      `Last plan: start ${state.lastPlan.startBalance}, monthly add ${state.lastPlan.monthlyAdd}, daily target ${state.lastPlan.dailyTarget}, monthly target ${state.lastPlan.monthlyTarget}, projection return ${state.lastPlan.projectionReturn}`,
    );
  }
  if (state.lastVerifiedEntity) {
    lines.push(
      `Last verified entity: ${state.lastVerifiedEntity.name} (${state.lastVerifiedEntity.kind}, ${state.lastVerifiedEntity.status})`,
    );
  }
  if (state.recentUserMessages.length > 0) {
    lines.push(`Recent user messages: ${state.recentUserMessages.join(" | ")}`);
  }

  return lines.join("\n");
}

function parseFlexibleNumber(raw: string): number | null {
  const normalized = raw.replace(/[$£€,]/g, "").trim().toLowerCase();
  const match = normalized.match(/^(\d+(?:\.\d+)?)([km])?$/);
  if (!match) {
    return null;
  }

  const value = Number.parseFloat(match[1]);
  if (!Number.isFinite(value)) {
    return null;
  }

  const suffix = match[2];
  if (suffix === "k") {
    return value * 1_000;
  }
  if (suffix === "m") {
    return value * 1_000_000;
  }

  return value;
}

function extractCurrencySymbol(raw: string) {
  return raw.match(/[$£€]/)?.[0];
}

function extractProjectionShortcutCard(message: string) {
  const normalized = message.toLowerCase();
  const looksLikeProjection =
    /\bprojection\b/.test(normalized) ||
    /\bproject\b/.test(normalized) ||
    /\bforecast\b/.test(normalized) ||
    /\bcompound(?:ing)?\b/.test(normalized);

  if (!looksLikeProjection) {
    return null;
  }

  const monthsMatch = normalized.match(/(\d{1,3})\s*(?:-| )?\s*(?:month|months|mo)\b/);
  const startMatch =
    message.match(/([£$€]?\s*\d[\d,.]*(?:\.\d+)?\s*[kKmM]?)\s*start\b/i) ??
    message.match(/\bstart(?:ing)?(?:\s+balance)?(?:\s+with)?\s*[:=]?\s*([£$€]?\s*\d[\d,.]*(?:\.\d+)?\s*[kKmM]?)/i);
  const monthlyAddMatch =
    message.match(/\b(?:monthly\s+(?:add|deposit|top(?: |-)?up)|top(?: |-)?up)\s*[:=]?\s*([£$€]?\s*\d[\d,.]*(?:\.\d+)?\s*[kKmM]?)/i) ??
    message.match(/([£$€]?\s*\d[\d,.]*(?:\.\d+)?\s*[kKmM]?)\s*(?:monthly\s+)?top(?: |-)?up\b/i) ??
    message.match(/([£$€]?\s*\d[\d,.]*(?:\.\d+)?\s*[kKmM]?)\s*(?:\/\s*month|\bper month\b|\ba month\b)/i);
  const monthlyReturnMatch = message.match(
    /\b(\d+(?:\.\d+)?)\s*%\s*(?:monthly|per month|a month)\b/i,
  );
  const drawdownPercentMatch = message.match(/\b(\d+(?:\.\d+)?)\s*%\s*drawdowns?\b/i);
  const drawdownEveryMonthsMatch = message.match(/\bevery\s+(\d{1,3})\s*(?:-| )?\s*(?:month|months|mo)\b/i);

  const months = monthsMatch ? Number.parseInt(monthsMatch[1], 10) : Number.NaN;
  const startBalance = startMatch ? parseFlexibleNumber(startMatch[1]) : null;
  const monthlyAdd = monthlyAddMatch ? parseFlexibleNumber(monthlyAddMatch[1]) : null;
  const monthlyReturnPercent = monthlyReturnMatch
    ? Number.parseFloat(monthlyReturnMatch[1])
    : null;
  const drawdownPercent = drawdownPercentMatch
    ? Number.parseFloat(drawdownPercentMatch[1])
    : null;
  const drawdownEveryMonths = drawdownEveryMonthsMatch
    ? Number.parseInt(drawdownEveryMonthsMatch[1], 10)
    : null;
  const currencySymbol = startMatch ? extractCurrencySymbol(startMatch[1]) : undefined;

  if (!Number.isInteger(months) || months <= 0 || startBalance == null) {
    return null;
  }

  return generateProjectionCard({
    months,
    startBalance,
    ...(monthlyAdd != null ? { monthlyAdd } : {}),
    ...(currencySymbol ? { currencySymbol } : {}),
    ...(monthlyReturnPercent != null ? { monthlyReturnPercent } : {}),
    ...(drawdownPercent != null ? { drawdownPercent } : {}),
    ...(drawdownEveryMonths != null ? { drawdownEveryMonths } : {}),
  });
}

function resolveClarificationCard(request: AskRequest) {
  const normalized = request.message.toLowerCase();

  const asksForPositionSize =
    /\blot size\b/.test(normalized) ||
    /\bposition size\b/.test(normalized) ||
    /\bhow much to trade\b/.test(normalized);
  const hasCashRisk =
    /\brisk(?:ing)?\s*(?:of\s*)?(?:£|\$|€)\s*\d/.test(normalized) ||
    /\b(?:£|\$|€)\s*\d[\d,.]*\s*(?:risk|at risk)\b/.test(normalized) ||
    /\b\d[\d,.]*\s*(?:quid|bucks|dollars|euros)\s*risk\b/.test(normalized);
  const hasStopValue =
    /\b(?:stop|sl)\s*\d/.test(normalized) ||
    /\b\d[\d,.]*\s*(?:pip|pips)?\s*(?:stop|sl)\b/.test(normalized);
  const hasRiskPercent = /\b\d+(?:\.\d+)?\s*%/.test(normalized);
  const mentionsAccount = /\b(account|balance|acct|equity)\b/.test(normalized);

  if (asksForPositionSize && hasCashRisk && hasStopValue && !hasRiskPercent && !mentionsAccount) {
    return buildInsightCard(
      "Need Account Size",
      "That reads like direct money risk plus a stop loss, not account size plus risk percent. I need the account size or risk percent to size it properly.",
      "Send the account size or risk percent.",
    );
  }

  return null;
}

/** Short replies that are only gratitude or acknowledgement — not trading questions. */
const ACK_ONLY_PHRASES = new Set([
  "thanks",
  "thank you",
  "thank you so much",
  "thanks a lot",
  "thanks very much",
  "thanks again",
  "thx",
  "ty",
  "tyvm",
  "cheers",
  "appreciate it",
  "much appreciated",
  "got it",
  "gotcha",
  "ok",
  "okay",
  "k",
  "cool",
  "nice",
  "perfect",
  "great",
  "sounds good",
  "will do",
  "yes",
  "yep",
  "yeah",
  "yup",
  "alright",
  "all right",
  "good to know",
  "makes sense",
  "fair enough",
  "fair",
  "noted",
  "understood",
  "love it",
  "legend",
  "grateful",
  "ta",
  "merci",
  "🙏",
  "👍",
]);

function stripTrailingPunctuationForAck(value: string) {
  return value.replace(/[!?.…]+$/u, "").trim();
}

function resolveAcknowledgementCard(request: AskRequest): ReturnType<typeof buildInsightCard> | null {
  if (request.image) {
    return null;
  }

  const raw = normalizeWhitespace(request.message);
  if (!raw || raw.length > 72) {
    return null;
  }

  const key = stripTrailingPunctuationForAck(raw.toLowerCase());
  if (!key || !ACK_ONLY_PHRASES.has(key)) {
    return null;
  }

  return buildInsightCard(
    "You're welcome",
    "Glad that helped. If anything else comes up on markets, brokers, risk, or setups, just ask.",
    "Send your next trading question when you are ready.",
  );
}

export async function generateAskResponse(
  input: AskRequest,
  dependencies: AskServiceDependencies = {},
  callbacks: AskGenerationCallbacks = {},
): Promise<AskResponse> {
  const request = askRequestSchema.parse(input);
  const generateTextImpl = dependencies.generateTextImpl ?? generateText;

  const sessionId = request.sessionId ?? request.chatSessionId ?? crypto.randomUUID();
  const messageId = crypto.randomUUID();
  const image = parseImageDataUrl(request.image);
  const normalizedMessage = request.message || (image ? defaultAskImagePrompt : "");
  const completedToolResults: Array<{ toolName?: string; output?: unknown }> = [];
  const sessionState = deriveSessionState(request.history);
  const sessionStateMessage = buildSessionStateMessage(sessionState);

  logger.info("Ask generation started.", {
    sessionId,
    messageId,
    hasImage: Boolean(image),
    historyCount: request.history.length,
    promptPreview: normalizedMessage.slice(0, 160),
  });

  const clarificationCard = resolveClarificationCard(request);
  if (clarificationCard) {
    logger.info("Ask generation completed.", {
      sessionId,
      messageId,
      finalCardType: clarificationCard.type,
      cardSource: "clarification",
      toolResults: [],
    });

    return askResponseSchema.parse({
      data: sanitizeCard(clarificationCard),
      sessionId,
      messageId,
    });
  }

  const acknowledgementCard = resolveAcknowledgementCard(request);
  if (acknowledgementCard) {
    logger.info("Ask generation completed.", {
      sessionId,
      messageId,
      finalCardType: acknowledgementCard.type,
      cardSource: "acknowledgement",
      toolResults: [],
    });

    return askResponseSchema.parse({
      data: sanitizeCard(acknowledgementCard),
      sessionId,
      messageId,
    });
  }

  const growthPlanShortcutCard = extractGrowthPlanShortcutCard(normalizedMessage);
  if (growthPlanShortcutCard) {
    logger.info("Ask generation completed.", {
      sessionId,
      messageId,
      finalCardType: growthPlanShortcutCard.type,
      cardSource: "growth_plan_shortcut",
      toolResults: [],
    });

    return askResponseSchema.parse({
      data: sanitizeCard(growthPlanShortcutCard),
      sessionId,
      messageId,
    });
  }

  const projectionShortcutCard = extractProjectionShortcutCard(normalizedMessage);
  if (projectionShortcutCard) {
    logger.info("Ask generation completed.", {
      sessionId,
      messageId,
      finalCardType: projectionShortcutCard.type,
      cardSource: "projection_shortcut",
      toolResults: [],
    });

    return askResponseSchema.parse({
      data: sanitizeCard(projectionShortcutCard),
      uiMeta: sanitizeUiMeta(extractUiMeta(projectionShortcutCard, [])),
      sessionId,
      messageId,
    });
  }

  const runGenerate = async (model: ReturnType<typeof getAskModel>) => {
    completedToolResults.length = 0;

    return generateTextImpl({
      model,
      temperature: 0.2,
      maxOutputTokens: ASK_MODEL_MAX_OUTPUT_TOKENS,
      maxRetries: ASK_MODEL_MAX_RETRIES,
      stopWhen: stepCountIs(ASK_MAX_TOOL_STEPS),
      onStepFinish({
        stepNumber,
        text,
        toolCalls,
        toolResults,
        finishReason,
        usage,
      }) {
        completedToolResults.push(
          ...(toolResults as Array<{ toolName?: string; output?: unknown }>),
        );

        logger.info("Ask generation step finished.", {
          sessionId,
          messageId,
          stepNumber,
          finishReason,
          textPreview: text ? text.slice(0, 160) : "",
          toolCalls: toolCalls.map((toolCall) => ({
            toolName: toolCall.toolName,
            input: toolCall.input,
          })),
          toolResults: summarizeToolResults(
            toolResults as Array<{ toolName?: string; output?: unknown }>,
          ),
          usage,
        });

        toolCalls.forEach((toolCall) => {
          callbacks.onToolCall?.({
            toolName: toolCall.toolName,
            input: toolCall.input,
          });
        });
      },
      messages: [
        createSystemMessage(expandPromptTemplate(verifyTradingSystemPrompt)),
        createSystemMessage(askResponseGuide),
        ...(sessionStateMessage ? [createSystemMessage(sessionStateMessage)] : []),
        ...(image ? [createSystemMessage(askImageResponseGuide)] : []),
        ...request.history.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        image
          ? {
              role: "user",
              content: [
                {
                  type: "file" as const,
                  data: image.base64,
                  mediaType: image.mediaType,
                },
                {
                  type: "text" as const,
                  text: normalizedMessage,
                },
              ],
            }
          : {
              role: "user",
              content: normalizedMessage,
            },
      ],
      tools: createAskTools(dependencies),
    });
  };

  let result;

  try {
    result = await runGenerate(getAskModel());
  } catch (error) {
    if (shouldAttemptAskFallbackModel(error)) {
      logger.warn("Ask primary model failed; retrying with fallback model.", {
        sessionId,
        messageId,
        primaryModel: getAskPrimaryModelId(),
        fallbackModel: getAskFallbackModelId(),
        error: error instanceof Error ? error.message : String(error),
      });
      result = await runGenerate(getAskFallbackModel());
    } else {
      throw error;
    }
  }

  const allToolResults = [
    ...completedToolResults,
    ...(result.toolResults as Array<{ toolName?: string; output?: unknown }>),
  ];

  logger.info("Tool results received.", {
    sessionId,
    count: allToolResults.length,
    tools: allToolResults.map((t) => t.toolName),
    outputs: allToolResults.map((t) => JSON.stringify(t.output).slice(0, 200)),
  });

  const parsedText = extractJson(result.text);
  const parsedCard = parsedText ? askCardSchema.safeParse(parsedText) : null;
  const submitCard = extractSubmitAskCard(allToolResults, askCardSchema);
  const toolCard = extractToolCard(allToolResults, askCardSchema);

  logger.info("Card extraction results.", {
    sessionId,
    hasSubmitCard: !!submitCard,
    hasToolCard: !!toolCard,
    toolCardType: toolCard?.type ?? null,
    hasParsedCard: !!parsedCard?.success,
    parsedCardType: parsedCard?.success ? parsedCard.data?.type : null,
  });

  if (parsedText && parsedCard && !parsedCard.success) {
    logger.warn("Ask model output did not match card schema.", {
      sessionId,
      messageId,
      parsedType:
        parsedText && typeof parsedText === "object" && !Array.isArray(parsedText)
          ? (parsedText as { type?: unknown }).type ?? null
          : null,
      issues: parsedCard.error.issues.slice(0, 6).map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const wrappedTextCard =
    !submitCard && !toolCard && !parsedCard?.success && !parsedText
      ? buildInsightCardFromModelText(result.text)
      : null;

  const card =
    submitCard ??
    (parsedCard?.success ? parsedCard.data : null) ??
    toolCard ??
    wrappedTextCard ??
    fallbackInsightCard;

  logger.info("Ask generation completed.", {
    sessionId,
    messageId,
    finalCardType: card.type,
    cardSource: submitCard
      ? "submit_ask_card"
      : parsedCard?.success
        ? "model_text"
        : toolCard
          ? "tool_result"
          : wrappedTextCard
            ? "wrapped_text"
          : "fallback",
    toolResults: summarizeToolResults(allToolResults),
  });

  return askResponseSchema.parse({
    data: sanitizeCard(card),
    uiMeta: sanitizeUiMeta(extractUiMeta(card, allToolResults)),
    sessionId,
    messageId,
  });
}

export type AskStreamCallbacks = {
  onToolCall?: (toolName: string, args: Record<string, unknown>) => void;
  onTextDelta?: (text: string) => void;
  onDone?: (response: AskResponse) => void;
  onError?: (error: unknown) => void;
};

export function streamAskResponse(
  input: AskRequest,
  callbacks: AskStreamCallbacks = {},
  dependencies: AskServiceDependencies = {},
) {
  const request = askRequestSchema.parse(input);
  const image = parseImageDataUrl(request.image);
  const normalizedMessage = request.message || (image ? defaultAskImagePrompt : "");

  const clarificationCard = resolveClarificationCard(request);
  if (clarificationCard) {
    return streamText({
      model: getAskModel(),
      prompt: JSON.stringify(clarificationCard),
    });
  }

  const messages: ModelMessage[] = [
    createSystemMessage(expandPromptTemplate(verifyTradingSystemPrompt)),
    createSystemMessage(askResponseGuide),
    ...(image ? [createSystemMessage(askImageResponseGuide)] : []),
    ...request.history.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    image
      ? {
          role: "user",
          content: [
            { type: "file" as const, data: image.base64, mediaType: image.mediaType },
            { type: "text" as const, text: normalizedMessage },
          ],
        }
      : { role: "user", content: normalizedMessage },
  ];

  return streamText({
    model: getAskModel(),
    temperature: 0.2,
    maxOutputTokens: ASK_MODEL_MAX_OUTPUT_TOKENS,
    maxRetries: ASK_MODEL_MAX_RETRIES,
    stopWhen: stepCountIs(ASK_MAX_TOOL_STEPS),
    messages,
    tools: createAskTools(dependencies),
    onStepFinish({ toolCalls, text }) {
      toolCalls?.forEach((tc) => {
        callbacks.onToolCall?.(tc.toolName, tc.input as Record<string, unknown>);
      });
      if (text) {
        callbacks.onTextDelta?.(text);
      }
    },
  });
}
