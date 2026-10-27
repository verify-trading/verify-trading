import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import {
  defaultSettingsMiddleware,
  wrapLanguageModel,
  type LanguageModelMiddleware,
} from "ai";

// Everything below fronts one third-party gateway (OPENAI_BASE_URL). It is quirky and
// prompt-hostile in ways that are all measured, not guessed — the notes here are what stops
// each one being re-broken. Smoke: tests/manual/provider-tools-smoke.test.ts.

// The SDK appends "/responses", so the base URL must carry the version segment or every
// request 404s. Unset means the real OpenAI API, which fails loudly on a gateway key.
function resolveBaseURL(value = process.env.OPENAI_BASE_URL) {
  const raw = value?.trim();
  if (!raw) return undefined;
  const trimmed = raw.replace(/\/+$/, "");
  return /\/v\d+$/.test(trimmed) ? trimmed : `${trimmed}/v1`;
}

// Kept for explicit GPT overrides. Its gateway upstream is currently unavailable.
export const codexProvider = createOpenAI({ baseURL: resolveBaseURL() });

// Native Claude messages support our client tools and live web research. Pikachu omits
// native search traces; verify against fresh page facts, not just providerExecuted events.
const anthropicProvider = createAnthropic({
  baseURL: resolveBaseURL(process.env.ANTHROPIC_BASE_URL ?? process.env.OPENAI_BASE_URL),
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/** Temporary Claude default while the GPT gateway upstream is unavailable. */
export const DEFAULT_ASK_MODEL = "claude-sonnet-5-5";

const isClaude = (modelId: string) => modelId.startsWith("claude-");

/** Model for the non-conversational writers (journal insight, challenge status). */
export const DEFAULT_ASK_SIMPLE_MODEL = "claude-sonnet-5-5";

// Separate KEY GROUP, not just a separate model: with OPENAI_API_KEY every claude model
// answers "Upstream service temporarily unavailable".
const coachProvider = createOpenAI({
  baseURL: resolveBaseURL(process.env.ANTHROPIC_BASE_URL ?? process.env.OPENAI_BASE_URL),
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// The Mind coach only. Not ASK_SIMPLE_MODEL: that one also feeds the journal/challenge
// writers, which are not voice and should not follow the coach's tradeoffs. Same model as
// Ask; GPT overrides pin reasoning low because on a voice call the thinking is dead air.
export const DEFAULT_COACH_MODEL = "claude-sonnet-5-5";

export function getAskPrimaryModelId() {
  return process.env.ASK_MODEL ?? DEFAULT_ASK_MODEL;
}

export function getAskSimpleModelId() {
  return process.env.ASK_SIMPLE_MODEL ?? DEFAULT_ASK_SIMPLE_MODEL;
}

export function getPsychologyCoachModelId() {
  return process.env.ASK_COACH_MODEL ?? DEFAULT_COACH_MODEL;
}

// `store: false` on every call: the gateway does not store responses, so the Responses API's
// default `item_reference` pointers dangle and the SECOND step of any tool call dies with
// "Upstream request failed". First step always succeeds, which makes it look like a tool bug.
const gatewayDefaults = (openai: Record<string, string | boolean>) =>
  defaultSettingsMiddleware({
    settings: { providerOptions: { openai: { store: false, ...openai } } },
  });

/**
 * The gateway rejects `max_output_tokens` outright (measured 2500/8000/16000, all fail;
 * same request without it succeeds). Scoped to the gateway on purpose — each caller's
 * ceiling is a real guard, so a provider that honours the field must not keep losing them.
 *
 * ponytail: those ceilings are unenforceable while this gateway is in front; anything that
 * must be bounded bounds itself at the call site (see SPOKEN_CHAR_BUDGET in the coach route).
 */
const dropUnsupportedParams: LanguageModelMiddleware = {
  specificationVersion: "v3",
  transformParams: async ({ params }) => {
    const { maxOutputTokens: _unsupported, ...rest } = params;
    return rest;
  },
};

function askModel(modelId: string, openaiOptions: Record<string, string | boolean> = {}) {
  return wrapLanguageModel({
    model: codexProvider(modelId),
    middleware: [
      gatewayDefaults(openaiOptions),
      // A bare OPENAI_BASE_URL means the real OpenAI API, which takes the field.
      ...(process.env.OPENAI_BASE_URL?.trim() ? [dropUnsupportedParams] : []),
    ],
  });
}

export function getAskModel() {
  const modelId = getAskPrimaryModelId();
  return isClaude(modelId) ? anthropicProvider(modelId) : askModel(modelId);
}

/** Match the server-side web tool to the selected model's API. */
export function getAskWebSearchTool() {
  if (isClaude(getAskPrimaryModelId())) {
    return anthropicProvider.tools.webSearch_20250305({ maxUses: 5, userLocation: { type: "approximate", country: "GB" } });
  }
  return codexProvider.tools.webSearch({ searchContextSize: "medium", userLocation: { type: "approximate", country: "GB" } });
}

// GPT overrides use chat completions for writers that need no server-side tools.
export function getAskSimpleModel() {
  const modelId = getAskSimpleModelId();
  if (isClaude(modelId)) return anthropicProvider(modelId);
  return wrapLanguageModel({
    model: codexProvider.chat(modelId),
    middleware: process.env.OPENAI_BASE_URL?.trim() ? [dropUnsupportedParams] : [],
  });
}

/**
 * A `claude-` id takes the gateway's Claude route, where `.chat()` is load-bearing: the SDK
 * defaults to the Responses API, which serves no claude model there. That path is raw,
 * no askModel middleware — `store`/`reasoningEffort` are
 * OpenAI-isms, and stripping maxOutputTokens is pointless because `max_tokens` is silently
 * IGNORED there (asked 5, got 169). The gpt models take the codex (Responses) route like Ask.
 *
 * Prompt-hostile either way: the gateway injects a competing coding-assistant identity block
 * ranked above our system prompt. It won 8/8 on "who am I talking to?" until the persona
 * answered that itself — the identity rule in buildPsychologyCoachInstructions is the
 * counter and must stay.
 */
export function getPsychologyCoachModel() {
  const modelId = getPsychologyCoachModelId();
  if (!isClaude(modelId)) {
    // Reasoning tokens are dead air on a voice call: "low" roughly halves time to first
    // token, and the coach's replies are short and empathetic rather than analytical, so
    // little is lost. NOT "minimal": on this gateway that returns an EMPTY text stream —
    // the call succeeds, streams no chunks, and the trader hears silence.
    return askModel(modelId, { reasoningEffort: "low" });
  }
  // Fail loudly rather than let createOpenAI fall back to OPENAI_API_KEY, whose group
  // errors on every claude model — i.e. a coach that greets the trader and then dies.
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set; the Mind coach cannot reach the gateway's Claude route.");
  }
  return coachProvider.chat(modelId);
}

// The Responses API caches long prompt prefixes on its own, so the static block just has to
// stay byte-stable — which is why volatile context is appended as separate messages upstream.
export function createSystemMessage(content: string) {
  return { role: "system" as const, content };
}
