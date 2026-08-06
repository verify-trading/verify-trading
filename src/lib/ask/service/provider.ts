import { createOpenAI } from "@ai-sdk/openai";
import {
  defaultSettingsMiddleware,
  wrapLanguageModel,
  type LanguageModelMiddleware,
} from "ai";

/**
 * The AI SDK appends "/responses" to the base URL, so the base URL MUST include
 * the version segment. A bare `OPENAI_BASE_URL=https://pikachu.hueling.cc`
 * (no `/v1`) silently turns every request into a 404 — normalize it here so a
 * misconfigured env can't take Ask down. When unset we let the SDK use its own
 * default (the real OpenAI API), which fails loudly on a gateway key rather
 * than silently answering from the wrong place.
 */
function resolveOpenAIBaseURL() {
  const raw = process.env.OPENAI_BASE_URL?.trim();
  if (!raw) return undefined;
  const trimmed = raw.replace(/\/+$/, "");
  return /\/v\d+$/.test(trimmed) ? trimmed : `${trimmed}/v1`;
}

/**
 * The ONE configured instance. Every model-shaped call site — Ask, the live
 * coach, the daily market brief, the web search tool — must go through this so
 * the base URL (and the /v1 normalization above) can never drift between call
 * sites.
 *
 * Why the Codex side of the gateway rather than the Claude side: web_search and
 * web_fetch are SERVER-side tools — the provider runs them, not us. The
 * gateway's Claude route does not implement them, so it strips the declaration
 * and returns HTTP 200 with an uncited answer invented from memory (measured:
 * 0 real searches). Its Codex route runs them for real (measured: 7/8, 4-12s),
 * and serves reasoning + server search + strict client-side function calls in a
 * single response, which is exactly the shape the Ask pipeline needs.
 * Verified by tests/manual/provider-tools-smoke.test.ts.
 */
export const codexProvider = createOpenAI({ baseURL: resolveOpenAIBaseURL() });

/** Primary model for Ask. Fastest of the gateway's models that reliably searches. */
export const DEFAULT_ASK_MODEL = "gpt-5.6-terra";

/** Cheaper tier for the non-conversational writers (journal insight, challenge status). */
export const DEFAULT_ASK_SIMPLE_MODEL = "gpt-5.4-mini";

/** The live MIND coach. On a voice call, time to first token is what the trader
 *  hears, so the coach gets its own setting rather than riding ASK_SIMPLE_MODEL,
 *  which the journal insight and challenge-status writers also read; those are
 *  not voice and should not follow the coach's latency tradeoff. Measured on the
 *  coach's own prompt: sol answers in 1.4-1.9s to first token, where 5.4-mini
 *  ranged 5.5-18s on identical input. */
export const DEFAULT_COACH_MODEL = "gpt-5.6-sol";

export function getAskPrimaryModelId() {
  return process.env.ASK_MODEL ?? DEFAULT_ASK_MODEL;
}

export function getAskSimpleModelId() {
  return process.env.ASK_SIMPLE_MODEL ?? DEFAULT_ASK_SIMPLE_MODEL;
}

export function getPsychologyCoachModelId() {
  return process.env.ASK_COACH_MODEL ?? DEFAULT_COACH_MODEL;
}

/**
 * The Responses API is stateful by default: on a multi-step turn the SDK sends
 * the model's earlier reasoning back as `{"type":"item_reference"}` — a pointer
 * to an item the PROVIDER is holding for us. The gateway does not store
 * responses (its own Codex config sets `disable_response_storage = true`), so
 * every such pointer dangles and the second step of any tool call dies with
 * "Upstream request failed" — the first step always succeeds, which is what
 * makes it look like a tool bug rather than a storage one.
 *
 * `store: false` fixes it at the source: the provider then sends the reasoning
 * inline as encrypted content instead of by reference. It has to be on EVERY
 * call, so it is applied here rather than at the six call sites that would each
 * have to remember it.
 */
const gatewayDefaults = (openai: Record<string, string | boolean>) =>
  defaultSettingsMiddleware({
    settings: { providerOptions: { openai: { store: false, ...openai } } },
  });

/**
 * The gateway rejects `max_output_tokens` outright — measured at 2500, 8000 and
 * 16000, all "Upstream request failed"; the same request without it succeeds.
 * (The Codex CLI it fronts never sends the field.) Dropping it is therefore the
 * only way to reach that gateway at all.
 *
 * Scoped to the gateway ON PURPOSE: every caller's maxOutputTokens is a real
 * guard — 240 tokens on the voice coach because each one is read aloud, 2500 on
 * Ask, 1000 on the daily brief — so pointing OPENAI_BASE_URL at a provider that
 * honours the field must not silently keep discarding them.
 *
 * ponytail: while this gateway is in front, those ceilings are unenforceable
 * here, so anything that truly must be bounded has to bound itself at the call
 * site — see the spoken-length cap in the coach route.
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

export function getAskSimpleModel() {
  return askModel(getAskSimpleModelId());
}

export function getPsychologyCoachModel() {
  // These are reasoning models: they think before they speak, and on a voice
  // call that thinking is dead air. "low" roughly halves it (2.4-3.0s end to
  // end vs 4.3s at the default) and the coach's replies are short and
  // empathetic rather than analytical, so little is lost.
  //
  // NOT "minimal": on this gateway that returns an EMPTY text stream — the call
  // succeeds, streams no chunks, and the trader hears silence. Any change here
  // must be checked for actual output, not just latency.
  return askModel(getPsychologyCoachModelId(), { reasoningEffort: "low" });
}

/**
 * Kept as the single place system prompts are built. The Responses API caches
 * long prompt prefixes automatically, so unlike Anthropic there is no explicit
 * cache breakpoint to set — the static block just has to stay byte-stable,
 * which is why volatile context is appended as separate messages upstream.
 */
export function createSystemMessage(content: string) {
  return { role: "system" as const, content };
}
