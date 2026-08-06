import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireBrokerProSession, requireBrokerSession } from "@/lib/broker/access";
import {
  checkCredentialAttempt,
  claimBrokerCreate,
  refundBrokerCreate,
  refundCredentialAttempt,
} from "@/lib/broker/credential-attempts";
import {
  type BrokerPlatform,
  createAccount,
  deleteAccount,
  getAccount,
  type MetaApiAccount,
  MetaApiError,
  platformOfVersion,
  undeployAccount,
  updateAccountPassword,
} from "@/lib/broker/metaapi";
import {
  BROKER_ACCOUNT_COLUMNS,
  UNCONFIGURED_STATE,
  loadBrokerAccountRow,
  readBrokerAccountPayload,
  toBrokerAccountPayload,
  type BrokerAccountRow,
} from "@/lib/broker/sync";
import { wait } from "@/lib/http/fetch-with-retry";
import { jsonApiError, PRIVATE_CACHE_HEADERS } from "@/lib/http/json-response";
import { logger } from "@/lib/observability/logger";

/**
 * The trader's one connected MT4/MT5 account. Credentials are typed in OUR app and forwarded
 * to MetaApi on the create call, which validates them synchronously — a wrong investor
 * password comes back here as a 400 within the request, not as a broken deploy hours later.
 * They are never stored or logged by this service; MetaApi holds them from then on and will
 * not disclose them, including to us.
 */

// The create polls MetaApi's broker-settings detection (202 + Retry-After while credentials are
// validated), which can take minutes on a slow broker — the function has to outlive that.
export const maxDuration = 300;

// Releasing a replaced account is retried before giving up to the log: a transient MetaApi blip
// shouldn't leave the old account billing forever, and there is no reconciliation queue to catch
// it later. Short and bounded — this runs inside the request the trader is waiting on.
const DELETE_RELEASE_ATTEMPTS = 3;
const DELETE_RELEASE_BACKOFF_MS = 1_000;

const createSchema = z.object({
  platform: z.enum(["mt4", "mt5"]),
  server: z.string().trim().min(1).max(120),
  // MetaApi: "Trading account number. Only digits are allowed."
  login: z.string().trim().regex(/^\d{1,20}$/),
  password: z.string().min(1).max(64),
});

const passwordSchema = z.object({
  password: z.string().min(1).max(64),
});

/**
 * MetaApi's validation codes, rewritten into short trader-facing copy. Its own messages are
 * long and carry a billing warning meant for us, not for the person holding the phone. These
 * are all input problems — a 400 the form can show inline, not a 502 that reads as our outage.
 */
function credentialErrorResponse(error: MetaApiError): NextResponse | null {
  if (error.status !== 400) return null;
  switch (error.code) {
    case "E_AUTH":
      return jsonApiError(400, "broker_credentials_rejected",
        "Your broker turned that login away. Check the account number, investor password and server.");
    case "E_SRV_NOT_FOUND": {
      const suggestions = error.suggestedServers?.slice(0, 3).join(", ");
      return jsonApiError(400, "broker_server_unknown",
        `We couldn't find that MetaTrader server — check the name on your broker's login screen.${suggestions ? ` Similar: ${suggestions}.` : ""}`);
    }
    case "ERR_OTP_REQUIRED":
      return jsonApiError(400, "broker_otp_required",
        "That account asks for one-time passwords, which broker sync can't use. Turn OTP off in your MetaTrader app or use another account.");
    case "E_PASSWORD_CHANGE_REQUIRED":
      return jsonApiError(400, "broker_password_change_required",
        "Your broker wants this account's password changed first. Change it in MetaTrader, then connect with the new one.");
    case "E_TRADING_ACCOUNT_DISABLED":
      return jsonApiError(400, "broker_account_disabled",
        "Your broker says this account is disabled. Use another account, or ask your broker.");
    case "E_SERVER_TIMEZONE":
      return jsonApiError(400, "broker_settings_unavailable",
        "We couldn't read that broker's settings just now. Try again shortly.");
    case "E_RESOURCE_SLOTS":
      return jsonApiError(400, "broker_capacity",
        "This account needs more capacity than usual to run. Get in touch with us and we'll set it up.");
    default:
      return null;
  }
}

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

/**
 * An old installed app's connect call: {platform, server} and nothing else, because credentials
 * were collected on MetaApi's hosted page back then. Answering it with the generic validation
 * 400 shows a form error on a form that version no longer has — what the trader actually needs
 * is the update prompt, so this shape is detected BEFORE schema validation.
 */
function isLegacyCreateBody(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const shape = body as Record<string, unknown>;
  return (
    typeof shape.platform === "string" &&
    typeof shape.server === "string" &&
    shape.login === undefined &&
    shape.password === undefined
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (isLegacyCreateBody(body)) {
    return jsonApiError(400, "broker_app_update_required",
      "Update the app to connect your broker — connecting now happens right in the app.");
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return jsonApiError(400, "broker_account_invalid", "Check the platform, server, login and investor password.");
  }

  const access = await requireBrokerProSession();
  if (!access.ok) return access.response;

  // MetaApi bills $0.105 for EVERY credential validation, failed ones included, and their docs
  // make app-side rate limiting a condition of the integration — so the attempt budget is spent
  // before anything else, and a throttled attempt does not even reach the dormant read.
  if (!checkCredentialAttempt(access.userId)) {
    return jsonApiError(429, "broker_credential_attempts", "Too many attempts. Wait a few minutes and try again.");
  }

  // Four separate questions, deliberately not collapsed — conflating any two of them is a money
  // bug. `created`: what the catch must delete, or MetaApi bills for an account nothing points at.
  // `claimedRowId`: only a row THIS request inserted, so a failed replace can't delete the
  // trader's existing one. `claimedDormantRowId`: a parked row this request woke — what the catch
  // must re-park rather than delete, and what says the row's stale state needs resetting (set
  // even when there is no old account to release). `targetRowId`: where the result is written.
  // `replacedAccountId`: a live old account to delete afterwards.
  let created: { id: string } | undefined;
  let claimedRowId: string | undefined;
  // A replacement claims an existing parked row instead of inserting one. Unlike a fresh claim,
  // its cleanup must park the row again rather than delete it.
  let claimedDormantRowId: string | undefined;
  let targetRowId: string;
  let replacedAccountId: string | undefined;
  // The row as the commit-point update returned it. Set only once the row points at the new
  // account — which is also what makes the post-commit tail below safe to answer from.
  let writtenRow: BrokerAccountRow | undefined;
  // Whether the durable create budget was actually charged. The reconnect path throws from
  // inside this try without ever reaching it, and refunding then would hand back budget the
  // trader really did spend earlier today.
  let createRecorded = false;

  try {
    // A disconnected trader still HAS their account at MetaApi — parked, not burnt — so
    // reconnecting reuses it for free when it really is the same trading account: same server,
    // same platform AND same login. A different login on the same server is a different account
    // (their funded one replacing the challenge one), which the parked one can never become.
    const dormant = await loadDormantBrokerRow(access.admin, access.userId);
    if (dormant) {
      const live = await readAccountQuietly(dormant.metaapi_account_id);
      // "gone" is MetaApi's certainty that the parked account no longer exists, so there is
      // nothing to match against — it is replaced.
      if (live !== "gone") {
        const match = matchParkedAccount(live, parsed.data);
        if (match === "same") {
          return await reconnect(access.admin, dormant, parsed.data.password, live);
        }
        if (match === "unverifiable") return unverifiableParkedAccount(access.userId);
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
        return alreadyConnected(access.userId);
      }
      // The row is re-pointed at a fresh account below. There is only something to release when
      // the old account still exists — "gone" means MetaApi already released it.
      claimedDormantRowId = dormant.id;
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
        return alreadyConnected(access.userId);
      }
      claimedRowId = (claim as { id: string }).id;
      targetRowId = claimedRowId;
    }

    // The durable $2.10 budget, spent HERE: after the row claim, before the only call that
    // costs anything. Ahead of the claim it would also count the requests that answer "already
    // connected" — a stale client tapping Connect against a live row, which the credential
    // refund beside it exists for — locking a trader out for a day over creates they never made.
    if (!(await claimBrokerCreate(access.admin, access.userId))) throw new CreateBudgetError();
    createRecorded = true;

    // Create BEFORE releasing the old account, never the other way round: a create that fails
    // after the delete would leave the trader with no connection at all and the $2.10 already
    // spent. This ordering means the worst case is one extra account for a moment. The call
    // itself validates the credentials — a bad login throws here as an E_AUTH 400, before any
    // account exists.
    created = await createAccount({
      userId: access.userId,
      platform: parsed.data.platform,
      server: parsed.data.server,
      login: parsed.data.login,
      password: parsed.data.password,
    });

    const { data, error } = await access.admin
      .from("broker_accounts")
      .update({
        metaapi_account_id: created.id,
        // A replacement is a different account, so everything the row remembered about the old
        // one has to go. last_synced_at is the dangerous one: computeSyncWindow starts from it, so
        // leaving it would begin the new account's history at the old account's last sync instead
        // of pulling its 30 days.
        ...(claimedDormantRowId
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

    // ── Commit point ──
    // The row now points at the new account, so the create is COMMITTED and the try ends here.
    // Everything below the catch — the old-account release, the response — must keep what was
    // paid for and can never be rolled back; throwing the final read into the rollback used to
    // delete the NEW account and re-park a row that already referenced it.
    writtenRow = data as BrokerAccountRow;
  } catch (error) {
    // Compensating delete. Adding an account costs $2.10 and it bills from then on, so a paid-for
    // orphan nothing in our database points at must not survive this request. A cleanup that
    // ITSELF fails is the one failure here that stays expensive, so it gets its own log line.
    // (Nothing to delete for a validation 400: the create threw before the account existed.)
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
    // A replacement claim temporarily wakes the parked row to exclude concurrent creates. If
    // validation or creation fails, leave the old account parked so the trader can correct the
    // form and retry; otherwise the row looks connected and every retry 409s.
    if (claimedDormantRowId) {
      await restoreParkedRow(access.admin, claimedDormantRowId);
    }
    // Answered here rather than at the check itself, so the claim taken just before it is
    // handed back by the two blocks above — a plain return would leave the row claimed and
    // 409 every retry, including tomorrow's.
    if (error instanceof CreateBudgetError) return createBudgetSpent(access.userId);
    // A validation 400 is MetaApi refusing the credentials BEFORE any account exists — the same
    // certainty the compensating delete above relies on. That costs $0.105, so it belongs to the
    // attempt budget, not the three-a-day create budget: charging it there would lock a trader
    // out of connecting for a day over three typos.
    if (createRecorded && error instanceof MetaApiError && error.status === 400) {
      await refundBrokerCreate(access.admin, access.userId);
    }
    // A wrong password, an unknown server, OTP — the trader can fix these, so they get their
    // own 400s instead of the generic "our end" 502. Note this fires AFTER the claim release,
    // so the retry the message invites actually works.
    if (error instanceof MetaApiError) {
      const traderError = credentialErrorResponse(error);
      if (traderError) return traderError;
    }
    logger.error("Broker account create failed.", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return jsonApiError(502, "broker_account_create_failed", "Could not connect your broker account right now.");
  }

  // Committed tail. The catch above answers every pre-commit failure, so reaching here means the
  // row points at the new account. Nothing from here on may roll the create back: the release is
  // best-effort, and the final read falls back to a payload built from the row we just wrote
  // rather than failing the request — the trader's connection exists either way.
  const committedRow = writtenRow as BrokerAccountRow;

  // This is the last reference to the old account — the release must not roll the replacement
  // back, whatever happens.
  if (replacedAccountId) {
    await releaseReplacedAccount(replacedAccountId, access.userId);
  }

  // Read back live rather than guessing from the create response: a validated account can come
  // back already DEPLOYED and still be connecting, and only MetaApi knows which.
  return accountResponse(access.admin, access.userId, committedRow);
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
    // forever and the dormant row blocks a fresh create, so the trader could never connect again.
    if (error instanceof MetaApiError && error.status === 404) return "gone";
    logger.warn("Broker reconnect: could not read the parked account; treating it as the same one.", {
      metaapiAccountId: accountId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}

/**
 * Is the account they already have the one they just described? Never guesses in a direction
 * that costs something: "different" DELETES a paid account and its imported history, "same"
 * silently reconnects a broker they may have just left. Since credentials moved in-app the
 * knowledge that separates them includes the LOGIN — same server and platform but a different
 * account number is a different trading account.
 *
 * "unverifiable" is the third answer, and it exists because both of the others are destructive
 * when MetaApi reports no login on a configured account: we cannot then tell this account from
 * any other on the same server and platform. The caller stops there rather than picking.
 */
type ParkedMatch = "same" | "different" | "unverifiable";

function matchParkedAccount(
  live: MetaApiAccount | null,
  picked: { platform: BrokerPlatform; server: string; login: string },
): ParkedMatch {
  const server = live?.server?.trim().toLowerCase();
  const platform = platformOfVersion(live?.version);
  // MetaApi wouldn't describe the account at all. "same" sends this to the reconnect path,
  // which needs the live server name for the password PUT and 502s without touching anything —
  // the non-destructive answer, and the one its tests pin.
  if (!server || !platform) return "same";
  if (server !== picked.server.trim().toLowerCase() || platform !== picked.platform) return "different";
  if (!live?.login) {
    // DRAFT is positive knowledge that this account was never configured — a pre-migration row
    // created credential-less, which the password PUT can never give a login. Useless in this
    // flow, so it is replaced. Any other state with no login is the case above: the field is
    // optional on MetaApi's payload, so its absence proves nothing either way.
    return (live?.state ?? "") === UNCONFIGURED_STATE ? "different" : "unverifiable";
  }
  return live.login.trim() === picked.login ? "same" : "different";
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
 * Answer with the live state, but never let reading it undo what was already done. Every caller
 * reaches this AFTER the paid, committed part succeeded — the create, the reconnect's password
 * PUT, the password update — so a read that throws (the row read behind it is Supabase, and
 * Supabase errors are not swallowed the way MetaApi's are) must not turn a finished operation
 * into a 502. The trader would be told to retry something that already worked, and the natural
 * next move — disconnect and reconnect — destroys a paid account to redo it.
 */
async function accountResponse(admin: SupabaseClient, userId: string, committed: BrokerAccountRow) {
  try {
    return NextResponse.json(
      { account: await readBrokerAccountPayload(admin, userId) },
      { headers: PRIVATE_CACHE_HEADERS },
    );
  } catch (readError) {
    // "linking" is the honest state: MetaApi validated these credentials seconds ago.
    logger.warn("Broker account: live read-back failed; answering from the just-written row.", {
      error: readError instanceof Error ? readError.message : "unknown",
    });
    return NextResponse.json(
      { account: toBrokerAccountPayload(committed, { state: "linking", stateDetail: null }) },
      { headers: PRIVATE_CACHE_HEADERS },
    );
  }
}

/**
 * The one-per-trader answer, identical wherever the claim is lost. Every path here answers
 * without reaching MetaApi, so the attempt claimed up front cost nothing and is handed back —
 * otherwise a trader tapping Connect against a stale row spends their five-attempt budget on
 * requests that were never billable and is locked out for ten minutes.
 */
function alreadyConnected(userId: string) {
  refundCredentialAttempt(userId);
  return jsonApiError(409, "broker_account_exists", "You've already connected an account. Disconnect it first.");
}

/**
 * MetaApi described the parked account but withheld its login, so it cannot be told apart from
 * a different account at the same broker. Both ways out of that are destructive — waking it
 * reconnects a broker they may have just left, replacing it DELETES a paid account and the
 * trades imported from it — so the request stops instead of picking one. The code's own
 * "uncertainty is never destructive" rule, applied to the trader's data rather than the fee.
 *
 * Deliberately not "disconnect it first": the row is already parked, so there is nothing in the
 * app left to press. Someone has to look at the account, and that is what the copy says.
 * Nothing reached MetaApi, so the attempt is handed back.
 */
function unverifiableParkedAccount(userId: string) {
  refundCredentialAttempt(userId);
  return jsonApiError(409, "broker_account_unverified",
    "We can't tell whether that's the account already linked to your profile, and we won't guess with your trade history. Get in touch and we'll clear it.");
}

/** Refused by the durable create budget. Thrown rather than returned so the claim already
 *  taken goes back through the same cleanup every other pre-commit failure uses. */
class CreateBudgetError extends Error {}

/** Three paid creates inside a day. See claimBrokerCreate — the ceiling is deliberately above
 *  anything a real trader does and well below what a loop costs. Nothing was spent on THIS
 *  request, so the credential attempt goes back. */
function createBudgetSpent(userId: string) {
  refundCredentialAttempt(userId);
  return jsonApiError(429, "broker_create_attempts",
    "You've set up a few broker connections today already. Try again tomorrow.");
}

/** Re-park a row whose claim was taken but whose reconnect failed — a fresh timestamp, so the
 *  next corrected attempt can claim it again. Log-only: a failed restore means the trader
 *  retries into a 409, which disconnecting clears. */
async function restoreParkedRow(admin: SupabaseClient, rowId: string) {
  const { error } = await admin
    .from("broker_accounts")
    .update({ disconnected_at: new Date().toISOString() })
    .eq("id", rowId);
  if (error) {
    logger.error("Broker claim restore failed — the trader cannot retry until this row is parked.", {
      rowId,
      error: error.message,
    });
  }
}

/**
 * Clear the rejected-login stamp. Both password paths — the reconnect wake and the PUT recovery —
 * end with this exact write: it is what lets the wake pass deploy the account again, since that
 * pass skips any row still carrying LOGIN_REJECTED_DETAIL.
 *
 * last_synced_at goes with it, for the same reason the replace path nulls both: stampSync writes
 * that column on FAILED syncs too, and computeSyncWindow only distrusts it while last_sync_error
 * is set. Clearing the error alone would leave the next window starting at the last FAILURE —
 * every trade closed while the broker was refusing the login is then never asked for again. It
 * also disarms the 10-minute manual-sync cooldown, which reads the same column, at exactly the
 * moment the trader expects "Sync now" to work. The cost is re-pulling the first-sync window
 * once; the import is idempotent, so that is a page of reads.
 *
 * Best-effort, like the park beside it, and for the same reason: both callers reach here only
 * AFTER MetaApi accepted and billed the new password. Throwing would turn finished paid work
 * into a 502, and the trader's retry buys a second $0.105 validation of a password that is
 * already correct. A failure here costs an automatic sync — the wake pass keeps skipping the
 * row — which a manual "Sync now" (options.manual bypasses that skip) clears without spending.
 */
async function clearRejectionStamp(admin: SupabaseClient, rowId: string, context: string) {
  const { error } = await admin
    .from("broker_accounts")
    .update({ last_sync_error: null, last_synced_at: null })
    .eq("id", rowId);
  if (error) {
    logger.error("Broker rejection stamp not cleared; automatic syncs stay skipped until a manual one.", {
      rowId,
      context,
      error: error.message,
    });
  }
}

/** The last reference to a replaced account. A release failure leaks a parked account
 *  (~$0.77/month), so it is retried a few times before the loud log — but never rolls the
 *  replacement back: the trader is already on the new account. */
async function releaseReplacedAccount(accountId: string, userId: string) {
  let released = false;
  let releaseError: unknown;
  for (let attempt = 1; attempt <= DELETE_RELEASE_ATTEMPTS; attempt += 1) {
    try {
      await deleteAccount(accountId);
      released = true;
      break;
    } catch (error) {
      releaseError = error;
      if (attempt < DELETE_RELEASE_ATTEMPTS) await wait(DELETE_RELEASE_BACKOFF_MS);
    }
  }
  if (!released) {
    logger.error("Broker account replace: old account left behind and still billing.", {
      metaapiAccountId: accountId,
      userId,
      error: releaseError instanceof Error ? releaseError.message : "unknown",
    });
  }
}

/**
 * Wake a parked account instead of buying a new one. Clearing disconnected_at is the whole
 * reconnect — the account still exists at MetaApi — so no create, no $2.10. The password typed
 * now is PUT onto it as part of the wake: a password change is exactly why someone reconnects,
 * and MetaApi validates it synchronously, so a wrong one 400s here with nothing spent.
 *
 * The wake is the same CONDITIONAL claim the replace path uses, and it is taken BEFORE the
 * password PUT: two concurrent reconnects with matching credentials would otherwise both
 * validate and have the second password silently win. Zero rows back means another request
 * already woke the row — the request 409s untouched. A claim whose PUT or stamp then fails
 * re-parks the row (a failed PUT leaves nothing else to undo), or every retry 409s.
 *
 * Needs the live snapshot from the caller: the password PUT wants the server name verbatim,
 * and we don't store it. An unreadable account therefore can't reconnect in this flow — a 502,
 * nothing woken, nothing deleted. "Uncertainty is never destructive" still holds.
 *
 * Only reached when the request MATCHES the parked account (see isSameBrokerAccount). platform
 * and server are deliberately NOT written: they are fixed at MetaApi, so writing them back is
 * what once let the row claim "MT4 connected" over a live MT5 account.
 */
async function reconnect(
  admin: SupabaseClient,
  row: BrokerAccountRow,
  password: string,
  live: MetaApiAccount | null,
) {
  if (!live?.server) {
    throw new MetaApiError(502, "MetaApi did not report the parked account's server.");
  }

  // The claim: `disconnected_at is not null` can only match once, so the loser of a concurrent
  // pair learns it here rather than after paying for a password validation.
  const { data: woken, error: wakeError } = await admin
    .from("broker_accounts")
    .update({ disconnected_at: null })
    .eq("id", row.id)
    .not("disconnected_at", "is", null)
    .select("id");
  if (wakeError) throw new Error(`broker_accounts reconnect claim failed: ${wakeError.message}`);
  if ((woken ?? []).length === 0) {
    return alreadyConnected(row.user_id);
  }

  try {
    await updateAccountPassword({
      accountId: row.metaapi_account_id,
      userId: row.user_id,
      server: live.server,
      password,
    });

    // disconnected_at was cleared by the claim; only the rejected-login stamp remains, and
    // clearing it is what lets the wake pass deploy this account again.
    await clearRejectionStamp(admin, row.id, "reconnect");
  } catch (error) {
    // The claim is ours but the reconnect failed, so the row must be dormant again — a fresh
    // timestamp, the same restore the replacement claim uses — or it looks connected and every
    // corrected retry 409s.
    await restoreParkedRow(admin, row.id);
    throw error;
  }

  // Past the password PUT the reconnect is done and paid for; the fallback row carries both
  // columns the stamp clear just wrote, or the payload reports a last sync the row no longer has.
  return accountResponse(admin, row.user_id, { ...row, last_sync_error: null, last_synced_at: null });
}

/**
 * Replace the investor password on the LIVE connection — the recovery path when the broker
 * starts turning the login away (changed at the broker, typo'd at connect). MetaApi validates
 * the new password synchronously, so a bad one is a 400 here, not another failed sync.
 */
export async function PUT(request: Request) {
  const parsed = passwordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonApiError(400, "broker_account_invalid", "Enter the investor password.");
  }

  // Pro-gated like connect: it exists to get imports running again.
  const access = await requireBrokerProSession();
  if (!access.ok) return access.response;

  // Same attempt budget as POST: this call re-validates credentials at MetaApi, and a failed
  // validation bills $0.105 whether the password was typed by a trader or sprayed by a script.
  if (!checkCredentialAttempt(access.userId)) {
    return jsonApiError(429, "broker_credential_attempts", "Too many attempts. Wait a few minutes and try again.");
  }

  // Only the password PUT below is billable. Everything before it can still fail — a Supabase
  // read that errors, an account MetaApi won't describe, a row still carrying the `pending:`
  // placeholder of a create in flight — and none of those cost $0.105, so none of them may cost
  // the trader an attempt. The flag flips immediately BEFORE the call, not after: a password
  // MetaApi refuses was validated, billed, and keeps its attempt.
  let validated = false;

  try {
    const row = await loadBrokerAccountRow(access.admin, access.userId);
    if (!row) {
      // Nothing was spent — no row means no MetaApi call.
      refundCredentialAttempt(access.userId);
      return jsonApiError(409, "broker_account_missing", "Connect a broker account first.");
    }

    // The PUT needs the server name verbatim and we don't store it — MetaApi has it.
    const live = await getAccount(row.metaapi_account_id);
    if (!live.server) {
      throw new MetaApiError(502, "MetaApi did not report the account's server.");
    }

    validated = true;
    await updateAccountPassword({
      accountId: row.metaapi_account_id,
      userId: access.userId,
      server: live.server,
      password: parsed.data.password,
    });

    // Park it: a deployed terminal keeps hammering the broker with the OLD password until it
    // stops, and the new one only takes effect on the next deploy anyway. Best-effort like the
    // disconnect park — the pull pass sweeps whatever this misses.
    try {
      await undeployAccount(row.metaapi_account_id);
    } catch (parkError) {
      logger.error("Broker park on password update failed; continuing anyway.", {
        metaapiAccountId: row.metaapi_account_id,
        error: parkError instanceof Error ? parkError.message : "unknown",
      });
    }

    // Clearing the rejected stamp is what lets the wake pass deploy this account again — it
    // skips any row still carrying LOGIN_REJECTED_DETAIL.
    await clearRejectionStamp(access.admin, row.id, "password-update stamp");

    // The password is already changed at MetaApi — a failed read-back must not report otherwise,
    // or the trader retries and pays for another validation.
    return accountResponse(access.admin, access.userId, { ...row, last_sync_error: null, last_synced_at: null });
  } catch (error) {
    if (!validated) refundCredentialAttempt(access.userId);
    if (error instanceof MetaApiError) {
      const traderError = credentialErrorResponse(error);
      if (traderError) return traderError;
    }
    logger.error("Broker password update failed.", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return jsonApiError(502, "broker_password_update_failed", "Could not update the investor password right now.");
  }
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
