import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/broker/metaapi", () => ({
  createAccount: vi.fn(),
  updateAccountPassword: vi.fn(),
  deleteAccount: vi.fn(),
  getAccount: vi.fn(),
  deployAccount: vi.fn(),
  undeployAccount: vi.fn(),
  fetchHistoricalTrades: vi.fn(),
  DEFAULT_METAAPI_REGION: "london",
  MetaApiError: class MetaApiError extends Error {},
}));

vi.mock("@/lib/observability/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { POST } from "@/app/api/broker/sync/route";
import { getSessionUser } from "@/lib/auth/session";
import {
  deployAccount,
  fetchHistoricalTrades,
  getAccount,
  undeployAccount,
} from "@/lib/broker/metaapi";

import { createQueryBuilder, mockAdmin, mockSession } from "./harness";

const ACCOUNT_ROW = {
  id: "row-1",
  user_id: "user-1",
  metaapi_account_id: "meta-1",
  platform: "mt5",
  region: "london",
  last_synced_at: null,
  last_sync_error: null,
};

// `configured` is derived from the state (DRAFT with no login) rather than fetched separately, so
// "DRAFT" below IS the unconfigured case.
function mockMetaApiAccount(state: string, connectionStatus: string) {
  vi.mocked(getAccount).mockResolvedValue({
    _id: "meta-1",
    state,
    connectionStatus,
    region: "london",
    baseCurrency: "USD",
  });
}

/** The account row read, then the stampSync write behind it — every sync that gets that far. */
const rowThenStamp = () => [
  createQueryBuilder({ data: ACCOUNT_ROW, error: null }),
  createQueryBuilder({ error: null }),
];

describe("POST /api/broker/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("401s a signed-out caller", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null as never);

    const response = await POST();

    expect(response.status).toBe(401);
  });

  it("403s a free trader before spending a deployment", async () => {
    mockSession("free");
    mockAdmin({});

    const response = await POST();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "broker_pro_required",
      message: "Broker sync is a Pro feature.",
    });
    expect(deployAccount).not.toHaveBeenCalled();
  });

  it("409s when no account is connected yet", async () => {
    mockSession();
    mockAdmin({ broker_accounts: [createQueryBuilder({ data: null, error: null })] });

    const response = await POST();

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "broker_account_missing",
      message: "Connect a broker account first.",
    });
  });

  it("409s while the trader still has to enter their credentials", async () => {
    mockSession();
    mockAdmin({ broker_accounts: [createQueryBuilder({ data: ACCOUNT_ROW, error: null })] });
    mockMetaApiAccount("DRAFT", "DISCONNECTED");

    const response = await POST();
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.error).toBe("broker_awaiting_config");
    expect(json.message).toBeTruthy();
    expect(deployAccount).not.toHaveBeenCalled();
  });

  it("deploys a parked account and reports linking", async () => {
    mockSession();
    const claim = createQueryBuilder({ data: [{ id: "row-1" }], error: null });
    mockAdmin({ broker_accounts: [createQueryBuilder({ data: ACCOUNT_ROW, error: null }), claim] });
    mockMetaApiAccount("UNDEPLOYED", "DISCONNECTED");

    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "linking" });
    expect(deployAccount).toHaveBeenCalledWith("meta-1");
    // The claim is a conditional write, not a read: taking the lock IS the check.
    expect(claim.update).toHaveBeenCalledWith(expect.objectContaining({ last_deploy_at: expect.any(String) }));
    expect(claim.or).toHaveBeenCalledWith(expect.stringContaining("last_deploy_at.is.null"));
  });

  it("does not deploy when another poll already claimed the deployment", async () => {
    mockSession();
    // The conditional update matched no row: someone deployed inside the lock window.
    const claim = createQueryBuilder({ data: [], error: null });
    mockAdmin({ broker_accounts: [createQueryBuilder({ data: ACCOUNT_ROW, error: null }), claim] });
    mockMetaApiAccount("UNDEPLOYED", "DISCONNECTED");

    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "linking" });
    // Two devices polling every 4s would otherwise pay the fee twice.
    expect(deployAccount).not.toHaveBeenCalled();
  });

  it("does not deploy again inside the cooldown — a deployment is billed", async () => {
    mockSession();
    mockAdmin({
      broker_accounts: [
        createQueryBuilder({
          data: { ...ACCOUNT_ROW, last_synced_at: new Date(Date.now() - 60_000).toISOString() },
          error: null,
        }),
      ],
    });

    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "imported", importedDays: 0, skippedDays: 0 });
    expect(getAccount).not.toHaveBeenCalled();
    expect(deployAccount).not.toHaveBeenCalled();
  });

  it("imports a connected account and skips the day the trader typed", async () => {
    mockSession();
    // Statement 1 inserts only the day that had no row yet and reports it back;
    // statement 2 tries to rewrite the day that did, and matches nothing because the
    // trader owns it.
    const journalInsert = createQueryBuilder({ data: [{ entry_date: "2026-07-02" }], error: null });
    const journalRewrite = createQueryBuilder({ data: [], error: null });
    mockAdmin({ broker_accounts: rowThenStamp(), journal_entries: [journalInsert, journalRewrite] });
    mockMetaApiAccount("DEPLOYED", "CONNECTED");
    vi.mocked(fetchHistoricalTrades).mockResolvedValue([
      {
        _id: "meta-1+1",
        accountId: "meta-1",
        type: "DEAL_TYPE_BUY",
        profit: 120,
        closeTime: "2026-07-01 09:30:00.000",
      },
      {
        _id: "meta-1+2",
        accountId: "meta-1",
        type: "DEAL_TYPE_SELL",
        profit: -20.5,
        closeTime: "2026-07-02 11:00:00.000",
      },
      // A deposit — must never land in the journal as a winning day.
      {
        _id: "meta-1+3",
        accountId: "meta-1",
        type: "DEAL_TYPE_BALANCE",
        profit: 5000,
        closeTime: "2026-07-02 12:00:00.000",
      },
    ]);

    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "imported", importedDays: 1, skippedDays: 1 });
    // Every day goes into one insert-if-absent — no read first, so a manual save can't
    // land in a gap and be overwritten. Note the rows carry no trade_details blob.
    expect(journalInsert.upsert).toHaveBeenCalledWith(
      [
        { user_id: "user-1", entry_date: "2026-07-01", mood: "okay", pnl_amount: 120, pnl_currency: "USD", source: "broker" },
        { user_id: "user-1", entry_date: "2026-07-02", mood: "okay", pnl_amount: -20.5, pnl_currency: "USD", source: "broker" },
      ],
      { onConflict: "user_id,entry_date", ignoreDuplicates: true },
    );
    // The day that already existed is only rewritten where the row is ours.
    expect(journalRewrite.update).toHaveBeenCalledWith({ pnl_amount: 120, pnl_currency: "USD" });
    expect(journalRewrite.eq).toHaveBeenCalledWith("source", "broker");
    // A manual sync never parks: the next pull pass sweeps whatever it leaves running.
    expect(undeployAccount).not.toHaveBeenCalled();
    // And an already-deployed account is never re-deployed: deployments are billed.
    expect(deployAccount).not.toHaveBeenCalled();
  });

  it("rewrites a day it imported before, so boundary-day trades update", async () => {
    mockSession();
    // Nothing inserted (the day already has a row), and the guarded update matched it —
    // so it was ours to rewrite.
    const journalInsert = createQueryBuilder({ data: [], error: null });
    const journalRewrite = createQueryBuilder({ data: [{ entry_date: "2026-07-01" }], error: null });
    mockAdmin({ broker_accounts: rowThenStamp(), journal_entries: [journalInsert, journalRewrite] });
    mockMetaApiAccount("DEPLOYED", "CONNECTED");
    vi.mocked(fetchHistoricalTrades).mockResolvedValue([
      {
        _id: "meta-1+1",
        accountId: "meta-1",
        type: "DEAL_TYPE_BUY",
        profit: 45,
        closeTime: "2026-07-01 23:50:00.000",
      },
    ]);

    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "imported", importedDays: 1, skippedDays: 0 });
  });

  it("leaves the account running when a manual import fails — the next pull sweeps it", async () => {
    mockSession();
    mockAdmin({ broker_accounts: rowThenStamp() });
    mockMetaApiAccount("DEPLOYED", "CONNECTED");
    vi.mocked(fetchHistoricalTrades).mockRejectedValue(new Error("MetaStats is having a day"));

    const response = await POST();

    expect(response.status).toBe(500);
    expect(undeployAccount).not.toHaveBeenCalled();
  });

  it("parks the account and reports the broker's refusal when the login is rejected", async () => {
    mockSession();
    mockAdmin({ broker_accounts: rowThenStamp() });
    mockMetaApiAccount("DEPLOYED", "DISCONNECTED_FROM_BROKER");

    const response = await POST();
    const json = await response.json();

    expect(response.status).toBe(502);
    expect(json.error).toBe("broker_sync_failed");
    expect(json.message).toMatch(/investor password/i);
    expect(undeployAccount).toHaveBeenCalledWith("meta-1");
    // Re-deploying a rejected login is a billed validation failure.
    expect(deployAccount).not.toHaveBeenCalled();
  });

  it("does not deploy an account that is still coming up", async () => {
    mockSession();
    mockAdmin({ broker_accounts: [createQueryBuilder({ data: ACCOUNT_ROW, error: null })] });
    mockMetaApiAccount("DEPLOYING", "DISCONNECTED");

    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "linking" });
    expect(deployAccount).not.toHaveBeenCalled();
  });
});
