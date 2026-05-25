import { describe, expect, it } from "vitest";

import {
  createSystemMessage,
  getAskModel,
  getAskSimpleModel,
} from "@/lib/ask/service/provider";

describe("ask provider helpers", () => {
  it("adds anthropic cache control to system messages", () => {
    expect(createSystemMessage("prompt")).toMatchObject({
      role: "system",
      providerOptions: {
        anthropic: {
          cacheControl: { type: "ephemeral" },
        },
      },
    });
  });

  it("creates the anthropic model instance", () => {
    expect(getAskModel()).toBeTruthy();
  });

  it("creates the simple anthropic model instance", () => {
    expect(getAskSimpleModel()).toBeTruthy();
  });
});
