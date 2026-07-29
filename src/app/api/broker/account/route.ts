import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireBrokerProSession, requireBrokerSession } from "@/lib/broker/access";
import {
  type BrokerPlatform,
  createAccount,
  createConfigurationLink,
  deleteAccount,
  getAccount,
  type MetaApiAccount,
  MetaApiError,
  platformOfVersion,
  undeployAccount,
} from "@/lib/broker/metaapi";
import {
  BROKER_ACCOUNT_COLUMNS,
  loadBrokerAccountRow,
  readBrokerAccountPayload,
  toBrokerAccountPayload,
  type BrokerAccountRow,
} from "@/lib/broker/sync";
import { jsonApiError, PRIVATE_CACHE_HEADERS } from "@/lib/http/json-response";
import { logger } from "@/lib/observability/logger";

/**
 * The trader's one connected MT4/MT5 account, created at MetaApi WITHOUT credentials: the login
 * and investor password are typed on MetaApi's hosted page and never touch this service. `server`
 * and `platform` must be decided here because that page collects login + password only — hence
 * the server picker first.
 */

const createSchema = z.object({
  platform: z.enum(["mt4", "mt5"]),
  server: z.string().trim().min(1).max(120),
});

export async function GET() {
  // NOT Pro-gated, for the same reason DELETE isn't: the client renders its Disconnect button off
  // this payload, so gating it hid a lapsed subscriber's own billing connection from them.
  const access = await requireBrokerSession();
  if (!access.ok) return access.response;

  try {
    const account = await readBrokerAccountPayload(access.admin, access.userId);
    return NextResponse.json({ account }, { headers: PRIVATE_CACHE_HEADERS });
  } catch (error) {
    logger.error("Broker account read failed.", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return jsonApiError(500, "broker_account_unavailable", "Could not load your broker connection right now.");
  }
}

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonApiError(400, "broker_account_invalid", "The broker connection request is invalid.");
  }

  const access = await requireBrokerProSession();
  if (!access.ok) return access.response;

  // Four separate questions, deliberately not collapsed — conflating any two of them is a money
  // bug. `created`: what the catch must delete, or MetaApi bills for an account nothing points at.
  // `claimedRowId`: only a row THIS request inserted, so a failed replace can't delete the
  // trader's existing one. `targetRowId`: where the result is written. `reusedDormantRow`: whether
  // to reset the row's stale state — true even when there is no old account to release.
  // `replacedAccountId`: a live old account to delete afterwards.
  let created: { id: string } | undefined;
  let claimedRowId: string | undefined;
  let targetRowId: string;
  let reusedDormantRow = false;
  let replacedAccountId: string | undefined;

  try {
    // A disconnected trader still HAS their account at MetaApi — parked, not burnt — so
    // reconnecting reuses it for free. Unless they picked a DIFFERENT one: server and platform are
    // fixed at creation, so "same login again" and "I moved to my funded account" cannot share an
    // account, and waking regardless reconnected them to the broker they had just left.
    const dormant = await loadDormantBrokerRow(access.admin, access.userId);
    if (dormant) {
      const live = await readAccountQuietly(dormant.metaapi_account_id);
      if (live !== "gone" && isSameBrokerAccount(live, parsed.data)) {
        return await reconnect(access.admin, dormant);
      }
      // Claim the row BEFORE spending, as the fresh path does. Waking it IS the claim:
      // `disconnected_at is not null` can only match once, so two concurrent POSTs cannot both
      // pay $2.10 and leave the loser's account orphaned.
      const { data: woken, error: wakeError } = await access.admin
        .from("broker_accounts")
        .update({ disconnected_at: null })
        .eq("id", dormant.id)
        .not("disconnected_at", "is", null)
        .select("id");
      if (wakeError) throw new Error(`broker_accounts replace claim failed: ${wakeError.message}`);
      if ((woken ?? []).length === 0) {
        // Someone else took it between our read and here. Nothing was spent.
        return jsonApiError(409, "broker_account_exists", "You've already connected an account. Disconnect it first.");
      }
      // The row is re-pointed at a fresh account below. There is only something to release when
      // the old account still exists — "gone" means MetaApi already released it.
      reusedDormantRow = true;
      replacedAccountId = live === "gone" ? undefined : dormant.metaapi_account_id;
      targetRowId = dormant.id;
    } else {
      // Claim the slot BEFORE spending: the unique index on user_id is the lock. Check-then-call
      // left a gap two requests both fit through, each paying $2.10. The placeholder id stands
      // only until the create returns — the column is NOT NULL.
      const { data: claim, error: claimError } = await access.admin
        .from("broker_accounts")
        .insert({
          user_id: access.userId,
          metaapi_account_id: `pending:${access.userId}`,
          platform: parsed.data.platform,
          // Every sync reads the region off the live snapshot and rewrites this, so fetching it
          // here would be a round trip for a value overwritten before it is read.
          region: null,
        })
        .select("id")
        .single();

      if (claimError || !claim) {
        // The unique violation IS the "already connected" answer, and it is the same answer
        // for a second tab racing this one. Nothing was spent.
        return jsonApiError(409, "broker_account_exists", "You've already connected an account. Disconnect it first.");
      }
      claimedRowId = (claim as { id: string }).id;
      targetRowId = claimedRowId;
    }

    // Create BEFORE releasing the old account, never the other way round: a create that fails
    // after the delete would leave the trader with no connection at all and the $2.10 already
    // spent. This ordering means the worst case is one extra account for a moment.
    created = await createAccount({
      userId: access.userId,
      platform: parsed.data.platform,
      server: parsed.data.server,
    });

    const configurationLink = await createConfigurationLink(created.id);

    const { data, error } = await access.admin
      .from("broker_accounts")
      .update({
        metaapi_account_id: created.id,
        // A replacement is a different account, so everything the row remembered about the old
        // one has to go. last_synced_at is the dangerous one: computeSyncWindow starts from it, so
        // leaving it would begin the new account's history at the old account's last sync instead
        // of pulling its 90 days.
        ...(reusedDormantRow
          ? {
              platform: parsed.data.platform,
              disconnected_at: null,
              last_synced_at: null,
              last_sync_error: null,
              last_deploy_at: null,
              region: null,
            }
          : {}),
      })
      .eq("id", targetRowId)
      .select(BROKER_ACCOUNT_COLUMNS)
      .single();

    if (error || !data) {
      throw new Error(`broker_accounts claim update failed: ${error?.message ?? "no row returned"}`);
    }

    // The row now points at the new account, so this is the last reference to the old one. Best
    // effort: a failure here leaks a parked account (~$0.77/month) and deserves a loud log, but it
    // must NOT roll anything back — the trader is already on the new account.
    if (replacedAccountId) {
      try {
        await deleteAccount(replacedAccountId);
      } catch (releaseError) {
        logger.error("Broker account replace: old account left behind and still billing.", {
          metaapiAccountId: replacedAccountId,
          userId: access.userId,
          error: releaseError instanceof Error ? releaseError.message : "unknown",
        });
      }
    }

    return NextResponse.json(
      {
        // A credential-less account is by definition not configured yet — no need to ask
        // MetaApi what we already know.
        account: toBrokerAccountPayload(data as BrokerAccountRow, {
          state: "awaiting_config",
          stateDetail: null,
        }),
        configurationLink,
      },
      { headers: PRIVATE_CACHE_HEADERS },
    );
  } catch (error) {
    // Compensating delete. Adding an account costs $2.10 and it bills from then on, so a paid-for
    // orphan nothing in our database points at must not survive this request. A cleanup that
    // ITSELF fails is the one failure here that stays expensive, so it gets its own log line.
    if (created) {
      try {
        await deleteAccount(created.id);
      } catch (cleanupError) {
        logger.error("Broker account cleanup failed — a paid MetaApi account is now orphaned.", {
          metaapiAccountId: created.id,
          userId: access.userId,
          error: cleanupError instanceof Error ? cleanupError.message : "unknown",
        });
      }
    }
    // Release the claim so the trader can try again; leaving it would 409 them forever.
    if (claimedRowId) {
      const { error: releaseError } = await access.admin
        .from("broker_accounts")
        .delete()
        .eq("id", claimedRowId);
      if (releaseError) {
        logger.error("Broker claim release failed — the trader cannot reconnect until this row goes.", {
          rowId: claimedRowId,
          error: releaseError.message,
        });
      }
    }
    logger.error("Broker account create failed.", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return jsonApiError(502, "broker_account_create_failed", "Could not connect your broker account right now.");
  }
}

/**
 * The parked account's live snapshot, or null when MetaApi won't say. Never throws: the only
 * caller uses it to decide whether to REPLACE the account, and a read failure must not be allowed
 * to look like "this is a different broker".
 */
async function readAccountQuietly(accountId: string): Promise<MetaApiAccount | "gone" | null> {
  try {
    return await getAccount(accountId);
  } catch (error) {
    // A 404 is not uncertainty — it is MetaApi saying the account does not exist, which happens
    // when one is removed from their dashboard directly. Without this the row points at nothing
    // forever: reconnect would ask that id for a configuration link and 502, and the dormant row
    // blocks a fresh create, so the trader could never connect again.
    if (error instanceof MetaApiError && error.status === 404) return "gone";
    logger.warn("Broker reconnect: could not read the parked account; treating it as the same one.", {
      metaapiAccountId: accountId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}

/**
 * Is the account they already have the one they just picked? Answers TRUE whenever we cannot prove
 * otherwise: the false branch deletes a paid account irreversibly, so it fires only when MetaApi
 * positively reported both fields and one differs.
 */
function isSameBrokerAccount(
  live: MetaApiAccount | null,
  picked: { platform: BrokerPlatform; server: string },
): boolean {
  const server = live?.server?.trim().toLowerCase();
  const platform = platformOfVersion(live?.version);
  if (!server || !platform) return true;
  return server === picked.server.trim().toLowerCase() && platform === picked.platform;
}

/** The trader's parked account, if they disconnected one before. */
async function loadDormantBrokerRow(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin
    .from("broker_accounts")
    .select(BROKER_ACCOUNT_COLUMNS)
    .eq("user_id", userId)
    .not("disconnected_at", "is", null)
    .maybeSingle();

  if (error) throw new Error(`broker_accounts dormant read failed: ${error.message}`);
  return (data as BrokerAccountRow | null) ?? null;
}

/**
 * Wake a parked account instead of buying a new one. Clearing disconnected_at is the whole
 * reconnect — the account still exists at MetaApi with the credentials on it — so nothing is
 * created and nothing is paid. A fresh configuration link is issued anyway: the old one has a TTL,
 * and a password change is exactly why someone reconnects.
 *
 * Only reached when the pick MATCHES the parked account (see isSameBrokerAccount). platform and
 * server are deliberately NOT written: they are fixed at MetaApi, so writing them back is what
 * once let the row claim "MT4 connected" over a live MT5 account.
 */
async function reconnect(admin: SupabaseClient, row: BrokerAccountRow) {
  const configurationLink = await createConfigurationLink(row.metaapi_account_id);

  const { data, error } = await admin
    .from("broker_accounts")
    .update({ disconnected_at: null, last_sync_error: null })
    .eq("id", row.id)
    .select(BROKER_ACCOUNT_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(`broker_accounts reconnect failed: ${error?.message ?? "no row returned"}`);
  }

  return NextResponse.json(
    {
      // The credentials may still be on it from last time, so state is read live rather
      // than assumed — awaiting_config would be a lie for an account already configured.
      account: await readBrokerAccountPayload(admin, row.user_id),
      configurationLink,
    },
    { headers: PRIVATE_CACHE_HEADERS },
  );
}

export async function DELETE() {
  // Deliberately NOT Pro-gated: a lapsed subscriber must be able to switch their connection off,
  // or it keeps costing us money they no longer pay for.
  const access = await requireBrokerSession();
  if (!access.ok) return access.response;

  try {
    const row = await loadBrokerAccountRow(access.admin, access.userId);
    if (!row) {
      return NextResponse.json({}, { headers: PRIVATE_CACHE_HEADERS });
    }

    // Park it, don't burn it: deleting throws away the $2.10 join fee, so every reconnect would
    // buy the same account again. The row is kept because it remembers which MetaApi account is
    // theirs; imported journal days stay either way.
    //
    // MetaApi failing must NOT block the disconnect — a broken MetaApi is the likeliest reason
    // someone is here, and a 502 used to leave them on a screen whose only button didn't work.
    // Worst case is an account left deployed, which the next pull parks.
    try {
      await undeployAccount(row.metaapi_account_id);
    } catch (parkError) {
      logger.error("Broker park on disconnect failed; disconnecting anyway.", {
        metaapiAccountId: row.metaapi_account_id,
        error: parkError instanceof Error ? parkError.message : "unknown",
      });
    }

    const { error } = await access.admin
      .from("broker_accounts")
      .update({ disconnected_at: new Date().toISOString(), last_sync_error: null })
      .eq("id", row.id);
    if (error) {
      throw new Error(`broker_accounts disconnect failed: ${error.message}`);
    }

    return NextResponse.json({}, { headers: PRIVATE_CACHE_HEADERS });
  } catch (error) {
    logger.error("Broker account delete failed.", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return jsonApiError(502, "broker_account_delete_failed", "Could not disconnect your broker account right now.");
  }
}
