const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

interface FetchWithRetryOptions {
  attempts?: number;
  baseDelayMs?: number;
}

function wait(delayMs: number) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function shouldRetryStatus(status: number) {
  return RETRYABLE_STATUS_CODES.has(status);
}

function parseRetryAfterMs(retryAfter: string | null) {
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

function getRetryDelayMs(response: Response, attempt: number, baseDelayMs: number) {
  const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
  if (retryAfterMs !== null) {
    return retryAfterMs;
  }

  return baseDelayMs * attempt;
}

export async function fetchWithRetry(
  input: URL | RequestInfo,
  init?: RequestInit,
  options: FetchWithRetryOptions = {},
) {
  const attempts = Math.max(1, options.attempts ?? 3);
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 250);
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(input, init);
      if (!shouldRetryStatus(response.status) || attempt === attempts) {
        return response;
      }

      lastError = new Error(`Request failed with status ${response.status}.`);
      await wait(getRetryDelayMs(response, attempt, baseDelayMs));
      continue;
    } catch (error) {
      lastError = error;
      if (attempt === attempts) {
        throw error;
      }
    }

    await wait(baseDelayMs * attempt);
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Request failed after retries.");
}
