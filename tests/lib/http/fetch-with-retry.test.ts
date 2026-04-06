import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchWithRetry } from "@/lib/http/fetch-with-retry";

describe("fetchWithRetry", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch;
  });

  it("does not retry non-retryable HTTP errors", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
    }) as unknown as typeof fetch;

    const response = await fetchWithRetry("https://example.com");

    expect(response.status).toBe(400);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("throws the final network error after exhausting retries", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    await expect(
      fetchWithRetry("https://example.com", undefined, {
        attempts: 2,
        baseDelayMs: 0,
      }),
    ).rejects.toThrow("network down");

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("respects retry-after on retryable HTTP responses", async () => {
    vi.useFakeTimers();
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 429,
          headers: { "retry-after": "2" },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 })) as unknown as typeof fetch;

    const responsePromise = fetchWithRetry("https://example.com", undefined, {
      attempts: 2,
      baseDelayMs: 0,
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1999);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    const response = await responsePromise;

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(response.status).toBe(200);
  });
});
