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
  createPollBudget,
  DEFAULT_RESOURCE_SLOTS,
  deleteAccount,
  getAccount,
  type MetaApiAccount,
  MetaApiError,
  platformOfVersion,
  POLL_COST_MS,
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

// The trader's one connected MT4/MT5 account. Credentials are forwarded to MetaApi on the create
// call, which validates them synchronously; they are never stored or logged by this service.

// The create polls MetaApi's broker-settings detection (202 + Retry-After), which can take minutes
// on a slow broker — the function has to outlive that.
export const maxDuration = 300;

// Releasing a replaced account is retried before giving up to the log: there is no reconciliation
// queue, so a transient blip would otherwise leave the old account billing forever.
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

// MetaApi's validation codes rewritten into trader-facing copy. All input problems, so a 400 the
// form shows inline rather than a 502.
function credentialErrorResponse(error: MetaApiError, userId: string): NextResponse | null {
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
    // Logged here rather than per-caller because every path funnels through it: the create's
    // declines, a re-send MetaApi refuses again, and PUT and reconnect, which never go near
    // createWithCapacity and would otherwise leave no record at all.
    case "E_RESOURCE_SLOTS":
      logger.error("Broker call refused on capacity.", {
        userId,
        recommendedResourceSlots: error.recommendedResourceSlots ?? null,
      });
      return jsonApiError(400, "broker_capacity",
        "This account needs more capacity than usual to run. Get in touch with us and we'll set it up.");
    default:
      return null;
  }
}

// MetaApi sizes the broker's server before it will run an account and refuses one it estimates
// above the slots the create asked for — busy retail brokers routinely land above the default of 1,
// so "get in touch with us" was the answer to an ordinary broker rather than an exotic one. The
// recommendation rides on the 400, so the create is re-sent with it. A create MetaApi refused on
// validation bought nothing: this costs one more credential validation ($0.105) and no join fee.
// Capped, because slots are billed — each one roughly doubles the account's running cost, and
// "whatever MetaApi asked for" is an unbounded bill on a $5/mo trader.
const MAX_RESOURCE_SLOTS = 2;

// Every create is capped to the 202 polls that still fit in the REQUEST — measured from the top
// of POST, because the session read, the dormant read and the row claim all spend from the same
// maxDuration, and a create the platform kills mid-poll never reaches the compensating delete
// below: a $2.10 account deployed and billing with no row pointing at it. POLL_COST_MS is held
// back so that delete still has time to run after a create that used its whole budget.
function pollsLeft(startedAt: number): number {
  const remainingMs = maxDuration * 1_000 - (Date.now() - startedAt);
  return createPollBudget(remainingMs - POLL_COST_MS);
}

/** Exactly one re-send: MetaApi answers with the number it wants, so a second refusal is not a
 *  sizing problem and belongs to the trader-facing message. */
async function createWithCapacity(
  input: {
    userId: string;
    platform: BrokerPlatform;
    server: string;
    login: string;
    password: string;
  },
  /** When the REQUEST started, not this call — both creates are budgeted against the invocation. */
  startedAt: number,
): Promise<{ id: string }> {
  try {
    return await createAccount({
      ...input,
      resourceSlots: DEFAULT_RESOURCE_SLOTS,
      acceptedAttempts: pollsLeft(startedAt),
    });
  } catch (error) {
    // Every other failure belongs to the route's error mapping untouched.
    if (!(error instanceof MetaApiError) || error.status !== 400 || error.code !== "E_RESOURCE_SLOTS") {
      throw error;
    }

    const recommended = error.recommendedResourceSlots;
    const polls = pollsLeft(startedAt);
    // The refusal itself is logged once at the response boundary, by credentialErrorResponse.
    // This is the other half: which gate stopped us fixing it, and on which broker's server —
    // the fields that boundary cannot see. Together they are the record that a capacity refusal
    // used to reach us without, as a screenshot with nothing behind it.
    const decline = (declined: string) => {
      logger.warn("Broker capacity re-send declined.", {
        userId: input.userId,
        server: input.server,
        recommendedResourceSlots: recommended ?? null,
        cap: MAX_RESOURCE_SLOTS,
        declined,
        pollsLeft: polls,
      });
    };

    // "No number we can act on" and "a number we priced out of" are different problems and get
    // different reasons: this field is what tells them apart afterwards, and reporting the cap
    // for a refusal that named nothing would point diagnosis at a ceiling that was never hit.
    if (recommended === undefined || !Number.isInteger(recommended) || recommended <= DEFAULT_RESOURCE_SLOTS) {
      decline("no_recommendation");
      throw error;
    }
    if (recommended > MAX_RESOURCE_SLOTS) {
      decline("past_cap");
      throw error;
    }
    if (polls === 0) {
      decline("no_time_left");
      throw error;
    }
    // Claimed LAST because it consumes: the re-send is a second billable validation, so it takes
    // a second attempt off the budget or the limiter's ceiling is half the real spend it caps.
    // Its own 429 too — "wait a few minutes" is the true answer here, not "contact support".
    if (!checkCredentialAttempt(input.userId)) {
      decline("attempt_budget");
      throw new CredentialAttemptsError();
    }
    // Logged as a standing cost increase for this trader, not as a retry that will be forgotten.
    logger.warn("Broker account needs extra capacity; re-sending the create with MetaApi's number.", {
      userId: input.userId,
      server: input.server,
      resourceSlots: recommended,
      polls,
    });
    return await createAccount({ ...input, resourceSlots: recommended, acceptedAttempts: polls });
  }
}

export async function GET() {
  // NOT Pro-gated: the client renders its Disconnect button off this payload, so gating it hides
  // a lapsed subscriber's own billing connection from them.
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

// An old app's connect call: {platform, server} and nothing else. Detected BEFORE schema
// validation, because that version has no credential form to show a validation 400 on.
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
  // The whole invocation's clock. Every create is budgeted against this rather than against its
  // own entry, because everything below spends from the same maxDuration.
  const startedAt = Date.now();
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

  // MetaApi bills $0.105 for EVERY credential validation, failed ones included, so the attempt
  // budget is spent before anything else. One attempt buys one validation: a capacity re-send is
  // a second one and claims its own inside createWithCapacity.
  if (!checkCredentialAttempt(access.userId)) {
    return tooManyCredentialAttempts();
  }

  // Kept separate on purpose — conflating any two is a money bug.
  /** The paid account the catch must delete, or MetaApi bills for one nothing points at. */
  let created: { id: string } | undefined;
  /** Only a row THIS request inserted, so a failed replace can't delete the trader's existing one. */
  let claimedRowId: string | undefined;
  /** A parked row this request woke: the catch must re-park it, not delete it. */
  let claimedDormantRowId: string | undefined;
  let targetRowId: string;
  let replacedAccountId: string | undefined;
  /** Set only once the row points at the new account — what makes the committed tail safe. */
  let writtenRow: BrokerAccountRow | undefined;
  /** Whether the durable create budget was charged; refunding otherwise hands back real spend. */
  let createRecorded = false;

  try {
    // A disconnected trader still HAS their account at MetaApi, so reconnecting reuses it for free
    // when it is the same trading account: same server, same platform AND same login.
    const dormant = await loadDormantBrokerRow(access.admin, access.userId);
    if (dormant) {
      const live = await readAccountQuietly(dormant.metaapi_account_id);
      // "gone" means the parked account no longer exists, so there is nothing to match against.
      if (live !== "gone") {
        const match = matchParkedAccount(live, parsed.data);
        if (match === "same") {
          return await reconnect(access.admin, dormant, parsed.data.password, live);
        }
        if (match === "unverifiable") return unverifiableParkedAccount(access.userId);
      }
      // Claim the row BEFORE spending. Waking it IS the claim: `disconnected_at is not null` can
      // only match once, so two concurrent POSTs cannot both pay $2.10.
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
      // There is only something to release when the old account still exists.
      claimedDormantRowId = dormant.id;
      replacedAccountId = live === "gone" ? undefined : dormant.metaapi_account_id;
      targetRowId = dormant.id;
    } else {
      // Claim the slot BEFORE spending: the unique index on user_id is the double-provisioning
      // lock — one live account per trader. Check-then-call left a gap two requests both fit
      // through, each paying $2.10. The placeholder id stands until the create returns (NOT NULL).
      const { data: claim, error: claimError } = await access.admin
        .from("broker_accounts")
        .insert({
          user_id: access.userId,
          metaapi_account_id: `pending:${access.userId}`,
          platform: parsed.data.platform,
          // Every sync reads the region off the live snapshot and rewrites this.
          region: null,
        })
        .select("id")
        .single();

      if (claimError || !claim) {
        // The unique violation IS the "already connected" answer, race included. Nothing spent.
        return alreadyConnected(access.userId);
      }
      claimedRowId = (claim as { id: string }).id;
      targetRowId = claimedRowId;
    }

    // createPollBudget's contract, honoured before anything is spent: zero polls means do not
    // start a create at all. Checked ahead of the $2.10 claim so a request with no invocation left
    // costs nothing, and answered by the generic 502 below — which invites the retry that gets a
    // fresh 300 s. Needs a ~210 s prologue to reach, so it is a floor, not a path traders see.
    if (pollsLeft(startedAt) === 0) {
      throw new Error("no invocation time left to start a broker create");
    }

    // The durable $2.10 budget, spent HERE: after the row claim, before the only call that costs
    // anything. Ahead of the claim it would also count requests that answer "already connected".
    if (!(await claimBrokerCreate(access.admin, access.userId))) throw new CreateBudgetError();
    createRecorded = true;

    // Create BEFORE releasing the old account, never the reverse: a create that failed after the
    // delete leaves the trader with no connection and the $2.10 spent. Worst case here is one
    // extra account for a moment. A bad login throws as an E_AUTH 400 before any account exists.
    created = await createWithCapacity(
      {
        userId: access.userId,
        platform: parsed.data.platform,
        server: parsed.data.server,
        login: parsed.data.login,
        password: parsed.data.password,
      },
      startedAt,
    );

    const { data, error } = await access.admin
      .from("broker_accounts")
      .update({
        metaapi_account_id: created.id,
        // A replacement is a different account, so everything the row remembered has to go.
        // computeSyncWindow starts from last_synced_at, so leaving it would begin the new
        // account's history at the old account's last sync instead of pulling its 30 days.
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

    // ── Commit point ── the row points at the new account, so the create can no longer be rolled
    // back. Nothing below the catch may throw into the rollback.
    writtenRow = data as BrokerAccountRow;
  } catch (error) {
    // Compensating delete: an account costs $2.10 and bills from then on, so a paid orphan nothing
    // in our database points at must not survive this request. A cleanup that itself fails is the
    // one failure here that stays expensive, hence its own log line.
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
    // Re-park a row the replacement claim woke, or it looks connected and every retry 409s.
    if (claimedDormantRowId) {
      await restoreParkedRow(access.admin, claimedDormantRowId);
    }
    // Answered here, not at the check, so the claim taken just before it is handed back above.
    if (error instanceof CreateBudgetError) return createBudgetSpent(access.userId);
    // The re-send, not the request, ran out of attempts. "Wait a few minutes" is the true answer;
    // the capacity copy would send them to support over something that clears on its own. It
    // stands for a validation 400, so it refunds the create on the same terms as one.
    if (error instanceof CredentialAttemptsError) {
      if (createRecorded) await refundBrokerCreate(access.admin, access.userId);
      return tooManyCredentialAttempts();
    }
    // A validation 400 is MetaApi refusing credentials BEFORE any account exists. That costs
    // $0.105, so it goes back to the attempt budget rather than the three-a-day create budget.
    if (createRecorded && error instanceof MetaApiError && error.status === 400) {
      await refundBrokerCreate(access.admin, access.userId);
    }
    // Trader-fixable failures get their own 400s. Fires AFTER the claim release, so the retry the
    // message invites actually works.
    if (error instanceof MetaApiError) {
      const traderError = credentialErrorResponse(error, access.userId);
      if (traderError) return traderError;
    }
    logger.error("Broker account create failed.", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return jsonApiError(502, "broker_account_create_failed", "Could not connect your broker account right now.");
  }

  // Committed tail: nothing from here on may roll the create back.
  const committedRow = writtenRow as BrokerAccountRow;

  if (replacedAccountId) {
    await releaseReplacedAccount(replacedAccountId, access.userId);
  }

  // Read back live rather than guessing from the create response: a validated account can come
  // back already DEPLOYED and still be connecting.
  return accountResponse(access.admin, access.userId, committedRow);
}

// Never throws: the caller decides whether to REPLACE a paid account off this, and a read failure
// must not look like "this is a different broker".
async function readAccountQuietly(accountId: string): Promise<MetaApiAccount | "gone" | null> {
  try {
    return await getAccount(accountId);
  } catch (error) {
    // A 404 is certainty, not uncertainty: the account was removed from MetaApi's dashboard.
    // Without this the dormant row blocks a fresh create and the trader can never reconnect.
    if (error instanceof MetaApiError && error.status === 404) return "gone";
    logger.warn("Broker reconnect: could not read the parked account; treating it as the same one.", {
      metaapiAccountId: accountId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}

// Is the parked account the one they just described? "different" DELETES a paid account and its
// imported history; "same" reconnects a broker they may have just left. Match is server, platform
// AND login. "unverifiable" exists because both other answers are destructive when MetaApi reports
// no login on a configured account.
type ParkedMatch = "same" | "different" | "unverifiable";

function matchParkedAccount(
  live: MetaApiAccount | null,
  picked: { platform: BrokerPlatform; server: string; login: string },
): ParkedMatch {
  const server = live?.server?.trim().toLowerCase();
  const platform = platformOfVersion(live?.version);
  // MetaApi wouldn't describe the account. "same" routes to reconnect, which 502s on the missing
  // server name without touching anything — the non-destructive answer.
  if (!server || !platform) return "same";
  if (server !== picked.server.trim().toLowerCase() || platform !== picked.platform) return "different";
  if (!live?.login) {
    // DRAFT is positive knowledge that the account was never configured, and the password PUT can
    // never give it a login. In any other state `login` is optional, so its absence proves nothing.
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

// Every caller reaches this AFTER the paid, committed part succeeded, so a failed read must not
// turn a finished operation into a 502 — the trader's retry would re-pay for it.
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

// The one-per-trader answer, wherever the claim is lost. Nothing reached MetaApi on these paths,
// so the attempt claimed up front is handed back.
function alreadyConnected(userId: string) {
  refundCredentialAttempt(userId);
  return jsonApiError(409, "broker_account_exists", "You've already connected an account. Disconnect it first.");
}

// MetaApi described the parked account but withheld its login, so both ways out are destructive:
// waking it reconnects a broker they may have left, replacing it deletes a paid account and its
// imported trades. The request stops instead. Nothing reached MetaApi, so the attempt goes back.
function unverifiableParkedAccount(userId: string) {
  refundCredentialAttempt(userId);
  return jsonApiError(409, "broker_account_unverified",
    "We can't tell whether that's the account already linked to your profile, and we won't guess with your trade history. Get in touch and we'll clear it.");
}

/** Thrown rather than returned so the claim already taken goes through the normal cleanup. */
class CreateBudgetError extends Error {}

/** The capacity re-send had no attempt left to spend. Thrown from inside the create's own catch,
 *  so by construction it stands for a validation 400 that created nothing. */
class CredentialAttemptsError extends Error {}

/** The rate-limit answer, shared by the two gates and the re-send that runs out mid-request. */
function tooManyCredentialAttempts() {
  return jsonApiError(429, "broker_credential_attempts", "Too many attempts. Wait a few minutes and try again.");
}

/** Three paid creates inside a day (claimBrokerCreate). Nothing was spent on THIS request. */
function createBudgetSpent(userId: string) {
  refundCredentialAttempt(userId);
  return jsonApiError(429, "broker_create_attempts",
    "You've set up a few broker connections today already. Try again tomorrow.");
}

/** Re-park a claimed row whose reconnect failed, so the next corrected attempt can claim it. */
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

// Clears the rejected-login stamp, which is what lets the wake pass deploy the account again.
// last_synced_at is nulled with it: stampSync writes that column on FAILED syncs too, so clearing
// the error alone starts the next window at the last failure and skips every trade closed while
// the broker was refusing the login. It also disarms the 10-minute manual-sync cooldown.
// Best-effort: callers reach here only after MetaApi billed the new password, and throwing would
// make the trader retry into a second $0.105 validation of a password that is already correct.
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

/** Last reference to a replaced account: a leak costs ~$0.77/month, so retry, then log loudly.
 *  Never rolls the replacement back — the trader is already on the new account. */
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

// Wake a parked account instead of buying a new one: no create, no $2.10. The password typed now
// is PUT onto it, and MetaApi validates it synchronously, so a wrong one 400s with nothing spent.
// The conditional wake is the claim and is taken BEFORE the PUT, or two concurrent reconnects both
// validate and the second password silently wins. Zero rows back means someone else woke it.
// Needs the caller's live snapshot: the PUT wants the server name verbatim and we don't store it.
// platform and server are deliberately NOT written back — they are fixed at MetaApi.
async function reconnect(
  admin: SupabaseClient,
  row: BrokerAccountRow,
  password: string,
  live: MetaApiAccount | null,
) {
  if (!live?.server) {
    throw new MetaApiError(502, "MetaApi did not report the parked account's server.");
  }

  // `disconnected_at is not null` matches once, so the loser of a concurrent pair learns it here
  // rather than after paying for a password validation.
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
      resourceSlots: live.resourceSlots ?? DEFAULT_RESOURCE_SLOTS,
    });

    await clearRejectionStamp(admin, row.id, "reconnect");
  } catch (error) {
    // The claim is ours but the reconnect failed, so the row must be dormant again or every
    // corrected retry 409s.
    await restoreParkedRow(admin, row.id);
    throw error;
  }

  // The fallback row carries both columns the stamp clear just wrote, or the payload reports a
  // last sync the row no longer has.
  return accountResponse(admin, row.user_id, { ...row, last_sync_error: null, last_synced_at: null });
}

// Recovery path when the broker starts turning the login away. MetaApi validates the new password
// synchronously, so a bad one is a 400 here, not another failed sync.
export async function PUT(request: Request) {
  const parsed = passwordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonApiError(400, "broker_account_invalid", "Enter the investor password.");
  }

  // Pro-gated like connect: it exists to get imports running again.
  const access = await requireBrokerProSession();
  if (!access.ok) return access.response;

  // Same attempt budget as POST: this re-validates credentials at MetaApi, and a failed validation
  // bills $0.105 whether a trader typed the password or a script sprayed it.
  if (!checkCredentialAttempt(access.userId)) {
    return tooManyCredentialAttempts();
  }

  // Only the password PUT below is billable, so nothing failing before it may cost an attempt.
  // The flag flips immediately BEFORE the call: a password MetaApi refuses was still billed.
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
      // Off the live account, so an upsized one keeps its slots. Nothing stores this by design:
      // MetaApi is the only place it can't drift from what the account actually runs on.
      resourceSlots: live.resourceSlots ?? DEFAULT_RESOURCE_SLOTS,
    });

    // Park it: a deployed terminal keeps hammering the broker with the OLD password, and the new
    // one only takes effect on the next deploy. Best-effort; the pull pass sweeps what this misses.
    try {
      await undeployAccount(row.metaapi_account_id);
    } catch (parkError) {
      logger.error("Broker park on password update failed; continuing anyway.", {
        metaapiAccountId: row.metaapi_account_id,
        error: parkError instanceof Error ? parkError.message : "unknown",
      });
    }

    await clearRejectionStamp(access.admin, row.id, "password-update stamp");

    // The password is already changed at MetaApi, so a failed read-back must not report otherwise
    // or the trader retries and pays for another validation.
    return accountResponse(access.admin, access.userId, { ...row, last_sync_error: null, last_synced_at: null });
  } catch (error) {
    if (!validated) refundCredentialAttempt(access.userId);
    if (error instanceof MetaApiError) {
      const traderError = credentialErrorResponse(error, access.userId);
      if (traderError) return traderError;
    }
    logger.error("Broker password update failed.", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return jsonApiError(502, "broker_password_update_failed", "Could not update the investor password right now.");
  }
}

export async function DELETE() {
  // NOT Pro-gated: a lapsed subscriber must be able to switch off a connection that still costs us.
  const access = await requireBrokerSession();
  if (!access.ok) return access.response;

  try {
    const row = await loadBrokerAccountRow(access.admin, access.userId);
    if (!row) {
      return NextResponse.json({}, { headers: PRIVATE_CACHE_HEADERS });
    }

    // Park it, don't burn it: deleting throws away the $2.10 join fee, so every reconnect would
    // buy the same account again. The row is kept because it remembers which account is theirs.
    // MetaApi failing must NOT block the disconnect; worst case is an account left deployed,
    // which the next pull parks.
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
