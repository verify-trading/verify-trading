import type { SupabaseClient } from "@supabase/supabase-js";

import {
  type BrokerPlatform,
  DEFAULT_METAAPI_REGION,
  deployAccount,
  fetchHistoricalTrades,
  getAccount,
  type MetaStatsTrade,
  undeployAccount,
} from "@/lib/broker/metaapi";
import { type JournalSource } from "@/lib/journal/contracts";
import { logger } from "@/lib/observability/logger";

/**
 * The broker sync engine. Connection state is NEVER stored — a stored copy is wrong the moment a
 * deploy lands or a broker drops the session — so it is derived from MetaApi on every read.
 * ONE cycle, run twice a day: `wake` deploys every parked account, `pull` imports 35 minutes
 * later and parks EVERYTHING. Parked is the resting state. Cost model in docs/broker-sync.md.
 */

export type { BrokerPlatform };
export type BrokerState = "awaiting_config" | "linking" | "ready" | "error";

export type BrokerAccountRow = {
  id: string;
  user_id: string;
  metaapi_account_id: string;
  platform: BrokerPlatform;
  region: string | null;
  last_synced_at: string | null;
  last_sync_error: string | null;
  created_at: string;
};

export const BROKER_ACCOUNT_COLUMNS =
  "id, user_id, metaapi_account_id, platform, region, last_synced_at, last_sync_error, created_at";

/** Exactly the shape the mobile client is coded against. */
export type BrokerAccountPayload = {
  platform: BrokerPlatform;
  state: BrokerState;
  stateDetail: string | null;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
};

export type BrokerSyncResult =
  | { status: "linking" }
  | { status: "imported"; importedDays: number; skippedDays: number };

/** Raised while the trader still has to enter their credentials — the 409 path. */
export class BrokerNotConfiguredError extends Error {
  constructor() {
    super("Finish connecting your account first — open the link we gave you.");
    this.name = "BrokerNotConfiguredError";
  }
}

/** A sync that can't proceed. `message` is written for the trader, not for a log. */
export class BrokerSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrokerSyncError";
  }
}

/**
 * How far the FIRST sync reaches back. Thirty days fills exactly the month the journal's
 * calendar shows, so the feature visibly works the moment a trader connects.
 *
 * Not longer: imported days count in P&L, win rate and streaks, so a quarter of them tells
 * someone they are on a 14-day streak from days they never journaled — and a quarter of
 * broker-currency days can outnumber everything they typed and flip which currency the
 * header total claims. Not shorter either: the window is exclusive of nothing and a trader
 * connecting on a quiet week would land on "Nothing new" after finishing the hosted page.
 */
const FIRST_SYNC_DAYS = 30;
/** Re-syncs start a day before the last one so trades that closed on the boundary fold in. */
const RESYNC_OVERLAP_DAYS = 1;
/** A repeat tap inside this window reports "nothing new": re-importing a parked account re-pays the ~$0.0756 deploy fee. */
const MANUAL_SYNC_COOLDOWN_MS = 10 * 60 * 1000;
/** Covers a slow provisioning start (30 s – 3 min, occasionally longer) without letting a deploy that silently died wedge the account. */
const DEPLOY_CLAIM_TTL_MS = 10 * 60 * 1000;
/** Stop starting accounts before the route's maxDuration (300 s) kills the pass mid-list. */
const PASS_TIME_BUDGET_MS = 280 * 1000;

export type BrokerSnapshot = {
  configured: boolean;
  /** MetaApi TradingAccount.state: CREATED | DEPLOYING | DEPLOYED | UNDEPLOYED | *_FAILED | DRAFT */
  state: string;
  /** CONNECTED | DISCONNECTED | DISCONNECTED_FROM_BROKER */
  connectionStatus: string;
};

const FAILED_STATE_DETAIL: Record<string, string> = {
  DEPLOY_FAILED: "Your account wouldn't start. Disconnect it and connect again.",
  REDEPLOY_FAILED: "Your account wouldn't restart. Disconnect it and connect again.",
  UNDEPLOY_FAILED: "Your account wouldn't stop cleanly. Try syncing again in a few minutes.",
  DELETE_FAILED: "Your account wouldn't disconnect cleanly. Try again in a few minutes.",
};

// Stamped when the broker refuses the login, and read back by the wake pass to skip the account.
// A constant because those two sites have to agree on the exact string.
export const LOGIN_REJECTED_DETAIL =
  "Your broker turned the login away. Check the investor password and reconnect.";

const UNREACHABLE_STATE_DETAIL = "We couldn't check your connection just now. Try again in a minute.";

// How long a brand-new account may sit unreadable before we stop calling it "connecting". Inside
// the window a blip really is provisioning (30 s – 3 min) and the client should keep polling;
// past it a permanently failing read must surface as an error, not "Reaching your broker" forever.
const LINK_GRACE_MS = 5 * 60 * 1000;

const LINK_GAVE_UP_DETAIL =
  "We couldn't finish connecting this account. Disconnect it and try again.";

/**
 * State as the trader would describe it, from a live MetaApi snapshot. Parked is the normal
 * resting state, so it reads `ready` and the connectionStatus left over from the last deploy is
 * ignored while parked; a broken login resurfaces on the next deploy, when it is true again.
 */
export function deriveBrokerState(snapshot: BrokerSnapshot): {
  state: BrokerState;
  stateDetail: string | null;
} {
  if (!snapshot.configured) {
    return { state: "awaiting_config", stateDetail: null };
  }

  const failedDetail = FAILED_STATE_DETAIL[snapshot.state];
  if (failedDetail) {
    return { state: "error", stateDetail: failedDetail };
  }

  if (snapshot.state === "DEPLOYED") {
    if (snapshot.connectionStatus === "CONNECTED") {
      return { state: "ready", stateDetail: null };
    }
    if (snapshot.connectionStatus === "DISCONNECTED_FROM_BROKER") {
      return { state: "error", stateDetail: LOGIN_REJECTED_DETAIL };
    }
    return { state: "linking", stateDetail: null };
  }

  // Every in-flight state reads as linking: none is deployable, and a deployment is billed per
  // attempt whether MetaApi honours it or not. UNDEPLOYING and DELETING are on their way down;
  // DRAFT here means `configured` was true, so MetaApi holds the credentials but has not moved
  // the account out of DRAFT yet.
  if (
    snapshot.state === "DEPLOYING" ||
    snapshot.state === "UNDEPLOYING" ||
    snapshot.state === "DELETING" ||
    snapshot.state === UNCONFIGURED_STATE
  ) {
    return { state: "linking", stateDetail: null };
  }

  return { state: "ready", stateDetail: null };
}

export type BrokerDay = {
  entryDate: string;
  pnl: number;
};

/**
 * The type filter is a WHITELIST, not a blacklist: deposits, withdrawals and adjustments arrive
 * as trade-shaped DEAL_TYPE_BALANCE rows with the cash in `profit`, so letting one through books
 * a deposit as a winning day. `profit` is MetaStats' only P&L field, so a day is gross of costs.
 *
 * ponytail: days are cut on the broker's own close date (broker-local, no offset published), so a
 * trade closing near midnight can land on the neighbouring day. Upgrade: store the offset first.
 */
export function toBrokerDays(trades: MetaStatsTrade[]): BrokerDay[] {
  const byDate = new Map<string, BrokerDay>();

  // Dedupe by trade id: a paging hiccup that repeated a row would silently double that day's
  // P&L. A trade with no id keys on the object itself, so it can't collapse two.
  const unique = new Map(trades.map((trade) => [trade?._id ?? trade, trade]));

  for (const trade of unique.values()) {
    if (trade?.type !== "DEAL_TYPE_BUY" && trade?.type !== "DEAL_TYPE_SELL") continue;
    if (typeof trade.closeTime !== "string" || trade.closeTime.length < 10) continue;

    const entryDate = trade.closeTime.slice(0, 10);
    const day = byDate.get(entryDate) ?? { entryDate, pnl: 0 };
    day.pnl += Number(trade.profit) || 0;
    byDate.set(entryDate, day);
  }

  return [...byDate.values()]
    .map((day) => ({ ...day, pnl: Math.round(day.pnl * 100) / 100 }))
    .sort((a, b) => a.entryDate.localeCompare(b.entryDate));
}

/**
 * The window to ask MetaStats for. A failed attempt also stamps last_synced_at (it is what the
 * deploy-cost cooldown reads), so a row still carrying an error re-pulls the full window instead
 * of trusting that stamp. Re-imports are idempotent, so that costs a page of reads.
 */
export function computeSyncWindow(
  account: Pick<BrokerAccountRow, "last_synced_at" | "last_sync_error">,
  now = new Date(),
): { start: Date; end: Date } {
  const lastSyncedMs = account.last_sync_error ? NaN : Date.parse(account.last_synced_at ?? "");
  const dayMs = 24 * 60 * 60 * 1000;
  // Both branches floor to midnight UTC: starting the first sync at the current time of day would
  // import the oldest day with only its afternoon trades, and that day is never read again.
  const start = Number.isFinite(lastSyncedMs)
    ? new Date(new Date(lastSyncedMs).setUTCHours(0, 0, 0, 0) - RESYNC_OVERLAP_DAYS * dayMs)
    : new Date(new Date(now.getTime() - FIRST_SYNC_DAYS * dayMs).setUTCHours(0, 0, 0, 0));
  // endTime is exclusive and broker clocks run ahead of UTC — end tomorrow so today's trades are
  // never cut off by the offset.
  return { start, end: new Date(now.getTime() + dayMs) };
}

export function toBrokerAccountPayload(
  row: BrokerAccountRow,
  derived: { state: BrokerState; stateDetail: string | null },
): BrokerAccountPayload {
  return {
    platform: row.platform,
    state: derived.state,
    stateDetail: derived.stateDetail,
    lastSyncedAt: row.last_synced_at,
    lastSyncError: row.last_sync_error,
  };
}

// What `POST /users/current/accounts` leaves behind when we create an account with no login, and
// how we know the trader still has the hosted page to finish.
const UNCONFIGURED_STATE = "DRAFT";

/**
 * Live MetaApi view of an account: what it is doing, and whether it has credentials yet.
 *
 * `configured` is read off the account itself, NOT from GET .../configuration-information, which
 * only accepts the hosted page's own short-lived token (see metaapi.ts). Two independent signals,
 * because DRAFT is undocumented in MetaApi's state enum: not DRAFT, or a `login` present. An
 * unknown state errs toward configured — recoverable, unlike stranding the trader on setup.
 */
export async function readBrokerSnapshot(row: Pick<BrokerAccountRow, "metaapi_account_id">) {
  const account = await getAccount(row.metaapi_account_id);
  return {
    account,
    snapshot: {
      configured: (account.state ?? "") !== UNCONFIGURED_STATE || Boolean(account.login),
      state: account.state ?? "",
      connectionStatus: account.connectionStatus ?? "",
    } satisfies BrokerSnapshot,
  };
}

/**
 * The trader's connection exactly as GET /api/broker/account hands it over, or null when they
 * have never connected one. An unreachable MetaApi answers in the one field the trader reads
 * rather than failing the whole screen.
 */
export async function readBrokerAccountPayload(
  supabase: SupabaseClient,
  userId: string,
): Promise<BrokerAccountPayload | null> {
  const row = await loadBrokerAccountRow(supabase, userId);
  if (!row) return null;

  try {
    const { snapshot } = await readBrokerSnapshot(row);
    return toBrokerAccountPayload(row, deriveBrokerState(snapshot));
  } catch (error) {
    logger.warn("broker state read failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    // Before the first import the client polls this every few seconds and a terminal `error`
    // would stop the poll on a blip MetaApi recovers from, so a young account keeps `linking`.
    // After an import the trader has a Sync button, so the honest "we couldn't check" is better —
    // and past the grace window an unreadable new account is broken, not still provisioning.
    if (row.last_synced_at) {
      return toBrokerAccountPayload(row, { state: "error", stateDetail: UNREACHABLE_STATE_DETAIL });
    }
    const createdMs = Date.parse(row.created_at ?? "");
    const past = Number.isFinite(createdMs) && Date.now() - createdMs > LINK_GRACE_MS;
    return past
      ? toBrokerAccountPayload(row, { state: "error", stateDetail: LINK_GAVE_UP_DETAIL })
      : toBrokerAccountPayload(row, { state: "linking", stateDetail: null });
  }
}

/**
 * The trader's LIVE connection, or null. A disconnected account keeps its row — that row is what
 * remembers which MetaApi account is theirs, so reconnecting never re-pays the join fee — but to
 * everything except the reconnect path it must read as "no account connected".
 */
export async function loadBrokerAccountRow(
  supabase: SupabaseClient,
  userId: string,
): Promise<BrokerAccountRow | null> {
  const { data, error } = await supabase
    .from("broker_accounts")
    .select(BROKER_ACCOUNT_COLUMNS)
    .eq("user_id", userId)
    .is("disconnected_at", null)
    .maybeSingle();

  if (error) throw new Error(`broker_accounts read failed: ${error.message}`);
  return (data as BrokerAccountRow | null) ?? null;
}

async function stampSync(
  supabase: SupabaseClient,
  row: BrokerAccountRow,
  patch: { last_sync_error: string | null; region?: string },
) {
  const { error } = await supabase
    .from("broker_accounts")
    .update({ last_synced_at: new Date().toISOString(), ...patch })
    .eq("id", row.id);
  if (error) {
    logger.warn("broker sync stamp failed", { accountRowId: row.id, error: error.message });
  }
}

/**
 * Takes the right to spend a deployment on this account, or reports that someone else holds it.
 * Check and take are ONE conditional update because the app has no lock: the mobile client polls
 * "Sync now" every four seconds while an account provisions, and MetaApi mints a fresh
 * transaction-id per call, so two devices doing that would each pay $0.0756.
 */
async function claimDeploy(supabase: SupabaseClient, row: BrokerAccountRow): Promise<boolean> {
  const cutoff = new Date(Date.now() - DEPLOY_CLAIM_TTL_MS).toISOString();
  const { data, error } = await supabase
    .from("broker_accounts")
    .update({ last_deploy_at: new Date().toISOString() })
    .eq("id", row.id)
    .or(`last_deploy_at.is.null,last_deploy_at.lt.${cutoff}`)
    .select("id");

  if (error) throw new Error(`broker deploy claim failed: ${error.message}`);
  return (data ?? []).length > 0;
}

/**
 * Parking ends a cycle: deployed hours bill at 12x parked, so an account runs from a wake pass to
 * the pull 35 minutes later and no longer. Only pull parks — a wake leaves the account up because
 * the import it was woken for hasn't happened yet.
 */
async function park(metaapiAccountId: string) {
  try {
    await undeployAccount(metaapiAccountId);
  } catch (error) {
    logger.error("broker undeploy failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}

/**
 * Moves one account one step closer to imported. Safe to call repeatedly: it deploys only a
 * parked account and imports only a connected one. `park` is the pull pass saying "put this back
 * to parked whatever state I found it in" — wake and the trader's own "Sync now" pass park:false,
 * because they want the import and the pull sweeps whatever they leave running.
 */
export async function advanceBrokerSync(
  supabase: SupabaseClient,
  row: BrokerAccountRow,
  options: { manual?: boolean; park?: boolean } = {},
): Promise<BrokerSyncResult> {
  // The cooldown stops a repeat tap re-paying the deployment fee, so it only applies after a sync
  // that WORKED: stampSync writes last_synced_at on the failure paths too, so keying on time
  // alone answered a retry-after-failure with "nothing new" and never reached the rejected-login
  // bypass below. Cron passes are governed by their schedule instead.
  if (options.manual && !row.last_sync_error) {
    const lastSyncedMs = Date.parse(row.last_synced_at ?? "");
    if (Number.isFinite(lastSyncedMs) && Date.now() - lastSyncedMs < MANUAL_SYNC_COOLDOWN_MS) {
      return { status: "imported", importedDays: 0, skippedDays: 0 };
    }
  }

  const { account, snapshot } = await readBrokerSnapshot(row);
  const derived = deriveBrokerState(snapshot);

  if (derived.state === "awaiting_config") {
    throw new BrokerNotConfiguredError();
  }

  if (derived.state === "error") {
    // Deployed-but-broken burns hours for nothing, and re-deploying a rejected login is a billed
    // validation failure — park it and make the trader fix the credentials. Neither half of the
    // pair can reject: park swallows its own errors and stampSync only logs.
    const detail = derived.stateDetail ?? "Your broker connection needs attention.";
    await Promise.all([
      stampSync(supabase, row, { last_sync_error: detail }),
      snapshot.state === "DEPLOYED" ? park(row.metaapi_account_id) : undefined,
    ]);
    throw new BrokerSyncError(detail);
  }

  if (derived.state === "linking") {
    // A straggler that never connected is parked by the pull pass rather than paid for until the
    // next one.
    if (options.park) await park(row.metaapi_account_id);
    return { status: "linking" };
  }

  // Parked. The pull pass never wakes one — that fee would buy a cycle that is over — so an
  // account still parked at pull time waits for the next wake.
  if (snapshot.state !== "DEPLOYED") {
    if (options.park) return { status: "imported", importedDays: 0, skippedDays: 0 };
    // A login the broker already turned away will be turned away again, and every wake would pay
    // $0.0756 to prove it. The guard lives HERE, beside the spend, rather than in one caller, so
    // no pass can reach the deploy without it. A manual "Sync now" still goes through, so a
    // trader who fixed things at the broker can retry on demand.
    if (!options.manual && row.last_sync_error === LOGIN_REJECTED_DETAIL) {
      return { status: "linking" };
    }
    // Deployments are billed individually and MetaApi has no idempotency for them, so the claim —
    // not the state read above — is what makes this safe to call in a poll loop.
    if (await claimDeploy(supabase, row)) await deployAccount(row.metaapi_account_id);
    return { status: "linking" };
  }

  const region = account.region ?? row.region ?? DEFAULT_METAAPI_REGION;
  try {
    const window = computeSyncWindow(row);
    const trades = await fetchHistoricalTrades({
      accountId: row.metaapi_account_id,
      region,
      start: window.start,
      end: window.end,
    });
    const days = toBrokerDays(trades);
    const result = await importBrokerDays(supabase, row, days, account.baseCurrency ?? "USD");
    await Promise.all([
      stampSync(supabase, row, { last_sync_error: null, region }),
      options.park ? park(row.metaapi_account_id) : undefined,
    ]);
    return { status: "imported", ...result };
  } catch (error) {
    // last_sync_error is READ BACK TO THE TRADER — the mobile app renders it in an error banner —
    // so only messages written for them go in it. A BrokerSyncError already is one; anything else
    // is a driver string ("journal_entries upsert failed: duplicate key value…") that means
    // nothing to them and leaks our internals. The real text still reaches the log below.
    const message =
      error instanceof BrokerSyncError
        ? error.message
        : "That sync didn't finish. We'll try again on the next one.";
    if (!(error instanceof BrokerSyncError)) {
      logger.error("Broker import failed.", {
        accountRowId: row.id,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
    await Promise.all([
      stampSync(supabase, row, { last_sync_error: message, region }),
      options.park ? park(row.metaapi_account_id) : undefined,
    ]);
    throw error;
  }
}

/**
 * Which of these owners hold Pro right now — `profiles.tier`, the same entitlement hasProAccess
 * gates the API on, asked once for the whole list. Fails closed the same way: no row, no Pro.
 */
async function readProUserIds(supabase: SupabaseClient, rows: BrokerAccountRow[]): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .in("id", rows.map((row) => row.user_id))
    .eq("tier", "pro");

  if (error) throw new Error(`profiles read failed: ${error.message}`);
  return new Set((data ?? []).map((profile) => (profile as { id: string }).id));
}

/**
 * One scheduled pass over every connected account (the schedule itself lives in
 * supabase/migration_29_broker_cron.sql): `wake` at 06:00 / 18:00 UTC deploys every parked
 * account whose owner is Pro, `pull` 35 minutes later imports from whatever connected and parks
 * EVERYTHING. The 35 minutes is headroom, not a measurement — an account that consistently takes
 * longer misses the cron imports and relies on the trader's own "Sync now", which is accepted.
 * Per-account failures are collected, not thrown: one broken login can't stop the pass.
 */
export async function runBrokerSyncPass(
  supabase: SupabaseClient,
  pass: "wake" | "pull",
): Promise<{ accounts: number; results: string[]; errors: string[] }> {
  const startedAt = Date.now();
  // Live connections only: a disconnected account's row is kept solely so a reconnect can reuse
  // it, so waking it would deploy — and bill for — an account its owner has switched off.
  const { data, error } = await supabase
    .from("broker_accounts")
    .select(BROKER_ACCOUNT_COLUMNS)
    .is("disconnected_at", null);
  if (error) throw new Error(`broker_accounts read failed: ${error.message}`);

  const rows = (data ?? []) as BrokerAccountRow[];
  const results: string[] = [];
  const errors: string[] = [];

  // Only wake spends, so only wake asks who is paying — and it FAILS CLOSED: a transient profiles
  // error throws out of the whole pass, deploying nobody, rather than treating an unknown tier as
  // Pro and billing a deployment per lapsed trader. pull deliberately never asks: parking is the
  // whole point of it and has to run for everyone. The price is bounded — a trader who lapses
  // between a manual "Sync now" and that evening's pull gets ONE more import, and their next
  // manual sync is already 403'd by the route's gate.
  const proUserIds = pass === "wake" && rows.length > 0 ? await readProUserIds(supabase, rows) : null;

  // ponytail: sequential — one connected account per Pro trader, and MetaApi rate-limits
  // on CPU credits. Batch with Promise.all in chunks if this ever runs past ~50 accounts.
  for (const [index, row] of rows.entries()) {
    // One account can walk 100 pages of history and the route caps the pass at 300 s. The
    // abandoned tail is left as it is: worst case is ≤12 h of deployed hours, because the next
    // pull parks it anyway.
    if (Date.now() - startedAt > PASS_TIME_BUDGET_MS) {
      errors.push(`pass_budget_exhausted:${rows.length - index}`);
      break;
    }

    if (pass === "wake") {
      // Pro lapsed: stop costing us anything beyond parked rent and stop importing into a journal
      // they no longer pay for. Nothing is deleted, so resubscribing starts it running again with
      // no reconnect and no new fee.
      if (!proUserIds?.has(row.user_id)) {
        results.push(`${row.id}:skipped_not_pro`);
        continue;
      }

      // Refused inside advanceBrokerSync as well, beside the deployment it would pay for — that
      // is the real guard; skipping here only saves the state read.
      if (row.last_sync_error === LOGIN_REJECTED_DETAIL) {
        results.push(`${row.id}:skipped_login_rejected`);
        continue;
      }
    }

    try {
      const result = await advanceBrokerSync(supabase, row, {
        manual: false,
        // pull owns the cost: it is the one pass that parks, connected or not.
        park: pass === "pull",
      });
      results.push(
        result.status === "imported"
          ? `${row.id}:imported:${result.importedDays}/${result.skippedDays}`
          : `${row.id}:linking`,
      );
    } catch (accountError) {
      // The throw could have come from the state read, the import, anything — the account may well
      // be deployed right now, so pull parks it here too rather than leaving it running until the
      // next pull. park() swallows its own failures.
      if (pass === "pull") await park(row.metaapi_account_id);

      const message =
        accountError instanceof BrokerNotConfiguredError
          ? "awaiting_config"
          : accountError instanceof Error
            ? accountError.message
            : "unknown";
      errors.push(`${row.id}:${message}`);
    }
  }

  return { accounts: rows.length, results, errors };
}

/**
 * Writes imported days into journal_entries, the same one-row-per-day table the trader's own
 * sessions use, so the calendar, aggregates and streaks pick them up unchanged.
 *
 * NEVER reads first: a read-then-write leaves a gap for a manual save to land in, and the write
 * behind it would clobber the trader's numbers and relabel the row source='broker' for good. Both
 * statements are conditional in the database instead: insert-if-absent, then rewrite only ours.
 */
async function importBrokerDays(
  supabase: SupabaseClient,
  row: BrokerAccountRow,
  days: BrokerDay[],
  currency: string,
): Promise<{ importedDays: number; skippedDays: number }> {
  if (days.length === 0) return { importedDays: 0, skippedDays: 0 };

  // ignoreDuplicates leaves every existing row exactly as it is, whoever owns it, and returns the
  // ones it actually inserted — which is also how we learn which days were already there without
  // a separate read. A day the trader DELETED is soft-deleted, so its row still exists and this
  // skips it for free: that is what keeps a deleted day deleted.
  const { data: inserted, error } = await supabase
    .from("journal_entries")
    .upsert(
      days.map((day) => ({
        user_id: row.user_id,
        entry_date: day.entryDate,
        // mood is NOT NULL and is the trader's own read on the day — we don't guess it from the
        // P&L. The moment they edit the day the row becomes theirs and we stop writing to it.
        mood: "okay",
        pnl_amount: day.pnl,
        // The broker reports in the account's base currency, not the journal default.
        pnl_currency: currency,
        source: "broker" satisfies JournalSource,
      })),
      { onConflict: "user_id,entry_date", ignoreDuplicates: true },
    )
    .select("entry_date");
  if (error) {
    throw new Error(`journal_entries upsert failed: ${error.message}`);
  }

  const insertedDates = new Set((inserted ?? []).map((entry) => (entry as { entry_date: string }).entry_date));
  const existing = days.filter((day) => !insertedDates.has(day.entryDate));

  // Days that already had a row. `source='broker'` in the WHERE is the whole guard: a day the
  // trader typed matches nothing and is left alone, and a day we imported before is rewritten,
  // which is how a boundary day picks up trades that closed after the last run. One statement per
  // day because each carries its own P&L; in steady state that is the single overlap day.
  const rewritten = await Promise.all(
    existing.map(async (day) => {
      const { data: updated, error: updateError } = await supabase
        .from("journal_entries")
        .update({ pnl_amount: day.pnl, pnl_currency: currency })
        .eq("user_id", row.user_id)
        .eq("entry_date", day.entryDate)
        .eq("source", "broker" satisfies JournalSource)
        // A day the trader deleted keeps its row so the insert above skips it; this stops the
        // rewrite branch quietly refreshing that row's P&L and counting it as imported.
        .is("deleted_at", null)
        .select("entry_date");
      if (updateError) {
        throw new Error(`journal_entries update failed: ${updateError.message}`);
      }
      return (updated ?? []).length > 0;
    }),
  );

  return {
    importedDays: insertedDates.size + rewritten.filter(Boolean).length,
    skippedDays: rewritten.filter((ours) => !ours).length,
  };
}
