import type { AskCard, AskRequest } from "@/lib/ask/contracts";
import { inferMarketAssetsFromText } from "@/lib/ask/market";
import { deriveAskSessionMemory } from "@/lib/ask/session-memory";

export type AskModelClass = "simple" | "primary";
export type AskToolPolicy = "none" | "calculator" | "verification" | "full";

export type AskModelRoutingReason =
  | "image_analysis"
  | "empty_prompt"
  | "active_trading_context"
  | "live_or_news_context"
  | "calculator_intent"
  | "broker_verification_intent"
  | "straightforward_education"
  | "market_action_intent"
  | "market_analysis_intent"
  | "market_session_context"
  | "ambiguous_market_context"
  | "complex_request_shape"
  | "short_straightforward_prompt"
  | "default_primary";

export type AskModelRoutingDecision = {
  modelClass: AskModelClass;
  reason: AskModelRoutingReason;
  toolPolicy: AskToolPolicy;
  maxToolSteps: number;
};

type AskModelRoutingOptions = {
  hasTradingContext?: boolean;
};

type SelectAskModelRoutingInput = {
  message: string;
  hasImage?: boolean;
} & AskModelRoutingOptions;

const TIME_SENSITIVE_PATTERN = /\b(today|now|live|current|latest|news|headline)\b/;
const LIVE_MARKET_STATUS_PATTERN =
  /\b(status|update|quote|price|what(?:'s| is) happening|what(?:'s| is) moving|what(?:'s| is) doing|doing|moving|trending)\b/;
const MACRO_EVENT_PATTERN =
  /\b(calendar|cpi|nfp|payrolls?|jobs report|fed|fomc|central bank|rate decision)\b/;
const MACRO_MARKET_CONTEXT_PATTERN = /\b(inflation|rates?)\b/;
const MARKET_CONTEXT_PATTERN =
  /\b(market|price|chart|asset|forex|crypto|stock|index|rates?|calendar|event|headline|news)\b/;
const CALCULATOR_DOMAIN_PATTERN =
  /\b(lot size|position size|pip value|margin|required margin|risk[- ]?reward|r:r|p\/l|projection|compound(?:ing)?|growth plan)\b/;
const EDUCATIONAL_OPENING_PATTERN =
  /^(?:what(?:'s| is| are)|how(?: does| do| to)|why(?: does| do| is)|explain|define|meaning of|what does .+ mean)\b/;
const MARKET_ACTION_PATTERN =
  /\b(buy|sell|long|short|entry|exit|stop|target|setup|trade|position|signal)\b/;
const MARKET_ANALYSIS_PATTERN =
  /\b(bullish|bearish|bias|direction|support|resistance|breakout|pullback|reversal|continuation|rally|dump|overvalued|undervalued)\b/;
const MARKET_SESSION_CONTEXT_PATTERN =
  /\b(levels?|key levels?|session|open|close|london|new york|ny open|asian|asia|premarket|pre-market)\b/;
const AMBIGUOUS_TRADING_TERM_PATTERN =
  /\b(bias|levels?|support|resistance|setup|entry|entries|stop|target|long|short|breakout|pullback|reversal)\b/;
const NAMED_SESSION_PATTERN =
  /\b(london|new york|ny open|asian|asia|premarket|pre-market)\b/;
const GENERIC_MARKET_TERM_PATTERN = /\b(market|chart|forex|crypto|stock|index)\b/;
const ANALYTICAL_STRUCTURE_PATTERN =
  /\b(analy[sz]e|review|critique|compare|versus|vs|strategy|portfolio|backtest|scenario|thesis|correlation|hedge|macro|fundamental|multi[- ]?timeframe)\b/;
const BROKER_VERIFICATION_PATTERN =
  /\b(broker|prop firm|funded account|regulated|fca|scam|safe to deposit|legit|legitimate|trustworthy)\b/;

const DEFAULT_SIMPLE_MAX_TOOL_STEPS = 3;
const DEFAULT_PRIMARY_MAX_TOOL_STEPS = 7;

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function countWords(value: string) {
  const normalized = normalizeWhitespace(value);
  return normalized ? normalized.split(" ").length : 0;
}

function extractDirectForexPair(message: string) {
  return /\b(?:aud|cad|chf|eur|gbp|jpy|nzd|usd)\/?(?:aud|cad|chf|eur|gbp|jpy|nzd|usd)\b/i.test(
    message,
  );
}

export function hasActiveTradingContext(request: AskRequest) {
  const memory = deriveAskSessionMemory(request.history, request.sessionMemory ?? null);
  return Boolean(
    memory?.activeAsset ||
      memory?.activeSide ||
      memory?.lastSetup ||
      memory?.lastCardType === "setup" ||
      memory?.lastCardType === "chart",
  );
}

function hasMultipleQuestions(normalized: string) {
  return (normalized.match(/\?/g) ?? []).length > 1;
}

function hasMarketActionIntent(message: string) {
  const normalized = normalizeWhitespace(message).toLowerCase();
  if (!MARKET_ACTION_PATTERN.test(normalized)) {
    return false;
  }

  if (/\b(buy|sell|long|short)\b/.test(normalized)) {
    return true;
  }

  return (
    inferMarketAssetsFromText(message).length > 0 ||
    extractDirectForexPair(message) ||
    /\b(chart|market|trade|position|setup|signal)\b/.test(normalized)
  );
}

function hasMarketReference(message: string) {
  const normalized = normalizeWhitespace(message).toLowerCase();
  return (
    MARKET_CONTEXT_PATTERN.test(normalized) ||
    inferMarketAssetsFromText(message).length > 0 ||
    extractDirectForexPair(message)
  );
}

function hasTimeSensitiveMarketIntent(message: string) {
  const normalized = normalizeWhitespace(message).toLowerCase();
  if (MACRO_EVENT_PATTERN.test(normalized)) {
    return true;
  }

  if (MACRO_MARKET_CONTEXT_PATTERN.test(normalized) && hasMarketReference(message)) {
    return true;
  }

  return (
    (TIME_SENSITIVE_PATTERN.test(normalized) || LIVE_MARKET_STATUS_PATTERN.test(normalized)) &&
    hasMarketReference(message)
  );
}

function hasMarketAnalysisIntent(message: string) {
  const normalized = normalizeWhitespace(message).toLowerCase();
  return MARKET_ANALYSIS_PATTERN.test(normalized) && hasMarketReference(message);
}

function hasMarketSessionContext(message: string) {
  const normalized = normalizeWhitespace(message).toLowerCase();
  return MARKET_SESSION_CONTEXT_PATTERN.test(normalized) && hasMarketReference(message);
}

function hasAmbiguousMarketContext(message: string) {
  const normalized = normalizeWhitespace(message).toLowerCase();
  if (countWords(normalized) > 8 || hasMultipleQuestions(normalized)) {
    return false;
  }

  return (
    inferMarketAssetsFromText(message).length > 0 ||
    extractDirectForexPair(message) ||
    AMBIGUOUS_TRADING_TERM_PATTERN.test(normalized) ||
    NAMED_SESSION_PATTERN.test(normalized) ||
    GENERIC_MARKET_TERM_PATTERN.test(normalized)
  );
}

function hasBrokerVerificationIntent(normalized: string) {
  return BROKER_VERIFICATION_PATTERN.test(normalized);
}

function isStraightforwardEducationalQuestion(normalized: string) {
  return EDUCATIONAL_OPENING_PATTERN.test(normalized) && countWords(normalized) <= 24;
}

function hasComplexRequestShape(normalized: string) {
  return (
    countWords(normalized) > 34 ||
    hasMultipleQuestions(normalized) ||
    ANALYTICAL_STRUCTURE_PATTERN.test(normalized)
  );
}

function simpleDecision(
  reason: AskModelRoutingReason,
  toolPolicy: AskToolPolicy,
): AskModelRoutingDecision {
  return {
    modelClass: "simple",
    reason,
    toolPolicy,
    maxToolSteps: DEFAULT_SIMPLE_MAX_TOOL_STEPS,
  };
}

function primaryDecision(reason: AskModelRoutingReason): AskModelRoutingDecision {
  return {
    modelClass: "primary",
    reason,
    toolPolicy: "full",
    maxToolSteps: DEFAULT_PRIMARY_MAX_TOOL_STEPS,
  };
}

export function selectAskModelRoutingDecision({
  message,
  hasImage = false,
  hasTradingContext = false,
}: SelectAskModelRoutingInput): AskModelRoutingDecision {
  if (hasImage) {
    return primaryDecision("image_analysis");
  }

  const normalized = normalizeWhitespace(message).toLowerCase();
  if (!normalized) {
    return primaryDecision("empty_prompt");
  }

  if (hasTradingContext) {
    return primaryDecision("active_trading_context");
  }

  if (hasTimeSensitiveMarketIntent(message)) {
    return primaryDecision("live_or_news_context");
  }

  if (CALCULATOR_DOMAIN_PATTERN.test(normalized)) {
    return simpleDecision("calculator_intent", "calculator");
  }

  if (hasBrokerVerificationIntent(normalized)) {
    return simpleDecision("broker_verification_intent", "verification");
  }

  if (hasMarketAnalysisIntent(message)) {
    return primaryDecision("market_analysis_intent");
  }

  if (hasMarketSessionContext(message)) {
    return primaryDecision("market_session_context");
  }

  if (isStraightforwardEducationalQuestion(normalized)) {
    return simpleDecision("straightforward_education", "none");
  }

  if (hasAmbiguousMarketContext(message)) {
    return primaryDecision("ambiguous_market_context");
  }

  if (hasMarketActionIntent(message)) {
    return primaryDecision("market_action_intent");
  }

  if (hasComplexRequestShape(normalized)) {
    return primaryDecision("complex_request_shape");
  }

  if (countWords(normalized) <= 18) {
    return simpleDecision("short_straightforward_prompt", "none");
  }

  return primaryDecision("default_primary");
}

export function selectAskModelRoutingForRequest(
  request: AskRequest,
  message: string,
  hasImage = false,
) {
  return selectAskModelRoutingDecision({
    message,
    hasImage,
    hasTradingContext: hasActiveTradingContext(request),
  });
}

export function shouldUseSimpleAskModel(
  message: string,
  hasImage = false,
  options: AskModelRoutingOptions = {},
) {
  return selectAskModelRoutingDecision({
    message,
    hasImage,
    ...options,
  }).modelClass === "simple";
}

export function shouldEscalateSimpleModelResult(
  card: AskCard,
  toolResults: ReadonlyArray<{ toolName?: string }>,
): string | null {
  if (card.type === "setup" || card.type === "chart") {
    return "trade_action_card";
  }

  if (card.type === "briefing") {
    return "live_market_card";
  }

  const usedLiveTool = toolResults.some((toolResult) =>
    ["get_market_briefing", "get_market_setup", "search_news", "get_economic_calendar"].includes(
      toolResult.toolName ?? "",
    ),
  );

  return usedLiveTool ? "disallowed_live_tool" : null;
}
