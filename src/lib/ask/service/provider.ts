import { createAnthropic } from "@ai-sdk/anthropic";

/**
 * The AI SDK appends "/messages" to the base URL, so the base URL MUST include
 * the version segment. A bare `ANTHROPIC_BASE_URL=https://api.anthropic.com`
 * (no `/v1`) silently turns every request into a 404 — normalize it here so a
 * misconfigured env can't take Ask down. When unset we let the SDK use its own
 * default (which already includes `/v1`).
 */
function resolveAnthropicBaseURL() {
  const raw = process.env.ANTHROPIC_BASE_URL?.trim();
  if (!raw) return undefined;
  const trimmed = raw.replace(/\/+$/, "");
  return /\/v\d+$/.test(trimmed) ? trimmed : `${trimmed}/v1`;
}

const anthropic = createAnthropic({ baseURL: resolveAnthropicBaseURL() });

/** Primary model for Ask (Sonnet-class by default). */
export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5";

/** Simple model now matches primary — single-model pipeline. */
export const DEFAULT_ANTHROPIC_SIMPLE_MODEL = DEFAULT_ANTHROPIC_MODEL;

export function getAskPrimaryModelId() {
  return process.env.ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODEL;
}

export function getAskSimpleModelId() {
  return process.env.ANTHROPIC_SIMPLE_MODEL ?? DEFAULT_ANTHROPIC_SIMPLE_MODEL;
}

/** The live MIND coach. Haiku is ~3x cheaper than Sonnet and, more importantly for a
 *  voice call, faster to first token — the trader hears the pause. It gets its own
 *  setting rather than riding ANTHROPIC_SIMPLE_MODEL, which the journal insight and
 *  challenge-status writers also read; those are not voice and should not follow the
 *  coach's latency tradeoff. */
export const DEFAULT_COACH_MODEL = "claude-haiku-4-5";

export function getPsychologyCoachModelId() {
  return process.env.ANTHROPIC_COACH_MODEL ?? DEFAULT_COACH_MODEL;
}

export function getAskModel() {
  return anthropic(getAskPrimaryModelId());
}

export function getAskSimpleModel() {
  return anthropic(getAskSimpleModelId());
}

export function getPsychologyCoachModel() {
  return anthropic(getPsychologyCoachModelId());
}

export function createSystemMessage(content: string) {
  return {
    role: "system" as const,
    content,
    providerOptions: {
      anthropic: {
        // 1-hour TTL: the static prompt is byte-stable across requests, so idle
        // gaps between turns no longer re-pay cache creation on the long prefix.
        cacheControl: { type: "ephemeral" as const, ttl: "1h" as const },
      },
    },
  };
}
