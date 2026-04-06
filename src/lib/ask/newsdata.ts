import { fetchWithRetry } from "@/lib/http/fetch-with-retry";

const NEWSDATA_LATEST = "https://newsdata.io/api/1/latest";
const NEWSDATA_ARCHIVE = "https://newsdata.io/api/1/archive";

export type NewsArticleSummary = {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  description: string;
};

export type NewsSearchResult = {
  query: string;
  articles: NewsArticleSummary[];
  note?: string;
};

export type FetchNewsEverythingOptions = {
  query: string;
  from?: string;
  language?: string;
  pageSize?: number;
};

function formatDateForApi(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Drop invalid or future YYYY-MM-DD so archive is not called with bad model-invented dates. */
export function effectiveNewsArchiveFromDate(from: string | undefined): string | undefined {
  if (!from || !/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    return undefined;
  }
  const todayStr = formatDateForApi(new Date());
  if (from > todayStr) {
    return undefined;
  }
  return from;
}

function getApiKey(): string | undefined {
  return process.env.NEWSDATA_API_KEY || process.env.NEWS_API_KEY;
}

function mapArticle(raw: Record<string, unknown>): NewsArticleSummary | null {
  const title = typeof raw.title === "string" ? raw.title : "";
  const url =
    typeof raw.link === "string"
      ? raw.link
      : typeof raw.url === "string"
        ? raw.url
        : "";
  const publishedAt =
    typeof raw.pubDate === "string"
      ? raw.pubDate
      : typeof raw.publishedAt === "string"
        ? raw.publishedAt
        : "";
  const source =
    typeof raw.source_name === "string"
      ? raw.source_name
      : typeof raw.source === "string"
        ? raw.source
        : "";
  const description =
    typeof raw.description === "string"
      ? raw.description
      : typeof raw.content === "string"
        ? raw.content
        : "";

  if (!title || !url) {
    return null;
  }

  return {
    title,
    source: source || "Unknown",
    url,
    publishedAt: publishedAt || "",
    description,
  };
}

function parseNewsDataJson(
  response: Response,
  json: Record<string, unknown>,
): void {
  if (!response.ok) {
    const msg =
      typeof json.message === "string"
        ? json.message
        : `NewsData error (${response.status}).`;
    if (response.status === 401 || response.status === 403) {
      throw new Error(`NewsData: invalid or missing API key. ${msg}`);
    }
    if (response.status === 429) {
      throw new Error(`NewsData: rate limited. ${msg}`);
    }
    throw new Error(msg);
  }

  if (json.status !== "success") {
    const msg =
      typeof json.message === "string"
        ? json.message
        : "NewsData returned an error.";
    throw new Error(msg);
  }
}

function articlesFromPayload(json: Record<string, unknown>): NewsArticleSummary[] {
  const rawResults = Array.isArray(json.results) ? json.results : [];
  const articles: NewsArticleSummary[] = [];

  for (const item of rawResults) {
    if (item && typeof item === "object") {
      const mapped = mapArticle(item as Record<string, unknown>);
      if (mapped) {
        articles.push(mapped);
      }
    }
  }

  return articles;
}

async function fetchNewsDataUrl(url: string): Promise<NewsArticleSummary[]> {
  const response = await fetchWithRetry(
    url,
    { method: "GET" },
    { attempts: 2, baseDelayMs: 400 },
  );
  const json = (await response.json()) as Record<string, unknown>;
  parseNewsDataJson(response, json);
  return articlesFromPayload(json);
}

function buildLatestUrl(
  apiKey: string,
  q: string,
  options: FetchNewsEverythingOptions,
): string {
  const params = new URLSearchParams({
    apikey: apiKey,
    q,
    size: String(Math.min(50, Math.max(1, options.pageSize ?? 10))),
  });
  if (options.language) {
    params.set("language", options.language.slice(0, 2));
  }
  return `${NEWSDATA_LATEST}?${params.toString()}`;
}

function buildArchiveUrl(
  apiKey: string,
  q: string,
  fromDate: string,
  options: FetchNewsEverythingOptions,
): string {
  const toDate = formatDateForApi(new Date());
  const params = new URLSearchParams({
    apikey: apiKey,
    q,
    from_date: fromDate,
    to_date: toDate,
    size: String(Math.min(50, Math.max(1, options.pageSize ?? 10))),
  });
  if (options.language) {
    params.set("language", options.language.slice(0, 2));
  }
  return `${NEWSDATA_ARCHIVE}?${params.toString()}`;
}

function shouldFallbackArchiveToLatest(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  if (/invalid or missing API key/i.test(msg)) {
    return false;
  }
  return /archive|paid|subscription|plan|not available|403|422/i.test(msg);
}

export async function fetchNewsEverything(
  options: FetchNewsEverythingOptions,
): Promise<NewsSearchResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return {
      query: options.query,
      articles: [],
      note: "News search is not configured on the server.",
    };
  }

  const q = options.query;
  if (!q) {
    return { query: "", articles: [], note: "Empty search query." };
  }

  const from = effectiveNewsArchiveFromDate(options.from);

  if (from) {
    try {
      const url = buildArchiveUrl(apiKey, q, from, options);
      const articles = await fetchNewsDataUrl(url);
      return {
        query: q,
        articles,
        ...(articles.length === 0
          ? { note: "No articles matched that search." }
          : {}),
      };
    } catch (error) {
      if (!shouldFallbackArchiveToLatest(error)) {
        throw error;
      }
      const articles = await fetchNewsDataUrl(buildLatestUrl(apiKey, q, options));
      return {
        query: q,
        articles,
        note:
          articles.length === 0
            ? "No articles matched that search."
            : "Historical date filter needs NewsData Archive (paid plan); showing headlines from the last 48 hours instead.",
      };
    }
  }

  const articles = await fetchNewsDataUrl(buildLatestUrl(apiKey, q, options));
  return {
    query: q,
    articles,
    ...(articles.length === 0
      ? { note: "No articles matched that search." }
      : {}),
  };
}
