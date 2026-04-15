import { APICallError, Output, generateText, RetryError, stepCountIs, streamText, type ModelMessage } from "ai";
import { z } from "zod";

import {
  buildAnalysisRulesPrompt,
  getActiveAnalysisRules,
} from "@/lib/ask/analysis-rules";
import {
  calculatePipValue,
  calculateRiskReward,
  normalizeForexPair,
} from "@/lib/ask/calculators";
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
  extractMarketBriefingCard,
  extractSubmitAskCard,
  extractToolCard,
  extractUiMeta,
  parseImageDataUrl,
} from "@/lib/ask/service/context";
import { buildSessionMemoryMessage, deriveAskSessionMemory } from "@/lib/ask/session-memory";
import {
  getMarketQuote,
  getMarketSeries,
  inferMarketAssetsFromText,
} from "@/lib/ask/market";
import { lookupVerifiedEntity } from "@/lib/ask/entities";
import {
  createSystemMessage,
  getAskFallbackModel,
  getAskFallbackModelId,
  getAskModel,
  getAskPrimaryModelId,
} from "@/lib/ask/service/provider";
import {
  buildBriefingCard,
  buildPipValueCard,
  buildRiskRewardCard,
  createAskTools,
  resolveVerificationCard,
} from "@/lib/ask/service/tools";
import type { AskServiceDependencies } from "@/lib/ask/service/types";

const ASK_MODEL_MAX_RETRIES = 2;

/** Model + tool turns plus one final structured-output step. */
export const ASK_MAX_TOOL_STEPS = 7;

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

function buildToolResultSignature(toolResult: { toolName?: string; output?: unknown }) {
  return `${toolResult.toolName ?? "unknown"}:${JSON.stringify(toolResult.output)}`;
}

function mergeToolResults(
  completedToolResults: Array<{ toolName?: string; output?: unknown }>,
  finalToolResults: Array<{ toolName?: string; output?: unknown }>,
) {
  const merged = [...completedToolResults];
  const seen = new Set(completedToolResults.map(buildToolResultSignature));

  for (const toolResult of finalToolResults) {
    const signature = buildToolResultSignature(toolResult);
    if (seen.has(signature)) {
      continue;
    }
    seen.add(signature);
    merged.push(toolResult);
  }

  return merged;
}

function stopAfterSubmitAskCardResult({
  steps,
}: {
  steps: Array<{
    toolResults?: Array<{ toolName?: string }>;
  }>;
}) {
  const lastStep = steps[steps.length - 1];
  return (
    lastStep?.toolResults?.some((toolResult) => toolResult.toolName === "submit_ask_card") ??
    false
  );
}

function buildInsightCard(headline: string, body: string, verdict: string) {
  return {
    type: "insight" as const,
    headline,
    body,
    verdict,
  };
}

const askCardOutputEnvelopeSchema = z.object({
  card_json: z
    .string()
    .describe("A single JSON object string for the final response card. It must match the ask card schema exactly."),
});

const askCardOutput = Output.object({
  name: "AskCardEnvelope",
  description: "Envelope that contains the final response card as a JSON string.",
  schema: askCardOutputEnvelopeSchema,
});

type CompletedCard = {
  card: AskCard;
  source: string;
  uiMeta?: AskResponse["uiMeta"];
};

function buildCompletedAskResponse({
  card,
  source,
  sessionId,
  messageId,
  uiMeta,
  toolResults = [],
}: CompletedCard & {
  sessionId: string;
  messageId: string;
  toolResults?: Array<{ toolName?: string; output?: unknown }>;
}) {
  logger.info("Ask generation completed.", {
    sessionId,
    messageId,
    finalCardType: card.type,
    cardSource: source,
    toolResults: summarizeToolResults(toolResults),
  });

  return askResponseSchema.parse({
    data: sanitizeCard(card),
    ...(uiMeta ? { uiMeta: sanitizeUiMeta(uiMeta) } : {}),
    sessionId,
    messageId,
  });
}

function extractRecoveredToolCard(toolResults: Array<{ toolName?: string; output?: unknown }>) {
  const submitCard = extractSubmitAskCard(toolResults, askCardSchema);
  const fmpBriefing = extractMarketBriefingCard(toolResults, askCardSchema);
  if (submitCard?.type === "briefing" && fmpBriefing) {
    return {
      card: fmpBriefing,
      source: "tool_result" as const,
    };
  }

  if (submitCard) {
    return {
      card: submitCard,
      source: "submit_ask_card" as const,
    };
  }

  const toolCard = extractToolCard(toolResults, askCardSchema);
  if (toolCard) {
    return {
      card: toolCard,
      source: "tool_result" as const,
    };
  }

  return null;
}

function extractOutputCard(result: { output?: unknown }) {
  try {
    const parsedEnvelope = askCardOutputEnvelopeSchema.safeParse(result.output);
    if (!parsedEnvelope.success) {
      return null;
    }

    const parsedCard = JSON.parse(parsedEnvelope.data.card_json);
    const validatedCard = askCardSchema.safeParse(parsedCard);
    return validatedCard.success ? validatedCard.data : null;
  } catch {
    return null;
  }
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

/** Scan the full user message for the first currency symbol as a fallback. */
function inferCurrencySymbolFromText(message: string): "$" | "£" | "€" | undefined {
  const match = message.match(/[$£€]/);
  return match ? (match[0] as "$" | "£" | "€") : undefined;
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
  const currencySymbol =
    (startMatch ? extractCurrencySymbol(startMatch[1]) : undefined) ??
    inferCurrencySymbolFromText(message);

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

function extractDirectBriefingTimeframe(message: string): "1D" | "1W" | "1M" | "3M" | "1Y" {
  const normalized = message.toLowerCase();

  if (/\b1d\b|\btoday\b|\bintraday\b|\bdaily\b/.test(normalized)) {
    return "1D";
  }
  if (/\b1m\b|\bmonth\b|\bmonthly\b/.test(normalized)) {
    return "1M";
  }
  if (/\b3m\b|\b3 month\b|\bthree month\b/.test(normalized)) {
    return "3M";
  }
  if (/\b1y\b|\byear\b|\byearly\b|\bannual\b/.test(normalized)) {
    return "1Y";
  }

  return "1W";
}

function extractDirectForexPair(message: string) {
  const match = message.match(/\b([a-z]{3})\/([a-z]{3})\b/i);
  if (!match) {
    return null;
  }

  return normalizeForexPair(`${match[1]}/${match[2]}`).pair;
}

function parseDirectPipValueShortcut(message: string) {
  const normalized = normalizeWhitespace(message).toLowerCase();
  if (!/\bpip value\b/.test(normalized)) {
    return null;
  }

  const pair = extractDirectForexPair(message);
  const lotSizeMatch = normalized.match(/(\d+(?:\.\d+)?)\s*lot\b/);
  const lotSize = lotSizeMatch ? Number.parseFloat(lotSizeMatch[1]) : Number.NaN;

  if (!pair || !Number.isFinite(lotSize) || lotSize <= 0) {
    return null;
  }

  return { pair, lotSize };
}

function parseDirectRiskRewardShortcut(
  message: string,
):
  | {
      riskPips: number;
      rewardPips: number;
    }
  | {
      direction: "long" | "short";
      entryPrice: number;
      stopPrice: number;
      targetPrice: number;
    }
  | null {
  const normalized = normalizeWhitespace(message).toLowerCase();
  if (!/\b(rr|r:r|risk reward|risk-reward)\b/.test(normalized)) {
    return null;
  }

  const riskPipsMatch =
    normalized.match(/\brisk(?:ing)?\s*(\d+(?:\.\d+)?)\s*pips?\b/) ??
    normalized.match(/\b(\d+(?:\.\d+)?)\s*pips?\s*(?:risk|stop)\b/);
  const rewardPipsMatch =
    normalized.match(/\breward\s*(\d+(?:\.\d+)?)\s*pips?\b/) ??
    normalized.match(/\b(\d+(?:\.\d+)?)\s*pips?\s*(?:reward|target)\b/);

  if (riskPipsMatch && rewardPipsMatch) {
    const riskPips = Number.parseFloat(riskPipsMatch[1]);
    const rewardPips = Number.parseFloat(rewardPipsMatch[1]);
    if (Number.isFinite(riskPips) && riskPips > 0 && Number.isFinite(rewardPips) && rewardPips > 0) {
      return { riskPips, rewardPips };
    }
  }

  const direction: "long" | "short" | undefined = /\b(sell|short)\b/.test(normalized)
    ? "short"
    : /\b(buy|long)\b/.test(normalized)
      ? "long"
      : undefined;
  const entryMatch =
    normalized.match(/\bentry\b[^\d]*?(\d+(?:\.\d+)?)/) ??
    normalized.match(/\bat\b[^\d]*?(\d+(?:\.\d+)?)/);
  const stopMatch = normalized.match(/\b(?:stop|sl)\b[^\d]*?(\d+(?:\.\d+)?)/);
  const targetMatch = normalized.match(/\b(?:target|tp)\b[^\d]*?(\d+(?:\.\d+)?)/);

  if (!direction || !entryMatch || !stopMatch || !targetMatch) {
    return null;
  }

  const entryPrice = Number.parseFloat(entryMatch[1]);
  const stopPrice = Number.parseFloat(stopMatch[1]);
  const targetPrice = Number.parseFloat(targetMatch[1]);

  if (![entryPrice, stopPrice, targetPrice].every((value) => Number.isFinite(value) && value > 0)) {
    return null;
  }

  return {
    direction,
    entryPrice,
    stopPrice,
    targetPrice,
  };
}

function shouldUseDirectVerificationShortcut(message: string) {
  const normalized = normalizeWhitespace(message).toLowerCase();
  if (!normalized) {
    return false;
  }

  if (
    /\b(vs|versus|compare|price|status on|what is|entry|stop|target|setup|buy|sell|rr|risk reward|pip value|projection|plan)\b/.test(
      normalized,
    )
  ) {
    return false;
  }

  return /\b(safe|legit|legitimate|regulated|fca|scam|safe to deposit|uk retail|trustworthy)\b/.test(
    normalized,
  );
}

function shouldUseDirectMarketBriefingShortcut(message: string) {
  const normalized = normalizeWhitespace(message).toLowerCase();
  if (!normalized) {
    return false;
  }

  const mentionsNewsOrMacro =
    /\b(cpi|nfp|fed|fomc|ecb|boj|boe|inflation|payrolls|jobs|rate decision|headline|news|trump|iran|war|ceasefire|geopolitics|earnings|after earnings|why did|what happened)\b/.test(
      normalized,
    );
  if (mentionsNewsOrMacro) {
    return false;
  }

  const asksForSetupOrOpinion =
    /\b(buy|sell|long|short|entry|stop|target|setup|trade plan|should i|best trade|cleanest setup|recommend|why not|vs|versus|compare|after earnings|earnings play|overvalued|hold)\b/.test(
      normalized,
    );
  if (asksForSetupOrOpinion) {
    return false;
  }

  return (
    /\bstatus on\b/.test(normalized) ||
    /\bprice now\b/.test(normalized) ||
    /\bcurrent price\b/.test(normalized) ||
    /\bwhere is\b.+\btrading now\b/.test(normalized)
  );
}

function buildAskMessages({
  history,
  normalizedMessage,
  image,
  analysisRulesMessage,
  sessionMemoryMessage,
}: {
  history: AskRequest["history"];
  normalizedMessage: string;
  image: ReturnType<typeof parseImageDataUrl>;
  analysisRulesMessage: string | null;
  sessionMemoryMessage?: string | null;
}): ModelMessage[] {
  const userMessage: ModelMessage = image
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
      };

  return [
    createSystemMessage(expandPromptTemplate(verifyTradingSystemPrompt)),
    createSystemMessage(askResponseGuide),
    ...(sessionMemoryMessage ? [createSystemMessage(sessionMemoryMessage)] : []),
    ...(image ? [createSystemMessage(askImageResponseGuide)] : []),
    ...(analysisRulesMessage ? [createSystemMessage(analysisRulesMessage)] : []),
    ...(history ?? []).map((message) => ({
      role: message.role,
      content: message.content,
    })),
    userMessage,
  ];
}

async function buildAskModelMessages(input: {
  request: AskRequest;
  image: ReturnType<typeof parseImageDataUrl>;
  normalizedMessage: string;
  getActiveAnalysisRulesImpl: typeof getActiveAnalysisRules;
}) {
  const { request, image, normalizedMessage, getActiveAnalysisRulesImpl } = input;
  const analysisRulesMessage = image
    ? buildAnalysisRulesPrompt(await getActiveAnalysisRulesImpl())
    : null;
  const sessionMemoryMessage = buildSessionMemoryMessage(
    deriveAskSessionMemory(request.history, request.sessionMemory ?? null),
  );

  return buildAskMessages({
    history: request.history,
    normalizedMessage,
    image,
    analysisRulesMessage,
    sessionMemoryMessage,
  });
}

async function resolveDirectShortcut({
  request,
  normalizedMessage,
  image,
  dependencies,
}: {
  request: AskRequest;
  normalizedMessage: string;
  image: ReturnType<typeof parseImageDataUrl>;
  dependencies: AskServiceDependencies;
}): Promise<CompletedCard | null> {
  const clarificationCard = resolveClarificationCard(request);
  if (clarificationCard) {
    return {
      card: clarificationCard,
      source: "clarification",
    };
  }

  const acknowledgementCard = resolveAcknowledgementCard(request);
  if (acknowledgementCard) {
    return {
      card: acknowledgementCard,
      source: "acknowledgement",
    };
  }

  const growthPlanShortcutCard = extractGrowthPlanShortcutCard(normalizedMessage);
  if (growthPlanShortcutCard) {
    return {
      card: growthPlanShortcutCard,
      source: "growth_plan_shortcut",
    };
  }

  const projectionShortcutCard = extractProjectionShortcutCard(normalizedMessage);
  if (projectionShortcutCard) {
    return {
      card: projectionShortcutCard,
      source: "projection_shortcut",
      uiMeta: extractUiMeta(projectionShortcutCard, []),
    };
  }

  if (image) {
    return null;
  }

  const lookupVerifiedEntityImpl =
    dependencies.lookupVerifiedEntityImpl ?? lookupVerifiedEntity;
  if (shouldUseDirectVerificationShortcut(normalizedMessage)) {
    const lookup = await lookupVerifiedEntityImpl(normalizedMessage);
    const hasUrl = /https?:\/\/|www\./i.test(normalizedMessage);

    if (lookup.found || hasUrl) {
      const verificationQuery = lookup.entity?.name ?? normalizedMessage;
      const { card, uiMeta } = await resolveVerificationCard(verificationQuery, dependencies);

      return {
        card,
        source: "direct_verification_shortcut",
        uiMeta,
      };
    }
  }

  const directPipValueInput = parseDirectPipValueShortcut(normalizedMessage);
  if (directPipValueInput) {
    return {
      card: buildPipValueCard(calculatePipValue(directPipValueInput)),
      source: "direct_pip_value_shortcut",
    };
  }

  const directRiskRewardInput = parseDirectRiskRewardShortcut(normalizedMessage);
  if (directRiskRewardInput) {
    return {
      card: buildRiskRewardCard(calculateRiskReward(directRiskRewardInput)),
      source: "direct_risk_reward_shortcut",
    };
  }

  if (!shouldUseDirectMarketBriefingShortcut(normalizedMessage)) {
    return null;
  }

  const getMarketQuoteImpl = dependencies.getMarketQuoteImpl ?? getMarketQuote;
  const getMarketSeriesImpl = dependencies.getMarketSeriesImpl ?? getMarketSeries;
  const inferredAssets = inferMarketAssetsFromText(normalizedMessage);
  const inferredAsset =
    inferredAssets.length === 1 ? inferredAssets[0] : extractDirectForexPair(normalizedMessage);

  if (!inferredAsset) {
    return null;
  }

  const timeframe = extractDirectBriefingTimeframe(normalizedMessage);
  const { card, uiMeta } = buildBriefingCard(
    await getMarketQuoteImpl(inferredAsset),
    await getMarketSeriesImpl(inferredAsset, timeframe),
  );

  return {
    card,
    source: "direct_market_briefing_shortcut",
    uiMeta,
  };
}

export async function generateAskResponse(
  input: AskRequest,
  dependencies: AskServiceDependencies = {},
  callbacks: AskGenerationCallbacks = {},
): Promise<AskResponse> {
  const request = askRequestSchema.parse(input);
  const generateTextImpl = dependencies.generateTextImpl ?? generateText;
  const getActiveAnalysisRulesImpl =
    dependencies.getActiveAnalysisRulesImpl ?? getActiveAnalysisRules;

  const sessionId = request.sessionId ?? request.chatSessionId ?? crypto.randomUUID();
  const messageId = crypto.randomUUID();
  const image = parseImageDataUrl(request.image);
  const normalizedMessage = request.message || (image ? defaultAskImagePrompt : "");
  const messages = await buildAskModelMessages({
    request,
    image,
    normalizedMessage,
    getActiveAnalysisRulesImpl,
  });
  const completedToolResults: Array<{ toolName?: string; output?: unknown }> = [];

  logger.info("Ask generation started.", {
    sessionId,
    messageId,
    hasImage: Boolean(image),
    historyCount: request.history.length,
    promptPreview: normalizedMessage.slice(0, 160),
  });

  const directShortcut = await resolveDirectShortcut({
    request,
    normalizedMessage,
    image,
    dependencies,
  });
  if (directShortcut) {
    return buildCompletedAskResponse({
      ...directShortcut,
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
      output: askCardOutput,
      stopWhen: [stepCountIs(ASK_MAX_TOOL_STEPS)],
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
      messages,
      tools: createAskTools(dependencies),
    });
  };

  let result;

  try {
    result = await runGenerate(getAskModel());
  } catch (error) {
    const recoveredToolCard = extractRecoveredToolCard(completedToolResults);

    if (recoveredToolCard) {
      logger.warn("Ask primary model failed after yielding a valid tool card; returning tool result without fallback rerun.", {
        sessionId,
        messageId,
        primaryModel: getAskPrimaryModelId(),
        error: error instanceof Error ? error.message : String(error),
        recoveredCardSource: recoveredToolCard.source,
        recoveredCardType: recoveredToolCard.card.type,
      });

      return buildCompletedAskResponse({
        card: recoveredToolCard.card,
        source: recoveredToolCard.source,
        uiMeta: extractUiMeta(recoveredToolCard.card, completedToolResults),
        sessionId,
        messageId,
      });
    }

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

  const allToolResults = mergeToolResults(
    completedToolResults,
    result.toolResults as Array<{ toolName?: string; output?: unknown }>,
  );

  logger.info("Tool results received.", {
    sessionId,
    count: allToolResults.length,
    tools: allToolResults.map((t) => t.toolName),
    outputs: allToolResults.map((t) => JSON.stringify(t.output).slice(0, 200)),
  });

  const outputCard = extractOutputCard(result as { output?: unknown });
  const parsedText = outputCard ? null : extractJson(result.text);
  const parsedCard = parsedText ? askCardSchema.safeParse(parsedText) : null;
  const submitCard = extractSubmitAskCard(allToolResults, askCardSchema);
  const toolCard = extractToolCard(allToolResults, askCardSchema);
  const fmpBriefing = extractMarketBriefingCard(allToolResults, askCardSchema);
  const modelPreferredCard =
    submitCard ?? outputCard ?? (parsedCard?.success ? parsedCard.data : null);
  const preferFmpBriefingOverModel =
    modelPreferredCard?.type === "briefing" && fmpBriefing !== null;

  logger.info("Card extraction results.", {
    sessionId,
    hasSubmitCard: !!submitCard,
    hasOutputCard: !!outputCard,
    hasToolCard: !!toolCard,
    toolCardType: toolCard?.type ?? null,
    hasParsedCard: !!parsedCard?.success,
    parsedCardType: parsedCard?.success ? parsedCard.data?.type : null,
    outputCardType: outputCard?.type ?? null,
    preferFmpBriefingOverModel,
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
    (preferFmpBriefingOverModel ? fmpBriefing : null) ??
    modelPreferredCard ??
    toolCard ??
    wrappedTextCard ??
    fallbackInsightCard;

  logger.info("Ask generation completed.", {
    sessionId,
    messageId,
    finalCardType: card.type,
    cardSource: preferFmpBriefingOverModel
      ? "tool_result"
      : submitCard
        ? "submit_ask_card"
        : outputCard
          ? "model_output"
        : parsedCard?.success
          ? "model_text_fallback"
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
  return streamAskResponseInternal(input, callbacks, dependencies);
}

async function streamAskResponseInternal(
  input: AskRequest,
  callbacks: AskStreamCallbacks = {},
  dependencies: AskServiceDependencies = {},
) {
  const request = askRequestSchema.parse(input);
  const image = parseImageDataUrl(request.image);
  const normalizedMessage = request.message || (image ? defaultAskImagePrompt : "");
  const getActiveAnalysisRulesImpl =
    dependencies.getActiveAnalysisRulesImpl ?? getActiveAnalysisRules;
  const streamTextImpl = dependencies.streamTextImpl ?? streamText;

  const clarificationCard = resolveClarificationCard(request);
  if (clarificationCard) {
    return streamTextImpl({
      model: getAskModel(),
      prompt: JSON.stringify(clarificationCard),
    });
  }

  const messages = await buildAskModelMessages({
    request,
    image,
    normalizedMessage,
    getActiveAnalysisRulesImpl,
  });

  return streamTextImpl({
    model: getAskModel(),
    temperature: 0.2,
    maxOutputTokens: ASK_MODEL_MAX_OUTPUT_TOKENS,
    maxRetries: ASK_MODEL_MAX_RETRIES,
    stopWhen: [stepCountIs(ASK_MAX_TOOL_STEPS), stopAfterSubmitAskCardResult],
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
