import { anthropic } from "@ai-sdk/anthropic";

/** Primary model for Ask (Sonnet-class by default). */
export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";

/** Used when the primary model fails after retries (overload / 5xx / rate limits). */
export const DEFAULT_ANTHROPIC_FALLBACK_MODEL = "claude-haiku-4-5-20251001";

export function getAskPrimaryModelId() {
  return process.env.ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODEL;
}

export function getAskFallbackModelId() {
  return process.env.ANTHROPIC_FALLBACK_MODEL ?? DEFAULT_ANTHROPIC_FALLBACK_MODEL;
}

export function getAskModel() {
  return anthropic(getAskPrimaryModelId());
}

export function getAskFallbackModel() {
  return anthropic(getAskFallbackModelId());
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
