import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createSystemMessage,
  getAskModel,
  getAskSimpleModel,
  getPsychologyCoachModel,
  getAskWebSearchTool,
} from "@/lib/ask/service/provider";

describe("ask provider helpers", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("builds a plain system message", () => {
    // The Responses API caches long prefixes on its own — no explicit cache
    // breakpoint to set, so the message must stay byte-stable and nothing else.
    expect(createSystemMessage("prompt")).toEqual({ role: "system", content: "prompt" });
  });

  it("creates the ask model instance", () => {
    expect(getAskModel()).toBeTruthy();
  });

  it("creates the simple model instance", () => {
    expect(getAskSimpleModel()).toBeTruthy();
  });

  it("routes Ask, writers and the coach through Claude by default", () => {
    vi.stubEnv("ASK_MODEL", undefined);
    vi.stubEnv("ASK_SIMPLE_MODEL", undefined);
    vi.stubEnv("ASK_COACH_MODEL", undefined);
    vi.stubEnv("ANTHROPIC_API_KEY", "test-claude-key");
    for (const model of [getAskModel(), getAskSimpleModel(), getPsychologyCoachModel()]) {
      expect(model.modelId).toBe("claude-sonnet-5-5");
    }
    expect(getAskModel().provider).toBe("anthropic.messages");
    expect(getAskSimpleModel().provider).toBe("anthropic.messages");
    expect(getPsychologyCoachModel().provider).toBe("openai.chat");
  });

  it("retains explicit GPT model overrides", () => {
    vi.stubEnv("ASK_MODEL", "gpt-5.6-terra");
    vi.stubEnv("ASK_SIMPLE_MODEL", "gpt-5.4-mini");
    vi.stubEnv("ASK_COACH_MODEL", "gpt-5.6-terra");
    expect(getAskModel().provider).toBe("openai.responses");
    expect(getAskSimpleModel().provider).toBe("openai.chat");
    expect(getPsychologyCoachModel().provider).toBe("openai.responses");
  });

  it("uses Anthropic web search for Claude and OpenAI web search for GPT overrides", () => {
    vi.stubEnv("ASK_MODEL", "claude-sonnet-5-5");
    expect(getAskWebSearchTool()).toMatchObject({ type: "provider", id: "anthropic.web_search_20250305" });
    vi.stubEnv("ASK_MODEL", "gpt-5.6-terra");
    expect(getAskWebSearchTool()).toMatchObject({ type: "provider", id: "openai.web_search" });
  });
});
