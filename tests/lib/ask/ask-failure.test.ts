import { RetryError } from "ai";
import { describe, expect, it } from "vitest";

import {
  classifyAskRouteError,
  getUserMessageFromAskChatError,
  parseAskFailedBody,
} from "@/lib/ask/ask-failure";

describe("classifyAskRouteError", () => {
  it("classifies generic Error as unknown", () => {
    const { code, message } = classifyAskRouteError(new Error("boom"));
    expect(code).toBe("unknown");
    expect(message).toBe("boom");
  });

  it("classifies RetryError with Overloaded message as overload", () => {
    const err = new RetryError({
      message: "Failed after 3 attempts. Last error: Overloaded",
      reason: "maxRetriesExceeded",
      errors: [new Error("Overloaded")],
    });
    const { code } = classifyAskRouteError(err);
    expect(code).toBe("overload");
  });
});

describe("parseAskFailedBody", () => {
  it("parses valid ask_failed shape", () => {
    expect(
      parseAskFailedBody({
        error: "ask_failed",
        code: "overload",
        message: "Busy",
      }),
    ).toEqual({
      error: "ask_failed",
      code: "overload",
      message: "Busy",
    });
  });

  it("returns null for invalid input", () => {
    expect(parseAskFailedBody(null)).toBeNull();
    expect(parseAskFailedBody({ error: "other" })).toBeNull();
  });
});

describe("getUserMessageFromAskChatError", () => {
  it("reads code from error cause", () => {
    const err = new Error("x");
    Object.assign(err, { cause: { code: "overload" } });
    expect(getUserMessageFromAskChatError(err)).toMatch(/busy/i);
  });
});
