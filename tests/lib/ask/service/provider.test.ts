import { describe, expect, it } from "vitest";

import {
  createSystemMessage,
  getAskModel,
  getAskSimpleModel,
} from "@/lib/ask/service/provider";

describe("ask provider helpers", () => {
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
});
