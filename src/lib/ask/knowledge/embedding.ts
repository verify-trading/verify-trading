import { fetchWithRetry } from "@/lib/http/fetch-with-retry";

/**
 * Embeddings for knowledge retrieval. Uses an OpenAI-compatible embeddings
 * endpoint so the provider can be swapped via env without code changes.
 *
 * Required env: EMBEDDINGS_API_KEY (or OPENAI_API_KEY as a fallback).
 * Optional env: EMBEDDINGS_MODEL, EMBEDDINGS_BASE_URL.
 *
 * The default model (text-embedding-3-small) produces 1536-dimension vectors,
 * matching vector(1536) in supabase/migration_17.sql. Changing models means
 * changing that column and re-running the backfill.
 */
const DEFAULT_EMBEDDINGS_MODEL = "text-embedding-3-small";
const DEFAULT_EMBEDDINGS_BASE_URL = "https://api.openai.com/v1";

export const KNOWLEDGE_EMBEDDING_DIMENSIONS = 1536;

export function isEmbeddingConfigured() {
  return Boolean(process.env.EMBEDDINGS_API_KEY ?? process.env.OPENAI_API_KEY);
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const apiKey = process.env.EMBEDDINGS_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Embeddings are not configured. Set EMBEDDINGS_API_KEY.");
  }

  const baseUrl = process.env.EMBEDDINGS_BASE_URL ?? DEFAULT_EMBEDDINGS_BASE_URL;
  const model = process.env.EMBEDDINGS_MODEL ?? DEFAULT_EMBEDDINGS_MODEL;

  const response = await fetchWithRetry(`${baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ model, input: texts }),
  });

  if (!response.ok) {
    throw new Error(`Embeddings request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as {
    data?: Array<{ index: number; embedding: number[] }>;
  };
  const rows = payload.data ?? [];
  if (rows.length !== texts.length) {
    throw new Error("Embeddings response did not match the input batch size.");
  }

  return rows
    .toSorted((left, right) => left.index - right.index)
    .map((row) => row.embedding);
}

export async function embedText(text: string): Promise<number[]> {
  const [embedding] = await embedTexts([text]);
  return embedding;
}
