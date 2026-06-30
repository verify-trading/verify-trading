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
export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";

/** Simple model now matches primary — single-model pipeline. */
export const DEFAULT_ANTHROPIC_SIMPLE_MODEL = DEFAULT_ANTHROPIC_MODEL;

export function getAskPrimaryModelId() {
  return process.env.ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODEL;
}

export function getAskSimpleModelId() {
  return process.env.ANTHROPIC_SIMPLE_MODEL ?? DEFAULT_ANTHROPIC_SIMPLE_MODEL;
}

export function getAskModel() {
  return anthropic(getAskPrimaryModelId());
}

export function getAskSimpleModel() {
  return anthropic(getAskSimpleModelId());
}

export function createSystemMessage(content: string) {
  return {
    role: "system" as const,
    content,
    providerOptions: {
      anthropic: {
        cacheControl: { type: "ephemeral" as const },
      },
    },
  };
}
