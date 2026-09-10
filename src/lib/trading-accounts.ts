import type { SupabaseClient } from "@supabase/supabase-js";

import { findBrokerName, type BrokerPlatform } from "@/lib/broker/metaapi";
import { logger } from "@/lib/observability/logger";

/**
 * The durable identity a connected account's journal entries are stamped with.
 *
 * It lives apart from `broker_accounts` because `broker_accounts.user_id` is unique — one row per
 * trader — so replacing an account REUSES that row. Identity cannot live on something that gets
 * overwritten: the old account's imported history would silently re-attribute to the new one.
 * Hence: replacing mints a new identity, reconnecting the same account keeps its existing one,
 * and disconnecting touches neither.
 */
export async function mintConnectedTradingAccount(
  admin: SupabaseClient,
  userId: string,
  account: { platform: BrokerPlatform; server: string },
): Promise<string> {
  // Best effort, and never blocking: this is display metadata plus the input to a non-blocking
  // note at challenge setup. A null broker_name means "we could not confirm", never "this is not
  // a prop firm" — MetaApi's list genuinely omits firms (Topstep is futures and absent entirely).
  let brokerName: string | null = null;
  try {
    brokerName = await findBrokerName(account.platform, account.server);
  } catch (error) {
    logger.warn("Broker name lookup failed; connecting without it.", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }

  const { data, error } = await admin
    .from("trading_accounts")
    .insert({
      user_id: userId,
      name: brokerName ?? account.server,
      kind: "connected",
      platform: account.platform,
      server: account.server,
      broker_name: brokerName,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(`trading_accounts insert failed: ${error?.message ?? "no row"}`);
  return (data as { id: string }).id;
}

/**
 * Retire an identity a replacement left behind. Archived, never deleted: journal entries still
 * point at it and must keep resolving, so the replaced account's history stays attributed to the
 * account that actually traded it.
 */
export async function archiveTradingAccount(admin: SupabaseClient, id: string): Promise<void> {
  const { error } = await admin
    .from("trading_accounts")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .is("archived_at", null);
  // Non-fatal: the replacement already succeeded and the stale identity is invisible once
  // nothing links to it. Losing the connection over this would be worse than a stray row.
  if (error) logger.warn("Archiving replaced trading account failed.", { error: error.message, id });
}


/** What a trader's hand-logged days land in until they name something better. */
export const DEFAULT_MANUAL_ACCOUNT_NAME = "My journal";

/**
 * The account a manual save belongs to when the client did not name one.
 *
 * Older app builds post no account at all, and they must keep working — a mobile release reaches
 * everyone slowly. So the server resolves it rather than refusing: an existing row for that date
 * keeps whatever account it already had (which is what preserves "edit an imported day to claim
 * it"), and a genuinely new day lands in the trader's default manual account.
 *
 * Returning `null` is impossible by design: every new entry gets an owner, so the unassigned
 * partial index only ever governs rows that predate this migration and nothing writes to them.
 */
export async function resolveDefaultManualAccount(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data: existing, error: readError } = await supabase
    .from("trading_accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", "manual")
    .is("archived_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (readError) throw new Error(`trading_accounts read failed: ${readError.message}`);
  if (existing) return (existing as { id: string }).id;

  const { data, error } = await supabase
    .from("trading_accounts")
    .insert({ user_id: userId, name: DEFAULT_MANUAL_ACCOUNT_NAME, kind: "manual" })
    .select("id")
    .single();
  if (error || !data) throw new Error(`trading_accounts insert failed: ${error?.message ?? "no row"}`);
  return (data as { id: string }).id;
}

/**
 * Confirms a client-supplied account is the caller's own and still live.
 *
 * The composite foreign key already makes a cross-user reference impossible, but that surfaces as
 * a 500 on a constraint name. This turns it into a 400 the app can act on, and additionally
 * rejects archived accounts, which the constraint has no opinion about.
 */
export async function isOwnedTradingAccount(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("trading_accounts")
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw new Error(`trading_accounts ownership read failed: ${error.message}`);
  return Boolean(data);
}


/**
 * Fills in a connected account's display identity when it is missing.
 *
 * The 20260910 backfill could not know these: the MT server string was never persisted before
 * that migration, so accounts connected earlier have a name of "Connected account" and nothing
 * to show or compare against. MetaApi does know, and sync already reads the live account every
 * pass — so the gap closes itself on the next run rather than needing a one-off script.
 *
 * Also repairs a connect that raced a MetaApi hiccup and stored a null broker_name.
 * Never blocking, and never overwrites a value that is already set.
 */
export async function backfillConnectedIdentity(
  admin: SupabaseClient,
  tradingAccountId: string,
  live: { server?: string; platform?: BrokerPlatform },
): Promise<void> {
  const server = live.server?.trim();
  if (!server || !live.platform) return;

  const { data } = await admin
    .from("trading_accounts")
    .select("id, name, server, broker_name")
    .eq("id", tradingAccountId)
    .maybeSingle();
  const current = data as { name: string; server: string | null; broker_name: string | null } | null;
  if (!current || current.server) return;

  let brokerName: string | null = null;
  try {
    brokerName = await findBrokerName(live.platform, server);
  } catch {
    // Display metadata only. A failed lookup leaves broker_name null and tries again next pass.
  }

  await admin
    .from("trading_accounts")
    .update({
      server,
      platform: live.platform,
      ...(brokerName ? { broker_name: brokerName } : {}),
      // Only replaces the placeholder the migration wrote, never a name the trader chose.
      ...(current.name === "Connected account" ? { name: brokerName ?? server } : {}),
    })
    .eq("id", tradingAccountId)
    .is("server", null);
}
