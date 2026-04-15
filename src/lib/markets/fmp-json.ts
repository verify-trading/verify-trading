import { fetchWithRetry } from "@/lib/http/fetch-with-retry";

/**
 * Low-level FMP JSON fetch with Next.js data cache revalidation.
 * Mirrors the pattern in `@/lib/ask/market` but lives under markets for news/calendar.
 */
export async function fetchFmpJson(
  pathname: string,
  params: Record<string, string>,
  revalidateSeconds: number,
): Promise<unknown> {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) {
    throw new Error("FMP_API_KEY is not configured.");
  }

  const normalizedPath = pathname.replace(/^\//, "");
  const url = new URL(`https://financialmodelingprep.com/${normalizedPath}`);
  Object.entries({ ...params, apikey: apiKey }).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetchWithRetry(url, {
    next: { revalidate: revalidateSeconds },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`FMP request failed with ${response.status}.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(text.trim() || "FMP returned a non-JSON response.");
  }

  if (typeof parsed === "string") {
    throw new Error(parsed);
  }

  if (
    parsed &&
    typeof parsed === "object" &&
    "Error Message" in parsed &&
    typeof (parsed as Record<string, unknown>)["Error Message"] === "string"
  ) {
    throw new Error((parsed as Record<string, string>)["Error Message"]);
  }

  return parsed;
}
