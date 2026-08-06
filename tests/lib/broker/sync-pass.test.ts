import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/broker/metaapi", () => ({
  getAccount: vi.fn(),
  deployAccount: vi.fn(),
  undeployAccount: vi.fn(),
  fetchHistoricalTrades: vi.fn(),
  DEFAULT_METAAPI_REGION: "london",
}));

vi.mock("@/lib/observability/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  deployAccount,
  fetchHistoricalTrades,
  getAccount,
  undeployAccount,
} from "@/lib/broker/metaapi";
import { LOGIN_REJECTED_DETAIL, readBrokerSnapshot, runBrokerSyncPass } from "@/lib/broker/sync";

function accountRow(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    user_id: `user-${id}`,
    metaapi_account_id: `meta-${id}`,
    platform: "mt5",
    region: "london",
    last_synced_at: null,
    last_sync_error: null,
    ...overrides,
  };
}

type Result = { data?: unknown; error?: unknown };

/** Chainable thenable: every builder method returns itself, awaiting it gives `result`. */
function builder(result: Result) {
  const chain = {} as Record<string, unknown> & PromiseLike<unknown>;
  for (const method of ["select", "eq", "is", "not", "or", "in", "update", "upsert"]) {
    (chain as Record<string, unknown>)[method] = () => chain;
  }
  chain.then = (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected);
  return chain;
}

/**
 * The pass reads broker_accounts, batch-reads profiles on the wake pass, and stamps
 * rows back; all of them only read `data`/`error` off the awaited builder. `profiles`
 * defaults to "every owner holds Pro", so a test only says otherwise when that is the
 * point of the test.
 */
function fakeSupabase(accounts: Result, profiles?: Result) {
  const rows = (accounts.data ?? []) as Array<{ user_id: string }>;
  const pro = profiles ?? { data: rows.map((row) => ({ id: row.user_id })), error: null };
  return {
    from: vi.fn((table: string) => builder(table === "profiles" ? pro : accounts)),
  } as unknown as SupabaseClient;
}

/** MetaApi state per account id, so one pass can mix healthy and broken traders. */
function mockMetaApi(states: Record<string, { state: string; connectionStatus: string }>) {
  vi.mocked(getAccount).mockImplementation(async (accountId: string) => {
    const entry = states[accountId];
    if (!entry) throw new Error(`MetaApi is having a day (${accountId})`);
    return { _id: accountId, state: entry.state, connectionStatus: entry.connectionStatus, region: "london" };
  });
}

describe("runBrokerSyncPass", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchHistoricalTrades).mockResolvedValue([]);
  });

  it("wakes every parked account on the wake pass", async () => {
    const supabase = fakeSupabase({ data: [accountRow("row-1"), accountRow("row-2")], error: null });
    mockMetaApi({
      "meta-row-1": { state: "UNDEPLOYED", connectionStatus: "DISCONNECTED" },
      "meta-row-2": { state: "UNDEPLOYED", connectionStatus: "DISCONNECTED" },
    });

    const outcome = await runBrokerSyncPass(supabase, "wake");

    expect(outcome).toEqual({ accounts: 2, results: ["row-1:linking", "row-2:linking"], errors: [] });
    expect(deployAccount).toHaveBeenCalledTimes(2);
    // The pull 35 minutes later owns the parking; a wake that parked would throw away the
    // deployment it just paid for.
    expect(undeployAccount).not.toHaveBeenCalled();
  });

  it("leaves stragglers running on the wake pass — pull owns the cost", async () => {
    const supabase = fakeSupabase({ data: [accountRow("row-1")], error: null });
    mockMetaApi({ "meta-row-1": { state: "DEPLOYED", connectionStatus: "DISCONNECTED" } });

    const outcome = await runBrokerSyncPass(supabase, "wake");

    expect(outcome.results).toEqual(["row-1:linking"]);
    expect(undeployAccount).not.toHaveBeenCalled();
  });

  it("does not deploy for a trader whose Pro has lapsed", async () => {
    // Nobody in profiles holds Pro any more.
    const supabase = fakeSupabase({ data: [accountRow("row-1")], error: null }, { data: [], error: null });
    mockMetaApi({ "meta-row-1": { state: "UNDEPLOYED", connectionStatus: "DISCONNECTED" } });

    const outcome = await runBrokerSyncPass(supabase, "wake");

    expect(outcome.results).toEqual(["row-1:skipped_not_pro"]);
    expect(deployAccount).not.toHaveBeenCalled();
    expect(getAccount).not.toHaveBeenCalled();
  });

  it("deploys again once they resubscribe", async () => {
    const supabase = fakeSupabase(
      { data: [accountRow("row-1")], error: null },
      { data: [{ id: "user-row-1" }], error: null },
    );
    mockMetaApi({ "meta-row-1": { state: "UNDEPLOYED", connectionStatus: "DISCONNECTED" } });

    const outcome = await runBrokerSyncPass(supabase, "wake");

    expect(outcome.results).toEqual(["row-1:linking"]);
    expect(deployAccount).toHaveBeenCalledWith("meta-row-1");
  });

  it("skips a broker-rejected login on the wake pass rather than paying to prove it", async () => {
    const supabase = fakeSupabase({
      data: [accountRow("row-1", { last_sync_error: LOGIN_REJECTED_DETAIL }), accountRow("row-2")],
      error: null,
    });
    mockMetaApi({
      "meta-row-1": { state: "UNDEPLOYED", connectionStatus: "DISCONNECTED" },
      "meta-row-2": { state: "UNDEPLOYED", connectionStatus: "DISCONNECTED" },
    });

    const outcome = await runBrokerSyncPass(supabase, "wake");

    expect(outcome.results).toEqual(["row-1:skipped_login_rejected", "row-2:linking"]);
    // Not even a state read for the dead one, let alone a billed deployment.
    expect(getAccount).not.toHaveBeenCalledWith("meta-row-1");
    expect(deployAccount).toHaveBeenCalledTimes(1);
    expect(deployAccount).toHaveBeenCalledWith("meta-row-2");
  });

  it("skips the legacy pre-migration rejection wording the same way", async () => {
    // Rows stamped before the copy change carry "...Check the investor password and reconnect."
    // Matching by equality misses them, and every wake would re-pay $0.0756 to prove a login
    // the broker already refused.
    const legacyRejection = "Your broker turned the login away. Check the investor password and reconnect.";
    const supabase = fakeSupabase({
      data: [accountRow("row-1", { last_sync_error: legacyRejection })],
      error: null,
    });
    mockMetaApi({ "meta-row-1": { state: "UNDEPLOYED", connectionStatus: "DISCONNECTED" } });

    const outcome = await runBrokerSyncPass(supabase, "wake");

    expect(outcome.results).toEqual(["row-1:skipped_login_rejected"]);
    expect(getAccount).not.toHaveBeenCalled();
    expect(deployAccount).not.toHaveBeenCalled();
  });

  // Wake is the pass that SPENDS, so an unreadable tier must stop it dead. Treating an
  // unknown tier as Pro would bill a deployment for every lapsed trader on the list.
  it("throws on the wake pass when the Pro read fails, and deploys nobody", async () => {
    const supabase = fakeSupabase(
      { data: [accountRow("row-1"), accountRow("row-2")], error: null },
      { data: null, error: { message: "connection refused" } },
    );
    mockMetaApi({
      "meta-row-1": { state: "UNDEPLOYED", connectionStatus: "DISCONNECTED" },
      "meta-row-2": { state: "UNDEPLOYED", connectionStatus: "DISCONNECTED" },
    });

    await expect(runBrokerSyncPass(supabase, "wake")).rejects.toThrow(/profiles read failed/);
    expect(deployAccount).not.toHaveBeenCalled();
    expect(getAccount).not.toHaveBeenCalled();
  });

  it("imports and parks everything on the pull pass, straggler included", async () => {
    const supabase = fakeSupabase({ data: [accountRow("row-1"), accountRow("row-2")], error: null });
    mockMetaApi({
      "meta-row-1": { state: "DEPLOYED", connectionStatus: "CONNECTED" },
      // Still shaking hands with the broker 35 minutes on — a straggler.
      "meta-row-2": { state: "DEPLOYED", connectionStatus: "DISCONNECTED" },
    });

    const outcome = await runBrokerSyncPass(supabase, "pull");

    expect(outcome.results).toEqual(["row-1:imported:0/0", "row-2:linking"]);
    expect(undeployAccount).toHaveBeenCalledWith("meta-row-1");
    expect(undeployAccount).toHaveBeenCalledWith("meta-row-2");
  });

  it("never opens a deployment on the pull pass", async () => {
    const supabase = fakeSupabase({ data: [accountRow("row-1")], error: null });
    // Never connected, or connected after the wake — either way it is parked right now.
    mockMetaApi({ "meta-row-1": { state: "UNDEPLOYED", connectionStatus: "DISCONNECTED" } });

    const outcome = await runBrokerSyncPass(supabase, "pull");

    // That fee would buy a cycle that is over — it waits for the next wake.
    expect(outcome.results).toEqual(["row-1:imported:0/0"]);
    expect(outcome.errors).toEqual([]);
    expect(deployAccount).not.toHaveBeenCalled();
    expect(undeployAccount).not.toHaveBeenCalled();
  });

  // pull does not read profiles at all: parking has to happen for everyone, and a trader who
  // lapsed since their last manual sync gets exactly this ONE bounded import before parking.
  it("parks a lapsed trader's account on the pull pass without asking who is Pro", async () => {
    const supabase = fakeSupabase({ data: [accountRow("row-1")], error: null }, { data: [], error: null });
    mockMetaApi({ "meta-row-1": { state: "DEPLOYED", connectionStatus: "CONNECTED" } });

    const outcome = await runBrokerSyncPass(supabase, "pull");

    expect(outcome.results).toEqual(["row-1:imported:0/0"]);
    expect(undeployAccount).toHaveBeenCalledWith("meta-row-1");
  });

  it("parks an account whose sync threw, so a pull failure can't leave it billing", async () => {
    const supabase = fakeSupabase({ data: [accountRow("row-1")], error: null });
    // MetaApi refuses the state read — the account may well be deployed right now.
    mockMetaApi({});

    const outcome = await runBrokerSyncPass(supabase, "pull");

    expect(outcome.errors).toHaveLength(1);
    expect(undeployAccount).toHaveBeenCalledWith("meta-row-1");
  });

  it("leaves a failed account alone on the wake pass — only pull parks", async () => {
    const supabase = fakeSupabase({ data: [accountRow("row-1")], error: null });
    mockMetaApi({});

    await runBrokerSyncPass(supabase, "wake");

    expect(undeployAccount).not.toHaveBeenCalled();
  });

  it("collects per-account failures instead of stopping the pass", async () => {
    const supabase = fakeSupabase({
      data: [accountRow("row-1"), accountRow("row-2"), accountRow("row-3")],
      error: null,
    });
    mockMetaApi({
      // Never finished the config link: DRAFT with no `login` IS the unconfigured case.
      "meta-row-1": { state: "DRAFT", connectionStatus: "DISCONNECTED" },
      // meta-row-2 is absent: MetaApi refuses to answer for it at all.
      "meta-row-3": { state: "UNDEPLOYED", connectionStatus: "DISCONNECTED" },
    });

    const outcome = await runBrokerSyncPass(supabase, "wake");

    expect(outcome.accounts).toBe(3);
    expect(outcome.errors).toEqual(["row-1:awaiting_config", "row-2:MetaApi is having a day (meta-row-2)"]);
    // The trader behind row-3 still gets their sync.
    expect(outcome.results).toEqual(["row-3:linking"]);
    expect(deployAccount).toHaveBeenCalledWith("meta-row-3");
  });

  it("throws when the account list itself can't be read", async () => {
    const supabase = fakeSupabase({ data: null, error: { message: "connection refused" } });

    await expect(runBrokerSyncPass(supabase, "wake")).rejects.toThrow(/broker_accounts read failed/);
    expect(getAccount).not.toHaveBeenCalled();
  });
});

/**
 * The setup gate. DRAFT is the documented credential-less state but it is ABSENT from
 * MetaApi's TradingAccount state enum, so `login` is read as a second, independent signal —
 * these two cases are what stop the gate resting on one undocumented string.
 */
describe("readBrokerSnapshot", () => {
  const row = { metaapi_account_id: "meta-1" };

  it("reads a credential-less DRAFT account as unconfigured", async () => {
    vi.mocked(getAccount).mockResolvedValue({ _id: "meta-1", state: "DRAFT", connectionStatus: "DISCONNECTED" });

    const { snapshot } = await readBrokerSnapshot(row);

    expect(snapshot.configured).toBe(false);
  });

  it("reads a DRAFT account that has a login as configured", async () => {
    // The hosted page is what fills `login`, so its presence means the trader finished —
    // whatever MetaApi has decided to call the state by then.
    vi.mocked(getAccount).mockResolvedValue({
      _id: "meta-1",
      state: "DRAFT",
      connectionStatus: "DISCONNECTED",
      login: "5104729",
    });

    const { snapshot } = await readBrokerSnapshot(row);

    expect(snapshot.configured).toBe(true);
  });
});
