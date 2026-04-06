import { describe, expect, it } from "vitest";

import {
  createSystemMessage,
  getAskModel,
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
});
