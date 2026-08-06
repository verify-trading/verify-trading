// Two brakes, sized to the two prices MetaApi charges: $0.105 per credential VALIDATION (failed
// ones included) and $2.10 per account CREATE. App-side rate limiting is a condition of their
// integration.
// The validation budget below is module memory, so on serverless it is per warm instance, not
// global — enough for a tenth of a dollar. The $2.10 create budget counts against a table instead.

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/observability/logger";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

// userId -> timestamps of attempts still inside the window.
const attempts = new Map<string, number[]>();

// Sliding window. A blocked attempt is NOT recorded, or hammering pushes its own window open-ended.
export function checkCredentialAttempt(userId: string): boolean {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  // Prune on access: there is no sweep timer, so the map would hold a stale entry per user forever.
  const recent = (attempts.get(userId) ?? []).filter((at) => at > cutoff);
  if (recent.length >= MAX_ATTEMPTS) {
    attempts.set(userId, recent);
    return false;
  }
  recent.push(now);
  attempts.set(userId, recent);
  return true;
}

// Hands back an attempt that never reached MetaApi and so cost nothing. Removes the newest stamp,
// which is the one just claimed.
export function refundCredentialAttempt(userId: string): void {
  const recent = attempts.get(userId);
  if (!recent?.length) return;
  recent.pop();
  if (recent.length === 0) attempts.delete(userId);
}

const CREATE_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_CREATES = 3;

// Records one $2.10 account create and answers whether it may proceed. Durable, unlike the
// validation budget above: the count comes from broker_create_events (migration 33).
// Three per rolling day, recorded BEFORE MetaApi is called — a killed invocation or exhausted 202
// polling leaves a paid account behind and returns nothing to record. A refused attempt is not
// recorded, or hammering keeps its own window open forever.
// Best-effort: an unreachable table (or an unapplied migration 33) falls back to the in-memory
// brake rather than blocking every trader from connecting.
export async function claimBrokerCreate(admin: SupabaseClient, userId: string): Promise<boolean> {
  const since = new Date(Date.now() - CREATE_WINDOW_MS).toISOString();
  try {
    const { count, error } = await admin
      .from("broker_create_events")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gt("created_at", since);
    if (error) throw new Error(error.message);
    if ((count ?? 0) >= MAX_CREATES) return false;

    const { error: recordError } = await admin.from("broker_create_events").insert({ user_id: userId });
    if (recordError) throw new Error(recordError.message);
    return true;
  } catch (error) {
    logger.warn("Broker create budget unavailable; falling back to the in-memory attempt brake.", {
      userId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return true;
  }
}

// Hands back a create MetaApi refused before creating anything: that costs $0.105, not $2.10, and
// belongs to the attempt budget. Deletes the newest row, which is the one just claimed.
// Best-effort — a failed refund leaves a smaller budget today, the harmless direction.
export async function refundBrokerCreate(admin: SupabaseClient, userId: string): Promise<void> {
  try {
    const { data, error } = await admin
      .from("broker_create_events")
      .select("id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return;

    const { error: deleteError } = await admin
      .from("broker_create_events")
      .delete()
      .eq("id", (data as { id: number }).id);
    if (deleteError) throw new Error(deleteError.message);
  } catch (error) {
    logger.warn("Broker create budget refund failed; the trader keeps a smaller budget today.", {
      userId,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}
