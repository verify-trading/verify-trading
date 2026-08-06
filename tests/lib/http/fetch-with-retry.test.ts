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

  it("caps a generous retry-after instead of letting an upstream set our function's lifetime", async () => {
    // Two minutes is a normal thing for a rate limiter or a maintenance 503 to ask for, and
    // every caller here runs inside a serverless invocation with a budget. The broker create
    // is the tight one: honouring this verbatim eats its 300 s, the function is killed
    // mid-create, and the compensating delete that releases a paid $2.10 MetaApi account
    // never runs. Waiting the cap and retrying gives the caller its own error to handle.
    vi.useFakeTimers();
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503, headers: { "retry-after": "120" } }))
      .mockResolvedValueOnce(new Response(null, { status: 200 })) as unknown as typeof fetch;

    const responsePromise = fetchWithRetry("https://example.com", undefined, { attempts: 2 });

    await vi.advanceTimersByTimeAsync(14_999);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await expect(responsePromise).resolves.toMatchObject({ status: 200 });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
