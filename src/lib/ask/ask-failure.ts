import { APICallError, RetryError } from "ai";

/** Machine-readable Ask API failure; stable for clients and logs. */
export type AskFailureCode = "overload" | "rate_limit" | "upstream" | "unknown";

export const ASK_USER_MESSAGE_INVALID_RESPONSE =
  "We couldn't read that reply. Try again or shorten the question.";

const USER_MESSAGES: Record<AskFailureCode, string> = {
  overload:
    "Our AI is busy right now. Try again in a moment.",
  rate_limit: "Too many requests. Wait a bit and retry.",
  upstream: "Something went wrong on our side. Try again shortly.",
  unknown: "Could not get an answer right now. Please try again.",
};

export function getUserMessageForAskFailureCode(code: AskFailureCode): string {
  return USER_MESSAGES[code];
}

function isOverloadOrRateLimitMessage(message: string): boolean {
  const m = message.toLowerCase();
  return (
    /overloaded|over capacity|529|rate limit|too many requests/.test(m) ||
    m.includes(" 429")
  );
}

function isRetryableCapacityError(error: unknown): boolean {
  if (APICallError.isInstance(error)) {
    const code = error.statusCode;
    if (code === 401 || code === 403) {
      return false;
    }
    if (code === 408 || code === 429 || code === 503 || code === 529) {
      return true;
    }
    if (code !== undefined && code >= 500) {
      return true;
    }
  }

  if (error instanceof Error) {
    const m = error.message.toLowerCase();
    return (
      /overloaded|over capacity|rate limit|too many requests|temporarily unavailable|try again|timeout|529|503|502|504/.test(
        m,
      ) ||
      m.includes("econnreset") ||
      m.includes("econnrefused")
    );
  }

  return false;
}

/**
 * Maps thrown errors from `generateAskResponse` (and similar) to a stable code and short server message.
 */
export function classifyAskRouteError(error: unknown): {
  code: AskFailureCode;
  message: string;
} {
  if (RetryError.isInstance(error)) {
    const last = error.lastError;
    if (APICallError.isInstance(last)) {
      if (last.statusCode === 429) {
        return { code: "rate_limit", message: last.message };
      }
      if (
        last.statusCode === 503 ||
        last.statusCode === 529 ||
        (last.statusCode !== undefined && last.statusCode >= 500)
      ) {
        return { code: "overload", message: last.message };
      }
    }
    if (isOverloadOrRateLimitMessage(error.message)) {
      return /rate|429|too many/i.test(error.message)
        ? { code: "rate_limit", message: error.message }
        : { code: "overload", message: error.message };
    }
    if (isRetryableCapacityError(error.lastError)) {
      return { code: "upstream", message: error.message };
    }
  }

  if (APICallError.isInstance(error)) {
    if (error.statusCode === 429) {
      return { code: "rate_limit", message: error.message };
    }
    if (
      error.statusCode === 503 ||
      error.statusCode === 529 ||
      (error.statusCode !== undefined && error.statusCode >= 500)
    ) {
      return { code: "overload", message: error.message };
    }
  }

  if (error instanceof Error && isOverloadOrRateLimitMessage(error.message)) {
    return /rate|429|too many/i.test(error.message)
      ? { code: "rate_limit", message: error.message }
      : { code: "overload", message: error.message };
  }

  if (isRetryableCapacityError(error)) {
    return {
      code: "upstream",
      message: error instanceof Error ? error.message : "Upstream error.",
    };
  }

  return {
    code: "unknown",
    message: error instanceof Error ? error.message : "Unknown error.",
  };
}

export type AskFailedResponseBody = {
  error: "ask_failed";
  code: AskFailureCode;
  message: string;
};

export function getUserMessageFromAskChatError(error: unknown): string {
  if (!error || typeof error !== "object") {
    return getUserMessageForAskFailureCode("unknown");
  }

  const cause = (error as { cause?: unknown }).cause;
  if (cause && typeof cause === "object" && cause !== null && "code" in cause) {
    const code = (cause as { code: unknown }).code;
    if (
      code === "overload" ||
      code === "rate_limit" ||
      code === "upstream" ||
      code === "unknown"
    ) {
      return getUserMessageForAskFailureCode(code);
    }
  }

  return getUserMessageForAskFailureCode("unknown");
}

export function parseAskFailedBody(json: unknown): AskFailedResponseBody | null {
  if (!json || typeof json !== "object") {
    return null;
  }
  const o = json as Record<string, unknown>;
  if (o.error !== "ask_failed" || typeof o.message !== "string") {
    return null;
  }
  const code = o.code;
  if (
    code === "overload" ||
    code === "rate_limit" ||
    code === "upstream" ||
    code === "unknown"
  ) {
    return { error: "ask_failed", code, message: o.message };
  }
  return null;
}
