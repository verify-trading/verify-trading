const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

interface FetchWithRetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  /** Per-attempt timeout. A hung upstream otherwise ties up the whole invocation. */
  timeoutMs?: number;
}

export function wait(delayMs: number) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function shouldRetryStatus(status: number) {
  return RETRYABLE_STATUS_CODES.has(status);
}

/** Retry-After is either a delay in seconds or an HTTP date — upstreams send both. */
export function parseRetryAfterMs(retryAfter: string | null) {
  if (!retryAfter) {
    return null;
  }

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const dateMs = Date.parse(retryAfter);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }

  return null;
}

/**
 * The most one retry may sleep, however generous the Retry-After. Upstreams send minutes on a
 * 429 or a maintenance 503, and every caller here sits inside a serverless invocation with a
 * budget — the broker create is the tight one at 300 s, where a single honoured 120 s header
 * eats the poll budget and the function is killed mid-create, leaving a paid MetaApi account
 * nothing points at. Capped, one call costs at most timeout + 15 s + timeout (~45 s at the
 * broker's 15 s timeout), which the create's three-poll budget is sized against.
 *
 * The cap is not a refusal to wait: a shorter header is honoured verbatim. It only stops an
 * upstream from setting our function's lifetime.
 */
const MAX_RETRY_DELAY_MS = 15_000;

function getRetryDelayMs(response: Response, attempt: number, baseDelayMs: number) {
  const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));

  return Math.min(retryAfterMs ?? baseDelayMs * attempt, MAX_RETRY_DELAY_MS);
}

export async function fetchWithRetry(
  input: URL | RequestInfo,
  init?: RequestInit,
  options: FetchWithRetryOptions = {},
) {
  const attempts = Math.max(1, options.attempts ?? 3);
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 250);
  const timeoutMs = Math.max(0, options.timeoutMs ?? 15_000);

  async function runAttempt(attempt: number): Promise<Response> {
    try {
      const timeoutSignal = AbortSignal.timeout(timeoutMs);
      const signal = init?.signal
        ? AbortSignal.any([init.signal, timeoutSignal])
        : timeoutSignal;
      const response = await fetch(input, { ...init, signal });
      if (!shouldRetryStatus(response.status) || attempt === attempts) {
        return response;
      }

      await wait(getRetryDelayMs(response, attempt, baseDelayMs));
      return runAttempt(attempt + 1);
    } catch (error) {
      if (attempt === attempts) {
        throw error;
      }
      await wait(baseDelayMs * attempt);
      return runAttempt(attempt + 1);
    }
  }

  return runAttempt(1);
}
