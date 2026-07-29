import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/broker/metaapi", () => ({
  createAccount: vi.fn(),
  createConfigurationLink: vi.fn(),
  deleteAccount: vi.fn(),
  getAccount: vi.fn(),
  deployAccount: vi.fn(),
  undeployAccount: vi.fn(),
  fetchHistoricalTrades: vi.fn(),
  DEFAULT_METAAPI_REGION: "london",
  // Real class, not a stub: the 404 branch below is an `instanceof` check.
  MetaApiError: class MetaApiError extends Error {
    constructor(readonly status: number, message: string) {
      super(message);
      this.name = "MetaApiError";
    }
  },
  // Pure, and the replace-vs-wake decision turns on it — so the mock carries the real
  // behaviour rather than a stub that could quietly disagree with the module.
  platformOfVersion: (version: number | undefined) =>
    version === 4 ? "mt4" : version === 5 ? "mt5" : undefined,
}));

vi.mock("@/lib/observability/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { DELETE, GET, POST } from "@/app/api/broker/account/route";
import { getSessionUser } from "@/lib/auth/session";
import {
  createAccount,
  createConfigurationLink,
  deleteAccount,
  getAccount,
  MetaApiError,
  undeployAccount,
} from "@/lib/broker/metaapi";

import { createQueryBuilder, mockAdmin, mockSession } from "./harness";

const ACCOUNT_ROW = {
  id: "row-1",
  user_id: "user-1",
  metaapi_account_id: "meta-1",
  platform: "mt5",
  region: "london",
  last_synced_at: "2026-07-28T02:05:00.000Z",
  last_sync_error: null,
};

function createRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/broker/account", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("Broker account API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("401s a signed-out reader", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null as never);

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "unauthorized",
      message: "Sign in to manage your broker connection.",
    });
  });

  // Deliberately NOT Pro-gated, and this test is the reason. The client renders its Disconnect
  // button off this payload, so a 403 here hid a lapsed subscriber's own connection from them —
  // leaving the un-gated DELETE with no reachable caller while the link went on billing us.
  // It also pins the payload a parked account derives: `ready`, with the last sync reported.
  it("lets a lapsed trader read their connection so they can disconnect it", async () => {
    mockSession("free");
    mockAdmin({ broker_accounts: [createQueryBuilder({ data: ACCOUNT_ROW, error: null })] });
    vi.mocked(getAccount).mockResolvedValue({
      _id: "meta-1",
      state: "UNDEPLOYED",
      connectionStatus: "DISCONNECTED",
      region: "london",
    });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      account: {
        platform: "mt5",
        state: "ready",
        stateDetail: null,
        lastSyncedAt: "2026-07-28T02:05:00.000Z",
        lastSyncError: null,
      },
    });
  });

  it("returns a null account when nothing is connected", async () => {
    mockSession();
    mockAdmin({ broker_accounts: [createQueryBuilder({ data: null, error: null })] });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ account: null });
  });

  // The claim insert IS the "one per trader" check now: a unique violation on user_id is
  // what says "already connected", and it says it before a penny is spent.
  it("409s a second account — one per trader in v1", async () => {
    mockSession();
    mockAdmin({
      broker_accounts: [
        // No dormant row to wake…
        createQueryBuilder({ data: null, error: null }),
        // …and the claim loses to the unique index.
        createQueryBuilder({ data: null, error: { message: "duplicate key value" } }),
      ],
    });

    const response = await POST(createRequest({ platform: "mt5", server: "ICMarketsSC-MT5" }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "broker_account_exists",
      message: "You've already connected an account. Disconnect it first.",
    });
    expect(createAccount).not.toHaveBeenCalled();
  });

  it("creates a credential-less account and hands back the configuration link", async () => {
    mockSession();
    const claimBuilder = createQueryBuilder({ data: { id: "row-1" }, error: null });
    const patchBuilder = createQueryBuilder({ data: { ...ACCOUNT_ROW, last_synced_at: null }, error: null });
    mockAdmin({
      broker_accounts: [createQueryBuilder({ data: null, error: null }), claimBuilder, patchBuilder],
    });
    vi.mocked(createAccount).mockResolvedValue({ id: "meta-1", state: "DRAFT" });
    vi.mocked(createConfigurationLink).mockResolvedValue("https://app.metaapi.cloud/configure/meta-1/tok");

    const response = await POST(createRequest({ platform: "mt5", server: "ICMarketsSC-MT5" }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      account: {
        platform: "mt5",
        state: "awaiting_config",
        stateDetail: null,
        lastSyncedAt: null,
        lastSyncError: null,
      },
      configurationLink: "https://app.metaapi.cloud/configure/meta-1/tok",
    });
    // No credentials in the create payload — the trader types those on MetaApi's page.
    expect(createAccount).toHaveBeenCalledWith({
      userId: "user-1",
      platform: "mt5",
      server: "ICMarketsSC-MT5",
    });
    // The row is claimed with a placeholder id BEFORE the billed create, then patched with
    // the real one — that ordering is what stops two requests each paying $2.10.
    expect(claimBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-1", metaapi_account_id: "pending:user-1", platform: "mt5", region: null }),
    );
    expect(patchBuilder.update).toHaveBeenCalledWith({ metaapi_account_id: "meta-1" });
    expect(getAccount).not.toHaveBeenCalled();
  });

  it("deletes the account it just paid for when the rest of the create fails", async () => {
    mockSession();
    const releaseBuilder = createQueryBuilder({ error: null });
    mockAdmin({
      broker_accounts: [
        createQueryBuilder({ data: null, error: null }),
        createQueryBuilder({ data: { id: "row-1" }, error: null }),
        releaseBuilder,
      ],
    });
    vi.mocked(createAccount).mockResolvedValue({ id: "meta-1", state: "DRAFT" });
    vi.mocked(deleteAccount).mockResolvedValue(undefined);
    vi.mocked(createConfigurationLink).mockRejectedValue(new Error("MetaApi 502"));

    const response = await POST(createRequest({ platform: "mt5", server: "ICMarketsSC-MT5" }));

    expect(response.status).toBe(502);
    // Otherwise it is an account MetaApi bills for and nothing of ours points at.
    expect(deleteAccount).toHaveBeenCalledWith("meta-1");
    // And the claim goes too, or the trader is 409'd out of ever retrying.
    expect(releaseBuilder.delete).toHaveBeenCalled();
  });

  it("reuses a disconnected account instead of buying another one", async () => {
    mockSession();
    const wakeBuilder = createQueryBuilder({ data: ACCOUNT_ROW, error: null });
    mockAdmin({
      // The dormant read finds their parked account…
      broker_accounts: [createQueryBuilder({ data: ACCOUNT_ROW, error: null }), wakeBuilder, wakeBuilder],
    });
    vi.mocked(createConfigurationLink).mockResolvedValue("https://app.metaapi.cloud/configure/meta-1/tok");
    vi.mocked(getAccount).mockResolvedValue({ _id: "meta-1", state: "UNDEPLOYED", connectionStatus: "DISCONNECTED" });

    const response = await POST(createRequest({ platform: "mt5", server: "ICMarketsSC-MT5" }));

    expect(response.status).toBe(200);
    // The whole point: reconnecting costs nothing, because the account was never deleted.
    expect(createAccount).not.toHaveBeenCalled();
    expect(wakeBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ disconnected_at: null, last_sync_error: null }),
    );
    // The requested platform is NOT written back. MetaApi fixes platform and server when the
    // account is created and neither can be changed on it, so honouring the picker here only
    // made our row disagree with the live account — "MT4 connected" over an MT5 one.
    expect(wakeBuilder.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ platform: expect.anything() }),
    );
  });

  // Switching brokers. MetaApi fixes server + platform at creation, so a trader moving from a
  // challenge account to a funded one CANNOT reuse the parked account — the old behaviour
  // silently reconnected them to the broker they had just left.
  describe("picking a different account than the parked one", () => {
    const dormantAt = { ...ACCOUNT_ROW, last_synced_at: "2026-07-28T02:05:00.000Z", last_sync_error: "stale" };

    function mockParked(live: Record<string, unknown> | null) {
      const rowBuilder = createQueryBuilder({ data: dormantAt, error: null });
      // The conditional wake that claims the row before anything is spent.
      const claimBuilder = createQueryBuilder({ data: [{ id: "row-1" }], error: null });
      const patchBuilder = createQueryBuilder({ data: { ...ACCOUNT_ROW, last_synced_at: null }, error: null });
      mockAdmin({ broker_accounts: [rowBuilder, claimBuilder, patchBuilder, patchBuilder] });
      if (live) vi.mocked(getAccount).mockResolvedValue(live as never);
      else vi.mocked(getAccount).mockRejectedValue(new Error("MetaApi 502"));
      vi.mocked(createConfigurationLink).mockResolvedValue("https://app.metaapi.cloud/configure/meta-2/tok");
      vi.mocked(createAccount).mockResolvedValue({ id: "meta-2", state: "DRAFT" });
      vi.mocked(deleteAccount).mockResolvedValue(undefined);
      return { rowBuilder, patchBuilder };
    }

    it("replaces the account, and only releases the old one once the row points at the new", async () => {
      mockSession();
      const { patchBuilder } = mockParked({ _id: "meta-1", state: "UNDEPLOYED", connectionStatus: "DISCONNECTED", server: "FTMO-Demo2", version: 5 });

      const response = await POST(createRequest({ platform: "mt5", server: "FTMO-Server" }));

      expect(response.status).toBe(200);
      expect(createAccount).toHaveBeenCalledWith({ userId: "user-1", platform: "mt5", server: "FTMO-Server" });
      expect(deleteAccount).toHaveBeenCalledWith("meta-1");
      // The row is re-pointed and everything it remembered about the old account is cleared.
      // last_synced_at is the one that matters: left in place, computeSyncWindow would start
      // the new account's history at the OLD account's last sync instead of its 90 days.
      expect(patchBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          metaapi_account_id: "meta-2",
          disconnected_at: null,
          last_synced_at: null,
          last_sync_error: null,
          last_deploy_at: null,
          region: null,
        }),
      );
    });

    it("409s without spending when another request already took the dormant row", async () => {
      // The conditional wake IS the lock: `disconnected_at is not null` can only match once.
      // Without it two concurrent POSTs both read the same dormant row, both paid $2.10, and
      // the slower update won the row while the faster one's account billed on untracked.
      mockSession();
      const rowBuilder = createQueryBuilder({ data: dormantAt, error: null });
      const lostClaim = createQueryBuilder({ data: [], error: null });
      mockAdmin({ broker_accounts: [rowBuilder, lostClaim] });
      vi.mocked(getAccount).mockResolvedValue({ _id: "meta-1", state: "UNDEPLOYED", connectionStatus: "DISCONNECTED", server: "FTMO-Demo2", version: 5 } as never);

      const response = await POST(createRequest({ platform: "mt5", server: "FTMO-Server" }));

      expect(response.status).toBe(409);
      expect(createAccount).not.toHaveBeenCalled();
      expect(deleteAccount).not.toHaveBeenCalled();
    });

    it("treats a different PLATFORM on the same server as a different account", async () => {
      mockSession();
      mockParked({ _id: "meta-1", state: "UNDEPLOYED", connectionStatus: "DISCONNECTED", server: "ICMarketsSC-MT5", version: 5 });

      await POST(createRequest({ platform: "mt4", server: "ICMarketsSC-MT5" }));

      expect(createAccount).toHaveBeenCalled();
      expect(deleteAccount).toHaveBeenCalledWith("meta-1");
    });

    it("wakes rather than replaces when the server matches, ignoring case and padding", async () => {
      mockSession();
      mockParked({ _id: "meta-1", state: "UNDEPLOYED", connectionStatus: "DISCONNECTED", server: "ICMarketsSC-MT5", version: 5 });

      const response = await POST(createRequest({ platform: "mt5", server: "  icmarketssc-mt5  " }));

      expect(response.status).toBe(200);
      expect(createAccount).not.toHaveBeenCalled();
      expect(deleteAccount).not.toHaveBeenCalled();
    });

    it("does NOT delete when MetaApi cannot be read — uncertainty is never destructive", async () => {
      mockSession();
      mockParked(null);

      const response = await POST(createRequest({ platform: "mt4", server: "Some-Other-Server" }));

      // The fee on a deleted account is gone for good, so an unreadable account falls back to
      // waking the one they have rather than guessing that they meant a new one.
      expect(response.status).toBe(200);
      expect(deleteAccount).not.toHaveBeenCalled();
      expect(createAccount).not.toHaveBeenCalled();
    });

    it("does NOT delete when MetaApi reports no server for the parked account", async () => {
      mockSession();
      mockParked({ _id: "meta-1", state: "UNDEPLOYED", connectionStatus: "DISCONNECTED", version: 5 });

      await POST(createRequest({ platform: "mt4", server: "Some-Other-Server" }));

      expect(deleteAccount).not.toHaveBeenCalled();
      expect(createAccount).not.toHaveBeenCalled();
    });

    it("re-points the row at a fresh account when the parked one no longer exists at MetaApi", async () => {
      // Someone removed it from the MetaApi dashboard. The row pointed at nothing, reconnect
      // 502'd asking a dead id for a configuration link, and the dormant row blocked a fresh
      // create — so the trader could never connect again. A 404 is certainty, not doubt.
      mockSession();
      const { patchBuilder } = mockParked(null);
      // The MOCKED class, not a look-alike: the route decides on `instanceof`.
      vi.mocked(getAccount).mockRejectedValue(new MetaApiError(404, "account not found"));

      const response = await POST(createRequest({ platform: "mt5", server: "FTMO-Demo2" }));

      expect(response.status).toBe(200);
      expect(createAccount).toHaveBeenCalled();
      // Nothing to release: MetaApi already told us it is gone.
      expect(deleteAccount).not.toHaveBeenCalled();
      // The row still has to be woken and wiped. Keying that patch off "is there an old
      // account to delete" skipped it here, leaving the row dormant AND carrying the dead
      // account's last_synced_at into the new one's first import window.
      expect(patchBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ metaapi_account_id: "meta-2", disconnected_at: null, last_synced_at: null }),
      );
    });

    it("keeps the trader's existing account when the replacement create fails", async () => {
      mockSession();
      mockParked({ _id: "meta-1", state: "UNDEPLOYED", connectionStatus: "DISCONNECTED", server: "FTMO-Demo2", version: 5 });
      vi.mocked(createAccount).mockRejectedValue(new Error("MetaApi 502"));

      const response = await POST(createRequest({ platform: "mt5", server: "FTMO-Server" }));

      expect(response.status).toBe(502);
      // Create-before-delete is the whole point: a failed replacement must not leave them
      // with no connection AND the fee spent. The old account is untouched...
      expect(deleteAccount).not.toHaveBeenCalled();
      // ...and their row survives, because this request never inserted one to roll back.
      expect(vi.mocked(getAccount)).toHaveBeenCalledWith("meta-1");
    });
  });

  it("rejects a create without a server", async () => {
    const response = await POST(createRequest({ platform: "mt5" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "broker_account_invalid",
      message: "The broker connection request is invalid.",
    });
  });

  it("parks the account on disconnect instead of burning the join fee", async () => {
    mockSession();
    const markBuilder = createQueryBuilder({ error: null });
    mockAdmin({ broker_accounts: [createQueryBuilder({ data: ACCOUNT_ROW, error: null }), markBuilder] });

    const response = await DELETE();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({});
    // Deleting would throw away the $2.10 they already paid to join, so reconnecting later
    // would buy the same account again. Parked, it costs a fraction and comes back free.
    expect(undeployAccount).toHaveBeenCalledWith("meta-1");
    expect(deleteAccount).not.toHaveBeenCalled();
    expect(markBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ last_sync_error: null }),
    );
  });
});
