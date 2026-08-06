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
function resolveOpenAIBaseURL() {
  const raw = process.env.OPENAI_BASE_URL?.trim();
  if (!raw) return undefined;
  const trimmed = raw.replace(/\/+$/, "");
  return /\/v\d+$/.test(trimmed) ? trimmed : `${trimmed}/v1`;
}

// Ask, the daily brief and the simple writers. The Claude route can't serve these: it does
// not implement the SERVER-side web_search/web_fetch tools, and silently strips them —
// HTTP 200 with an uncited answer invented from memory (measured 0 real searches vs 7/8).
export const codexProvider = createOpenAI({ baseURL: resolveOpenAIBaseURL() });

/** Primary model for Ask. Fastest of the gateway's models that reliably searches. */
export const DEFAULT_ASK_MODEL = "gpt-5.6-terra";

/** Cheaper tier for the non-conversational writers (journal insight, challenge status). */
export const DEFAULT_ASK_SIMPLE_MODEL = "gpt-5.4-mini";

// Separate KEY GROUP, not just a separate model: with OPENAI_API_KEY every claude model
// answers "Upstream service temporarily unavailable".
const coachProvider = createOpenAI({
  baseURL: resolveOpenAIBaseURL(),
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// The Mind coach only. Not ASK_SIMPLE_MODEL: that one also feeds the journal/challenge
// writers, which are not voice and should not follow the coach's tradeoffs.
export const DEFAULT_COACH_MODEL = "claude-sonnet-5";

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
  return askModel(getAskPrimaryModelId());
}

// Chat-completions unlike Ask: the gateway injects the whole Codex CLI system prompt
// (~4,400 tokens, never cached) into every Responses-API call, and these writers use no
// server tools. Measured injection-free here. Ask must stay on Responses for web_search.
export function getAskSimpleModel() {
  return wrapLanguageModel({
    model: codexProvider.chat(getAskSimpleModelId()),
    middleware: process.env.OPENAI_BASE_URL?.trim() ? [dropUnsupportedParams] : [],
  });
}

/**
 * `.chat()` is load-bearing: the SDK defaults to the Responses API, which serves no claude
 * model here (/v1/messages is blocked for our group too). Raw, with no askModel middleware —
 * `store`/`reasoningEffort` are OpenAI-isms, and stripping maxOutputTokens is pointless
 * because `max_tokens` is silently IGNORED on this route (asked 5, got 169).
 *
 * Prompt-hostile: the gateway injects a ~450-token block asserting a coding-assistant
 * identity "by platform policy", ranked above our system prompt and varying per call (so it
 * also defeats prefix caching). It won 8/8 on "who am I talking to?" until the persona
 * answered that itself — the identity rule in buildPsychologyCoachInstructions is the
 * counter and must stay.
 */
export function getPsychologyCoachModel() {
  // Fail loudly rather than let createOpenAI fall back to OPENAI_API_KEY, whose group
  // errors on every claude model — i.e. a coach that greets the trader and then dies.
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set; the Mind coach cannot reach the gateway's Claude route.");
  }
  return coachProvider.chat(getPsychologyCoachModelId());
}

// The Responses API caches long prompt prefixes on its own, so the static block just has to
// stay byte-stable — which is why volatile context is appended as separate messages upstream.
export function createSystemMessage(content: string) {
  return { role: "system" as const, content };
}
