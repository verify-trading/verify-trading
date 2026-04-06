import { anthropic } from "@ai-sdk/anthropic";

const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";

export function getAskModel() {
  return anthropic(process.env.ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODEL);
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
