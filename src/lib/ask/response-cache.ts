import { createHash } from "node:crypto";

import { z } from "zod";

import {
  askCardSchema,
  askUiMetaSchema,
  type AskResponse,
} from "@/lib/ask/contracts";
import {
  collapseEntityText,
  lookupVerifiedEntity,
  normalizeEntityText,
  type VerifiedEntity,
} from "@/lib/ask/entities";
import { getAskPrimaryModelId } from "@/lib/ask/service/provider";
import { logger } from "@/lib/observability/logger";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Shared answer cache for bare "is <firm> legit?" lookups.
 *
 * The same firm gets asked about many times a day, and each ask re-runs the
 * whole model pipeline for the same answer. This module stores that answer and
 * replays it on the next matching ask — no model call, sub-second response.
 *
 * Safety comes from being strict about what is cached: a hit shows one user's
 * answer to another, so we only cache image-free, first-message lookups whose
 * words are just the firm name plus generic vocabulary, and only single
 * broker/guru cards. Anything else runs the normal pipeline. A miss (or any
 * cache error) behaves exactly like today, so the worst a bug can do is "no
 * hit" — never a wrong answer.
 */

// ── Config ──────────────────────────────────────────────────────────────────

const CACHE_TABLE = "ask_response_cache";

/** Bump when the card schema or system prompt changes what answers look like. */
const CACHE_SCHEMA_VERSION = 1;

/** How long a cached answer lives. The key already invalidates on any register
 * edit (see buildCacheKey), so these only guard slow off-register drift. */
const TTL_HOURS_STABLE = 72;
const TTL_HOURS_DEVELOPING = 24; // developing/provisional firms change fastest

/**
 * Words that add nothing beyond "look this firm up". If a query word is neither
 * one of these nor part of the firm's name, the question is specific (a
 * comparison, an amount, a payout question) and must not be cached. Being
 * conservative here only costs a cache miss, never a wrong answer.
 */
const GENERIC_LOOKUP_WORDS = new Set([
  "a", "about", "an", "are", "can", "check", "do", "does", "firm", "genuine",
  "good", "honest", "i", "is", "it", "legit", "legitimate", "me", "ok", "okay",
  "on", "or", "prop", "rate", "real", "regulated", "reliable", "review",
  "reviews", "safe", "scam", "should", "tell", "the", "they", "this", "trust",
  "trusted", "trustworthy", "verify", "what", "whats", "broker", "trade",
  "trading", "use", "you",
]);

const cachedPayloadSchema = z.object({
  data: askCardSchema,
  uiMeta: askUiMetaSchema,
});

type CachedPayload = z.infer<typeof cachedPayloadSchema>;

type AskCacheRequest = {
  message: string;
  image?: string | null;
  history?: ReadonlyArray<unknown>;
};

// ── Small helpers ─────────────────────────────────────────────────────────────

function cacheDisabled(): boolean {
  // Vitest loads .env.local, so the admin client in tests points at the
  // production database — never let the suite touch the live cache table.
  if (process.env.NODE_ENV === "test") return true;
  const flag = process.env.ASK_RESPONSE_CACHE?.trim().toLowerCase();
  return flag === "off" || flag === "false" || flag === "0";
}

function warn(message: string, error: unknown): void {
  logger.warn(message, { error: error instanceof Error ? error.message : "unknown" });
}

// ── Eligibility gates ─────────────────────────────────────────────────────────

/**
 * Synchronous pre-gate. Callers check this first so requests that can never be
 * cached (cache off, no backend, images, follow-up turns) skip the async cache
 * path entirely.
 */
export function isAskCacheCandidate(input: AskCacheRequest): boolean {
  if (cacheDisabled()) return false;
  if (!getSupabaseAdminClient()) return false;
  if (input.image) return false; // chart questions are per-user
  if ((input.history?.length ?? 0) > 0) return false; // follow-ups depend on context
  return Boolean(input.message?.trim());
}

/** All name words of a firm, including run-together forms ("alphafutures"). */
function firmNameWords(entity: VerifiedEntity): Set<string> {
  const words = new Set<string>();
  for (const alias of [entity.normalizedName, ...entity.aliases]) {
    for (const word of alias.split(" ")) {
      if (word) words.add(word);
    }
  }
  for (const collapsed of [collapseEntityText(entity.name), ...entity.collapsedAliases]) {
    if (collapsed) words.add(collapsed);
  }
  return words;
}

/**
 * True when the message is a bare lookup of this firm: every word is either
 * part of the firm's name or generic vocabulary, and at least one word names
 * the firm. "is Alpha Futures legit?" passes; "Alpha Futures vs FTMO" does not.
 */
export function isGenericEntityLookup(message: string, entity: VerifiedEntity): boolean {
  const words = normalizeEntityText(message).split(" ").filter(Boolean);
  const nameWords = firmNameWords(entity);

  let namesTheFirm = false;
  for (const word of words) {
    if (nameWords.has(word)) namesTheFirm = true;
    else if (!GENERIC_LOOKUP_WORDS.has(word)) return false; // a specific word
  }
  return namesTheFirm;
}

/**
 * Write-side gate: only a single broker/guru card about the resolved firm may
 * be stored. Time-sensitive cards (briefing, chart, setup, projection) and
 * personal ones (calc, plan) are skipped, and a card the model built about a
 * *different* firm is rejected.
 */
export function responseIsCacheable(response: AskResponse, entity: VerifiedEntity): boolean {
  const card = response.data;
  if (card.type !== "broker" && card.type !== "guru") return false;

  const cardName = collapseEntityText(card.name ?? "");
  const firmNames = new Set([collapseEntityText(entity.name), ...entity.collapsedAliases]);
  return Boolean(cardName) && firmNames.has(cardName);
}

/** Resolve the message to a firm we may cache, or null. Used by read and write. */
async function resolveCacheableEntity(input: AskCacheRequest): Promise<VerifiedEntity | null> {
  if (!isAskCacheCandidate(input)) return null;

  const lookup = await lookupVerifiedEntity(input.message);
  if (!lookup.found || !lookup.entity) return null;
  if (!isGenericEntityLookup(input.message, lookup.entity)) return null;
  return lookup.entity;
}

// ── Cache key ─────────────────────────────────────────────────────────────────

/**
 * The key ties a cached answer to the exact register row that produced it. Any
 * edit to the firm (score, warning, notes, tier) changes the fingerprint, so
 * stale answers become unreachable the instant the register changes — we never
 * wait for the TTL to serve a corrected verdict.
 */
export function buildAskResponseCacheKey(entity: VerifiedEntity, modelId: string): string {
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(entity))
    .digest("hex")
    .slice(0, 16);
  return `ask:v${CACHE_SCHEMA_VERSION}:${entity.id}:${modelId}:${fingerprint}`;
}

// ── Read / write ──────────────────────────────────────────────────────────────

/**
 * Returns the cached answer for a bare firm lookup, or null on any miss.
 * Never throws — any failure logs and falls through to the normal pipeline.
 */
export async function readCachedAskResponse(input: AskCacheRequest): Promise<CachedPayload | null> {
  try {
    const entity = await resolveCacheableEntity(input);
    const client = entity && getSupabaseAdminClient();
    if (!entity || !client) return null;

    const cacheKey = buildAskResponseCacheKey(entity, getAskPrimaryModelId());
    const { data, error } = await client
      .from(CACHE_TABLE)
      .select("payload")
      .eq("cache_key", cacheKey)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (error || !data) return null;

    const parsed = cachedPayloadSchema.safeParse(data.payload);
    if (!parsed.success) {
      // Shape no longer matches (old deploy / manual edit): drop the dead row.
      await client.from(CACHE_TABLE).delete().eq("cache_key", cacheKey);
      return null;
    }

    logger.info("Ask response cache hit.", { entitySlug: entity.id });
    await client
      .rpc("increment_ask_response_cache_hit", { p_cache_key: cacheKey })
      .then(() => {}, () => {}); // hit counting is best-effort
    return parsed.data;
  } catch (error) {
    warn("Ask response cache read failed.", error);
    return null;
  }
}

/**
 * Stores a finished answer when both the request and the response pass the
 * gates. Best-effort — the user already has their answer, so failures only log.
 * Also clears superseded rows so the table keeps one row per firm.
 */
export async function maybeCacheAskResponse(
  input: AskCacheRequest,
  response: AskResponse,
): Promise<void> {
  try {
    const entity = await resolveCacheableEntity(input);
    if (!entity || !responseIsCacheable(response, entity)) return;

    const client = getSupabaseAdminClient();
    if (!client) return;

    const developing =
      Boolean(response.uiMeta?.propFirm?.developing) ||
      Boolean(entity.researchStatus) ||
      Boolean(entity.provisional);
    const ttlHours = developing ? TTL_HOURS_DEVELOPING : TTL_HOURS_STABLE;
    const modelId = getAskPrimaryModelId();
    const cacheKey = buildAskResponseCacheKey(entity, modelId);

    const { error } = await client.from(CACHE_TABLE).upsert(
      {
        cache_key: cacheKey,
        entity_slug: entity.id,
        payload: { data: response.data, uiMeta: response.uiMeta } satisfies CachedPayload,
        model: modelId,
        expires_at: new Date(Date.now() + ttlHours * 3_600_000).toISOString(),
      },
      { onConflict: "cache_key" },
    );
    if (error) throw new Error(error.message);

    // Older fingerprints for this firm are unreachable by key — delete them so
    // the table holds a single current row per firm.
    await client
      .from(CACHE_TABLE)
      .delete()
      .eq("entity_slug", entity.id)
      .neq("cache_key", cacheKey)
      .then(() => {}, () => {});
  } catch (error) {
    warn("Ask response cache write failed.", error);
  }
}
