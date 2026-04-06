import { parseAskFailedBody } from "@/lib/ask/ask-failure";

/**
 * Wraps `fetch` for the Ask chat transport: surfaces `code` on failed JSON bodies via `error.cause`.
 */
export function createAskChatFetch(): typeof fetch {
  return async (input, init) => {
    const response = await fetch(input, init);

    if (!response.ok) {
      const text = await response.text();
      let parsed: unknown;

      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error(
          response.status === 502
            ? "Service temporarily unavailable."
            : `Request failed (${response.status}).`,
        );
      }

      const failed = parseAskFailedBody(parsed);
      if (failed) {
        const err = new Error(failed.message);
        Object.assign(err, { cause: { code: failed.code } });
        throw err;
      }

      const message =
        typeof parsed === "object" && parsed !== null && "message" in parsed
          ? String((parsed as { message: unknown }).message)
          : `Request failed (${response.status}).`;
      throw new Error(message);
    }

    return response;
  };
}
