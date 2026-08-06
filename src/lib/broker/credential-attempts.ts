/**
 * The two brakes on what the broker connect flow can spend, sized to the two prices MetaApi
 * charges: $0.105 per credential VALIDATION (failed ones included) and $2.10 per account
 * CREATE. Their docs make app-side rate limiting a condition of the integration — without it a
 * retry loop on a wrong investor password, or a leaked session token, is an open wallet.
 *
 * The validation budget below lives in module memory, so on serverless it is per warm
 * instance, not a global guarantee — a determined abuser rotating across cold starts sees a
 * fresh budget. At a tenth of a dollar that leak is a nuisance, and what the counter does stop
 * is naive retry loops and anything hammering one warm instance, which is the abuse that
 * actually happens. At $2.10 the same leak is a bill, so the create budget at the bottom of
 * this file counts against a table instead.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/observability/logger";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

// userId -> timestamps of attempts still inside the window.
const attempts = new Map<string, number[]>();

/**
 * Records one credential attempt and answers whether it may proceed. Sliding window: each
 * attempt expires on its own 10 minutes after the fact, so the budget trickles back rather
 * than resetting in a cliff — and a blocked attempt is NOT recorded, or hammering would
 * push its own window open-ended.
 */
export function checkCredentialAttempt(userId: string): boolean {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  // Prune on access: with no sweep timer (serverless would only pay for one anyway) the map
  // would otherwise hold a stale entry per user forever.
  const recent = (attempts.get(userId) ?? []).filter((at) => at > cutoff);
  if (recent.length >= MAX_ATTEMPTS) {
    attempts.set(userId, recent);
    return false;
  }
  recent.push(now);
  attempts.set(userId, recent);
  return true;
}

/**
 * Hand back an attempt that turned out to cost nothing. The budget is claimed up front, before
 * we know which path the request takes, so the ones that answer without ever reaching MetaApi —
 * "you already have an account connected", "connect one first" — must not burn it: a trader
 * tapping Connect on a stale row would otherwise lock themselves out for ten minutes over
 * requests that were never billable. Removes the newest stamp, which is the one just claimed.
 */
export function refundCredentialAttempt(userId: string): void {
  const recent = attempts.get(userId);
  if (!recent?.length) return;
  recent.pop();
  if (recent.length === 0) attempts.delete(userId);
}

const CREATE_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_CREATES = 3;

/**
 * Records one $2.10 account create and answers whether it may proceed. Durable, unlike the
 * validation budget above: the count comes from broker_create_events (migration 33), so it
 * survives cold starts and holds across instances.
 *
 * Three per rolling day. The legitimate ceiling is "switched broker twice today and fumbled
 * one of them"; a trader who really needs a fourth is a support conversation, not a bill. The
 * attempt is recorded BEFORE MetaApi is called, because the expensive failure is the one that
 * never comes back — a killed invocation or exhausted 202 polling leaves a paid account behind
 * and returns nothing to record. What it does NOT keep is an attempt MetaApi refused on
 * validation: nothing was created, so refundBrokerCreate hands it back.
 *
 * A REFUSED attempt is not recorded either, for the same reason the validation budget doesn't
 * record one: otherwise hammering keeps its own window open forever and the trader never gets
 * their budget back.
 *
 * Best-effort by design. It stands between the trader and connecting at all, so a throw here
 * would take that down for everyone the moment this table is unreachable — or simply before its
 * migration is applied, which is the state this ships in. An unavailable brake falls back to the
 * in-memory one, which still covers a loop hitting a warm instance.
 */
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
    // A create that could not be recorded still happens: refusing it would be a brake failure
    // blocking a paying trader, and the loop this exists to stop needs many of them to matter.
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

/**
 * Hand back a create that MetaApi refused before creating anything — a wrong investor password,
 * an unknown server. That costs $0.105, not $2.10, and it is what the attempt budget above is
 * sized for; charging it to a three-a-day ceiling would lock a trader out of connecting for a
 * whole day over three typos.
 *
 * Deletes the newest row for the user, which is the one just claimed — same rule as
 * refundCredentialAttempt. Best-effort in the same way the claim is: a refund that fails leaves
 * the trader with a smaller budget today, which is the harmless direction.
 */
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
