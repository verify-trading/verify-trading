import { APICallError, generateText, RetryError, stepCountIs } from "ai";

import {
  askCardSchema,
  askRequestSchema,
  askResponseSchema,
  fallbackInsightCard,
  sanitizeCard,
  sanitizeUiMeta,
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
export const ASK_MAX_TOOL_STEPS = 10;

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

function resolveClarificationCard(request: AskRequest) {
  if ((request.history?.length ?? 0) > 0) {
    return null;
  }

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

export async function generateAskResponse(
  input: AskRequest,
  dependencies: AskServiceDependencies = {},
): Promise<AskResponse> {
  const request = askRequestSchema.parse(input);
  const generateTextImpl = dependencies.generateTextImpl ?? generateText;

  const sessionId = request.sessionId ?? request.chatSessionId ?? crypto.randomUUID();
  const messageId = crypto.randomUUID();
  const image = parseImageDataUrl(request.image);
  const normalizedMessage = request.message || (image ? defaultAskImagePrompt : "");
  const completedToolResults: Array<{ toolName?: string; output?: unknown }> = [];

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

  const runGenerate = async (model: ReturnType<typeof getAskModel>) => {
    completedToolResults.length = 0;

    return generateTextImpl({
      model,
      temperature: 0.2,
      maxOutputTokens: 1_600,
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
      },
      messages: [
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
  const parsedText = extractJson(result.text);
  const parsedCard = parsedText ? askCardSchema.safeParse(parsedText) : null;
  const usedSearchNews = allToolResults.some((t) => t.toolName === "search_news");
  const submitCard = usedSearchNews
    ? extractSubmitAskCard(allToolResults, askCardSchema)
    : null;
  const toolCard = extractToolCard(allToolResults, askCardSchema);

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

  const card =
    submitCard ??
    (parsedCard?.success ? parsedCard.data : toolCard ?? fallbackInsightCard);

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
