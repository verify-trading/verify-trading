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
  // Real class, not a stub: the 404 branch below is an `instanceof` check, and the
  // credential-error mapping reads `code` / `suggestedServers` off it.
  MetaApiError: class MetaApiError extends Error {
    constructor(
      readonly status: number,
      message: string,
      readonly code?: string,
      readonly suggestedServers?: string[],
    ) {
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

// The attempt limiter is unit-tested on its own; here it is a gate the route consults, mocked
// so a test can say "blocked" without burning five attempts of module state to get there.
// Same for the durable create budget, whose real implementation counts rows in a table.
vi.mock("@/lib/broker/credential-attempts", () => ({
  checkCredentialAttempt: vi.fn(() => true),
  claimBrokerCreate: vi.fn(async () => true),
  refundBrokerCreate: vi.fn(async () => undefined),
  refundCredentialAttempt: vi.fn(),
}));

import { DELETE, GET, POST, PUT } from "@/app/api/broker/account/route";
import { getSessionUser } from "@/lib/auth/session";
import {
  checkCredentialAttempt,
  claimBrokerCreate,
  refundBrokerCreate,
  refundCredentialAttempt,
} from "@/lib/broker/credential-attempts";
import {
  createAccount,
  deleteAccount,
  getAccount,
  MetaApiError,
  undeployAccount,
  updateAccountPassword,
} from "@/lib/broker/metaapi";
import { computeSyncWindow } from "@/lib/broker/sync";

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

// What the trader types. The login is the account number on their MetaTrader login screen.
const CONNECT = {
  platform: "mt5",
  server: "ICMarketsSC-MT5",
  login: "123456",
  password: "investor-pw",
} as const;

/** The parked account MetaApi would report for CONNECT — same server, platform AND login. */
const LIVE_PARKED = {
  _id: "meta-1",
  state: "UNDEPLOYED",
  connectionStatus: "DISCONNECTED",
  server: "ICMarketsSC-MT5",
  version: 5,
  login: "123456",
};

function createRequest(body: Record<string, unknown>, method: "POST" | "PUT" = "POST") {
  return new Request("http://localhost/api/broker/account", {
    method,
    body: JSON.stringify(body),
  });
}

const putRequest = (body: Record<string, unknown>) => createRequest(body, "PUT");

describe("Broker account API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks does not undo mockReturnValue, so the gates are re-opened explicitly —
    // a "blocked" test would otherwise leak its 429 into every later POST.
    vi.mocked(checkCredentialAttempt).mockReturnValue(true);
    vi.mocked(claimBrokerCreate).mockResolvedValue(true);
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
        credentialsRejected: false,
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

    const response = await POST(createRequest(CONNECT));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "broker_account_exists",
      message: "You've already connected an account. Disconnect it first.",
    });
    expect(createAccount).not.toHaveBeenCalled();
  });

  it("creates the account with the typed credentials and answers with the live state", async () => {
    mockSession();
    const claimBuilder = createQueryBuilder({ data: { id: "row-1" }, error: null });
    const patchBuilder = createQueryBuilder({ data: { ...ACCOUNT_ROW, last_synced_at: null }, error: null });
    mockAdmin({
      broker_accounts: [createQueryBuilder({ data: null, error: null }), claimBuilder, patchBuilder],
    });
    vi.mocked(createAccount).mockResolvedValue({ id: "meta-1", state: "DEPLOYED" });
    // The response is a live read, not a guess off the create reply: a validated account can
    // come back DEPLOYED and still be connecting, and only MetaApi knows which.
    vi.mocked(getAccount).mockResolvedValue({
      _id: "meta-1",
      state: "DEPLOYED",
      connectionStatus: "DISCONNECTED",
    });

    const response = await POST(createRequest(CONNECT));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      account: {
        platform: "mt5",
        state: "linking",
        stateDetail: null,
        lastSyncedAt: null,
        lastSyncError: null,
        credentialsRejected: false,
      },
    });
    // The credentials ride the create — MetaApi validates them synchronously, so a wrong
    // investor password is a 400 in THIS request, not a broken deploy an hour later.
    expect(createAccount).toHaveBeenCalledWith({
      userId: "user-1",
      platform: "mt5",
      server: "ICMarketsSC-MT5",
      login: "123456",
      password: "investor-pw",
    });
    // The row is claimed with a placeholder id BEFORE the billed create, then patched with
    // the real one — that ordering is what stops two requests each paying $2.10.
    expect(claimBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-1", metaapi_account_id: "pending:user-1", platform: "mt5", region: null }),
    );
    expect(patchBuilder.update).toHaveBeenCalledWith({ metaapi_account_id: "meta-1" });
  });

  it("turns a rejected login into a 400 the form can show, and releases the claim", async () => {
    mockSession();
    const releaseBuilder = createQueryBuilder({ error: null });
    mockAdmin({
      broker_accounts: [
        createQueryBuilder({ data: null, error: null }),
        createQueryBuilder({ data: { id: "row-1" }, error: null }),
        releaseBuilder,
      ],
    });
    vi.mocked(createAccount).mockRejectedValue(new MetaApiError(400, "We failed to authenticate…", "E_AUTH"));

    const response = await POST(createRequest(CONNECT));

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("broker_credentials_rejected");
    // No account was created for a validation failure, so there is nothing to compensate…
    expect(deleteAccount).not.toHaveBeenCalled();
    // …but the claim goes, or the trader is 409'd out of ever retrying with the right password.
    expect(releaseBuilder.delete).toHaveBeenCalled();
  });

  it("hands back MetaApi's server suggestions when the server name is unknown", async () => {
    mockSession();
    mockAdmin({
      broker_accounts: [
        createQueryBuilder({ data: null, error: null }),
        createQueryBuilder({ data: { id: "row-1" }, error: null }),
        createQueryBuilder({ error: null }),
      ],
    });
    vi.mocked(createAccount).mockRejectedValue(
      new MetaApiError(400, ".dat file for server ICMarkets-Demo not found…", "E_SRV_NOT_FOUND", ["ICMarketsSC-Demo", "ICMarketsSC-MT5"]),
    );

    const response = await POST(createRequest({ ...CONNECT, server: "ICMarkets-Demo" }));

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("broker_server_unknown");
    expect(json.message).toContain("ICMarketsSC-Demo");
  });

  it("deletes the account it just paid for when the rest of the create fails", async () => {
    mockSession();
    const releaseBuilder = createQueryBuilder({ error: null });
    mockAdmin({
      broker_accounts: [
        createQueryBuilder({ data: null, error: null }),
        createQueryBuilder({ data: { id: "row-1" }, error: null }),
        // The claim update fails AFTER the create returned.
        createQueryBuilder({ data: null, error: { message: "connection reset" } }),
        releaseBuilder,
      ],
    });
    vi.mocked(createAccount).mockResolvedValue({ id: "meta-1", state: "DEPLOYED" });
    vi.mocked(deleteAccount).mockResolvedValue(undefined);

    const response = await POST(createRequest(CONNECT));

    expect(response.status).toBe(502);
    // Otherwise it is an account MetaApi bills for and nothing of ours points at.
    expect(deleteAccount).toHaveBeenCalledWith("meta-1");
    expect(releaseBuilder.delete).toHaveBeenCalled();
  });

  it("reuses a disconnected account instead of buying another one", async () => {
    mockSession();
    const dormantBuilder = createQueryBuilder({ data: ACCOUNT_ROW, error: null });
    // The conditional wake that claims the row BEFORE the password is validated…
    const claimBuilder = createQueryBuilder({ data: [{ id: "row-1" }], error: null });
    // …then the rejected-login stamp clear, a separate write behind it…
    const stampBuilder = createQueryBuilder({ error: null });
    // …and finally the row read behind the response payload.
    const readBuilder = createQueryBuilder({ data: ACCOUNT_ROW, error: null });
    mockAdmin({ broker_accounts: [dormantBuilder, claimBuilder, stampBuilder, readBuilder] });
    vi.mocked(getAccount).mockResolvedValue(LIVE_PARKED);
    vi.mocked(updateAccountPassword).mockResolvedValue(undefined);

    const response = await POST(createRequest(CONNECT));

    expect(response.status).toBe(200);
    // The whole point: reconnecting costs nothing, because the account was never deleted.
    expect(createAccount).not.toHaveBeenCalled();
    expect(deleteAccount).not.toHaveBeenCalled();
    // …but the password typed NOW is put on it — a password change is why people reconnect.
    expect(updateAccountPassword).toHaveBeenCalledWith({
      accountId: "meta-1",
      userId: "user-1",
      server: "ICMarketsSC-MT5",
      password: "investor-pw",
    });
    // The claim is the conditional wake: it must land BEFORE the password PUT, or two
    // concurrent reconnects both validate a password and the second silently wins.
    expect(claimBuilder.update).toHaveBeenCalledWith({ disconnected_at: null });
    expect(claimBuilder.not).toHaveBeenCalledWith("disconnected_at", "is", null);
    expect(claimBuilder.update.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(updateAccountPassword).mock.invocationCallOrder[0],
    );
    // The stamp stays behind the PUT: clearing it is what lets the wake pass deploy again,
    // and a refused password must not clear it on its way out. last_synced_at goes with it —
    // the failed syncs that got them here stamped it, and computeSyncWindow would then start
    // the recovery sync at the last FAILURE.
    expect(stampBuilder.update).toHaveBeenCalledWith({ last_sync_error: null, last_synced_at: null });
    // The requested platform is NOT written back. MetaApi fixes platform and server when the
    // account is created and neither can be changed on it, so honouring the picker here only
    // made our row disagree with the live account — "MT4 connected" over an MT5 one.
    expect(claimBuilder.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ platform: expect.anything() }),
    );
    expect(stampBuilder.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ platform: expect.anything() }),
    );
  });

  it("409s a reconnect that loses the claim race, before any password is validated", async () => {
    // The conditional wake IS the lock, same as the replace path's: `disconnected_at is not
    // null` can only match once. Without it two concurrent POSTs with matching credentials
    // both validated a password and the slower one silently overwrote the faster one's.
    mockSession();
    const dormantBuilder = createQueryBuilder({ data: ACCOUNT_ROW, error: null });
    const lostClaim = createQueryBuilder({ data: [], error: null });
    mockAdmin({ broker_accounts: [dormantBuilder, lostClaim] });
    vi.mocked(getAccount).mockResolvedValue(LIVE_PARKED);

    const response = await POST(createRequest(CONNECT));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "broker_account_exists",
      message: "You've already connected an account. Disconnect it first.",
    });
    // The loser never reaches MetaApi at all — nothing validated, created or deleted.
    expect(updateAccountPassword).not.toHaveBeenCalled();
    expect(createAccount).not.toHaveBeenCalled();
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it("400s a refused reconnect password and re-parks the row it had claimed", async () => {
    mockSession();
    const dormantBuilder = createQueryBuilder({ data: ACCOUNT_ROW, error: null });
    const claimBuilder = createQueryBuilder({ data: [{ id: "row-1" }], error: null });
    const restoreBuilder = createQueryBuilder({ error: null });
    mockAdmin({ broker_accounts: [dormantBuilder, claimBuilder, restoreBuilder] });
    vi.mocked(getAccount).mockResolvedValue(LIVE_PARKED);
    vi.mocked(updateAccountPassword).mockRejectedValue(new MetaApiError(400, "We failed to authenticate…", "E_AUTH"));

    const response = await POST(createRequest({ ...CONNECT, password: "wrong-pw" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "broker_credentials_rejected" });
    // The claim fires BEFORE the password PUT (see the race test above), so a refused password
    // leaves the claim itself to undo: the row is parked again with a fresh timestamp, or the
    // next corrected attempt 409s against a row that looks awake.
    expect(claimBuilder.update).toHaveBeenCalledWith({ disconnected_at: null });
    expect(restoreBuilder.update).toHaveBeenCalledWith({ disconnected_at: expect.any(String) });
    expect(restoreBuilder.eq).toHaveBeenCalledWith("id", "row-1");
    // Nothing was validated, so nothing is created or deleted.
    expect(createAccount).not.toHaveBeenCalled();
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  // Switching accounts. MetaApi fixes server + platform at creation, so a trader moving from a
  // challenge account to a funded one CANNOT reuse the parked account — the old behaviour
  // silently reconnected them to the broker they had just left.
  it("keeps a completed reconnect when the read-back fails — the password is already live", async () => {
    mockSession();
    // The row still carries the rejection that sent them here, so the fallback payload has to
    // report the stamp this request just cleared rather than the stale one it was loaded with.
    const rejected = {
      ...ACCOUNT_ROW,
      last_sync_error: "Your broker turned the login away. Update the investor password and sync again.",
    };
    const dormantBuilder = createQueryBuilder({ data: rejected, error: null });
    const claimBuilder = createQueryBuilder({ data: [{ id: "row-1" }], error: null });
    const stampBuilder = createQueryBuilder({ error: null });
    // The row read behind the response fails, AFTER MetaApi already took the new password.
    const failedRead = createQueryBuilder({ data: null, error: { message: "connection reset" } });
    const restoreBuilder = createQueryBuilder({ error: null });
    mockAdmin({
      broker_accounts: [dormantBuilder, claimBuilder, stampBuilder, failedRead, restoreBuilder],
    });
    vi.mocked(getAccount).mockResolvedValue(LIVE_PARKED);
    vi.mocked(updateAccountPassword).mockResolvedValue(undefined);

    const response = await POST(createRequest(CONNECT));

    // A 502 here would tell the trader to retry something that already worked — and the retry
    // 409s, so the next move is Disconnect, which destroys the paid account to redo it.
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      account: {
        platform: "mt5",
        state: "linking",
        stateDetail: null,
        // Null, not the row's loaded stamp: the stamp clear this request just made nulls
        // last_synced_at as well, so reporting the old value would describe a row that no
        // longer exists — and it is a FAILED sync's timestamp anyway.
        lastSyncedAt: null,
        lastSyncError: null,
        credentialsRejected: false,
      },
    });
    // The row stays woken: the reconnect succeeded, only the read after it failed.
    expect(restoreBuilder.update).not.toHaveBeenCalled();
  });

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
      vi.mocked(createAccount).mockResolvedValue({ id: "meta-2", state: "DEPLOYED" });
      vi.mocked(deleteAccount).mockResolvedValue(undefined);
      return { rowBuilder, patchBuilder };
    }

    it("replaces the account, and only releases the old one once the row points at the new", async () => {
      mockSession();
      const { patchBuilder } = mockParked({ ...LIVE_PARKED, server: "FTMO-Demo2" });

      const response = await POST(createRequest({ ...CONNECT, server: "FTMO-Server" }));

      expect(response.status).toBe(200);
      expect(createAccount).toHaveBeenCalledWith({
        userId: "user-1",
        platform: "mt5",
        server: "FTMO-Server",
        login: "123456",
        password: "investor-pw",
      });
      expect(deleteAccount).toHaveBeenCalledWith("meta-1");
      // The row is re-pointed and everything it remembered about the old account is cleared.
      // last_synced_at is the one that matters: left in place, computeSyncWindow would start
      // the new account's history at the OLD account's last sync instead of its 30 days.
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
      vi.mocked(getAccount).mockResolvedValue({ ...LIVE_PARKED, server: "FTMO-Demo2" } as never);

      const response = await POST(createRequest({ ...CONNECT, server: "FTMO-Server" }));

      expect(response.status).toBe(409);
      expect(createAccount).not.toHaveBeenCalled();
      expect(deleteAccount).not.toHaveBeenCalled();
    });

    it("treats a different PLATFORM on the same server as a different account", async () => {
      mockSession();
      mockParked(LIVE_PARKED);

      await POST(createRequest({ ...CONNECT, platform: "mt4" }));

      expect(createAccount).toHaveBeenCalled();
      expect(deleteAccount).toHaveBeenCalledWith("meta-1");
    });

    it("treats a different LOGIN on the same server as a different account", async () => {
      // Same broker, new account number — the funded account replacing the challenge one.
      // Waking the parked one would silently reconnect the login they had just left.
      mockSession();
      mockParked({ ...LIVE_PARKED, login: "999999" });

      await POST(createRequest(CONNECT));

      expect(createAccount).toHaveBeenCalled();
      expect(deleteAccount).toHaveBeenCalledWith("meta-1");
    });

    it("replaces a parked account that never got credentials — it is useless in this flow", async () => {
      // Pre-migration accounts were created credential-less and configured on MetaApi's
      // hosted page. One that never finished has no login, and the password PUT cannot give
      // it one (login is fixed at creation) — so it is replaced, not woken.
      mockSession();
      mockParked({ _id: "meta-1", state: "DRAFT", connectionStatus: "DISCONNECTED", server: "ICMarketsSC-MT5", version: 5 });

      await POST(createRequest(CONNECT));

      expect(createAccount).toHaveBeenCalled();
      expect(deleteAccount).toHaveBeenCalledWith("meta-1");
    });

    it("refuses to guess when MetaApi reports no login on a configured account", async () => {
      // The one case with no safe answer. Server and platform match, but without a login this
      // account cannot be told apart from a different one at the same broker — and BOTH ways
      // out are destructive: waking it reconnects the account they may have just left, and
      // replacing it deletes a paid account and every trade imported from it. "Uncertainty is
      // never destructive" applies to the data here, so the request stops rather than picks.
      mockSession();
      mockParked({ _id: "meta-1", state: "UNDEPLOYED", connectionStatus: "DISCONNECTED", server: "ICMarketsSC-MT5", version: 5 });

      const response = await POST(createRequest(CONNECT));

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toMatchObject({ error: "broker_account_unverified" });
      expect(createAccount).not.toHaveBeenCalled();
      expect(updateAccountPassword).not.toHaveBeenCalled();
      expect(deleteAccount).not.toHaveBeenCalled();
      // Nothing reached MetaApi, so the attempt was never billable.
      expect(refundCredentialAttempt).toHaveBeenCalledWith("user-1");
    });

    it("wakes rather than replaces when the server matches, ignoring case and padding", async () => {
      mockSession();
      mockParked(LIVE_PARKED);
      vi.mocked(updateAccountPassword).mockResolvedValue(undefined);

      const response = await POST(createRequest({ ...CONNECT, server: "  icmarketssc-mt5  " }));

      expect(response.status).toBe(200);
      expect(createAccount).not.toHaveBeenCalled();
      expect(deleteAccount).not.toHaveBeenCalled();
    });

    it("502s without touching anything when MetaApi cannot be read — uncertainty is never destructive", async () => {
      mockSession();
      mockParked(null);

      const response = await POST(createRequest({ platform: "mt4", server: "Some-Other-Server", login: "123456", password: "pw" }));

      // The reconnect needs the live server name for the password PUT, and an unreadable
      // account can't give it. The fee on a deleted account is gone for good either way, so
      // nothing is created, woken or deleted — the row stays dormant for the next try.
      expect(response.status).toBe(502);
      expect(deleteAccount).not.toHaveBeenCalled();
      expect(createAccount).not.toHaveBeenCalled();
    });

    it("re-points the row at a fresh account when the parked one no longer exists at MetaApi", async () => {
      // Someone removed it from the MetaApi dashboard. The row pointed at nothing and the
      // dormant row blocked a fresh create — so the trader could never connect again.
      // A 404 is certainty, not doubt.
      mockSession();
      const { patchBuilder } = mockParked(null);
      // The MOCKED class, not a look-alike: the route decides on `instanceof`.
      vi.mocked(getAccount).mockRejectedValue(new MetaApiError(404, "account not found"));

      const response = await POST(createRequest({ ...CONNECT, server: "FTMO-Demo2" }));

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
      mockParked({ ...LIVE_PARKED, server: "FTMO-Demo2" });
      vi.mocked(createAccount).mockRejectedValue(new Error("MetaApi 502"));

      const response = await POST(createRequest({ ...CONNECT, server: "FTMO-Server" }));

      expect(response.status).toBe(502);
      // Create-before-delete is the whole point: a failed replacement must not leave them
      // with no connection AND the fee spent. The old account is untouched...
      expect(deleteAccount).not.toHaveBeenCalled();
      // ...and their row survives, because this request never inserted one to roll back.
      expect(vi.mocked(getAccount)).toHaveBeenCalledWith("meta-1");
    });

    it("re-parks a claimed replacement row when credential validation fails, so the trader can retry", async () => {
      mockSession();
      const rowBuilder = createQueryBuilder({ data: dormantAt, error: null });
      const claimBuilder = createQueryBuilder({ data: [{ id: "row-1" }], error: null });
      const restoreBuilder = createQueryBuilder({ error: null });
      mockAdmin({ broker_accounts: [rowBuilder, claimBuilder, restoreBuilder] });
      vi.mocked(getAccount).mockResolvedValue({ ...LIVE_PARKED, server: "FTMO-Demo2" } as never);
      vi.mocked(createAccount).mockRejectedValue(new MetaApiError(400, "We failed to authenticate…", "E_AUTH"));

      const response = await POST(createRequest({ ...CONNECT, server: "FTMO-Server" }));

      expect(response.status).toBe(400);
      // This is deliberately a timestamp rather than null: the row must be dormant again so
      // the next corrected submission can claim it instead of being rejected with a 409.
      expect(restoreBuilder.update).toHaveBeenCalledWith({ disconnected_at: expect.any(String) });
      expect(restoreBuilder.eq).toHaveBeenCalledWith("id", "row-1");
    });

    it("keeps the new account when the read-back fails — the row update was the commit point", async () => {
      mockSession();
      const rowBuilder = createQueryBuilder({ data: dormantAt, error: null });
      const claimBuilder = createQueryBuilder({ data: [{ id: "row-1" }], error: null });
      const patchBuilder = createQueryBuilder({ data: { ...ACCOUNT_ROW, last_synced_at: null }, error: null });
      // The live read behind the response fails at the database, AFTER the row already points
      // at the new account.
      const failedRead = createQueryBuilder({ data: null, error: { message: "connection reset" } });
      const restoreBuilder = createQueryBuilder({ error: null });
      mockAdmin({ broker_accounts: [rowBuilder, claimBuilder, patchBuilder, failedRead, restoreBuilder] });
      vi.mocked(getAccount).mockResolvedValue({ ...LIVE_PARKED, server: "FTMO-Demo2" } as never);
      vi.mocked(createAccount).mockResolvedValue({ id: "meta-2", state: "DEPLOYED" });
      vi.mocked(deleteAccount).mockResolvedValue(undefined);

      const response = await POST(createRequest({ ...CONNECT, server: "FTMO-Server" }));

      // Before the commit point this failure threw the request into the rollback: a 502 that
      // deleted the NEW account and re-parked the row, which then pointed at an account that
      // no longer existed — a corrupted connection and the $2.10 gone. Past the row update the
      // create is committed, so the answer is a 200 built from the row just written; "linking"
      // is honest because the create itself validated the account seconds ago.
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        account: {
          platform: "mt5",
          state: "linking",
          stateDetail: null,
          lastSyncedAt: null,
          lastSyncError: null,
          credentialsRejected: false,
        },
      });
      expect(deleteAccount).not.toHaveBeenCalledWith("meta-2");
      // The OLD account's release still ran — best-effort, after the commit.
      expect(deleteAccount).toHaveBeenCalledWith("meta-1");
      // …and the row was never re-parked.
      expect(restoreBuilder.update).not.toHaveBeenCalled();
    });
  });

  it("rejects a create with a non-numeric login before anything is spent", async () => {
    const response = await POST(createRequest({ ...CONNECT, login: "not-a-number" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "broker_account_invalid",
      message: "Check the platform, server, login and investor password.",
    });
    expect(createAccount).not.toHaveBeenCalled();
  });

  it("rejects a create without a password", async () => {
    const response = await POST(createRequest({ platform: "mt5", server: "ICMarketsSC-MT5", login: "123456" }));

    expect(response.status).toBe(400);
    expect(createAccount).not.toHaveBeenCalled();
  });

  it("tells an old app version to update instead of failing its legacy body as invalid", async () => {
    // Old builds POST only {platform, server} — credentials were collected on MetaApi's hosted
    // page back then. The generic validation 400 reads as a form error on a form that version
    // no longer has, so the legacy shape gets the update prompt instead.
    const response = await POST(createRequest({ platform: "mt5", server: "ICMarketsSC-MT5" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "broker_app_update_required",
      message: "Update the app to connect your broker — connecting now happens right in the app.",
    });
    expect(createAccount).not.toHaveBeenCalled();
  });

  it("429s a credential attempt past the budget before anything is read or spent", async () => {
    // MetaApi bills $0.105 for every FAILED validation and requires app-side rate limiting, so
    // a blocked attempt dies before the dormant read — let alone a MetaApi credential call.
    mockSession();
    const from = mockAdmin({ broker_accounts: [createQueryBuilder({ data: null, error: null })] });
    vi.mocked(checkCredentialAttempt).mockReturnValue(false);

    const response = await POST(createRequest(CONNECT));

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      error: "broker_credential_attempts",
      message: "Too many attempts. Wait a few minutes and try again.",
    });
    expect(from).not.toHaveBeenCalled();
    expect(createAccount).not.toHaveBeenCalled();
    expect(updateAccountPassword).not.toHaveBeenCalled();
  });

  describe("the durable $2.10 create budget", () => {
    it("429s a create past the daily budget and releases the claim it had taken", async () => {
      // The in-memory attempt budget is per warm serverless instance and sized for the $0.105
      // validation; a loop across cold starts walks straight through it. At $2.10 a create
      // that is a bill, so this brake counts against a table instead.
      mockSession();
      const releaseBuilder = createQueryBuilder({ error: null });
      mockAdmin({
        broker_accounts: [
          createQueryBuilder({ data: null, error: null }),
          createQueryBuilder({ data: { id: "row-1" }, error: null }),
          releaseBuilder,
        ],
      });
      vi.mocked(claimBrokerCreate).mockResolvedValue(false);

      const response = await POST(createRequest(CONNECT));

      expect(response.status).toBe(429);
      await expect(response.json()).resolves.toEqual({
        error: "broker_create_attempts",
        message: "You've set up a few broker connections today already. Try again tomorrow.",
      });
      expect(createAccount).not.toHaveBeenCalled();
      // The budget is checked after the row claim — counting ahead of it would charge the
      // requests that answer "already connected" to a trader who bought nothing — so the
      // claimed row has to go, or tomorrow's retry 409s instead of connecting.
      expect(releaseBuilder.delete).toHaveBeenCalled();
      // And the credential attempt goes back: this request never reached MetaApi.
      expect(refundCredentialAttempt).toHaveBeenCalledWith("user-1");
    });

    it("429s a REPLACE too — swapping brokers buys a new account just the same", async () => {
      mockSession();
      const dormantBuilder = createQueryBuilder({ data: ACCOUNT_ROW, error: null });
      const claimBuilder = createQueryBuilder({ data: [{ id: "row-1" }], error: null });
      const restoreBuilder = createQueryBuilder({ error: null });
      mockAdmin({ broker_accounts: [dormantBuilder, claimBuilder, restoreBuilder] });
      vi.mocked(getAccount).mockResolvedValue({ ...LIVE_PARKED, server: "FTMO-Demo2" });
      vi.mocked(claimBrokerCreate).mockResolvedValue(false);

      const response = await POST(createRequest({ ...CONNECT, server: "FTMO-Server" }));

      expect(response.status).toBe(429);
      expect(createAccount).not.toHaveBeenCalled();
      // Nothing was bought, so the old account is untouched and its row goes back to parked —
      // the same restore a refused password gets.
      expect(deleteAccount).not.toHaveBeenCalled();
      expect(restoreBuilder.update).toHaveBeenCalledWith({ disconnected_at: expect.any(String) });
    });

    it("hands the create back when MetaApi refused the credentials — nothing was created", async () => {
      // A wrong investor password costs $0.105 and creates no account. Charging it to a
      // three-a-day ceiling would lock a trader out of connecting for a full day over typos —
      // which is precisely what the sliding attempt budget exists to let them recover from.
      mockSession();
      mockAdmin({
        broker_accounts: [
          createQueryBuilder({ data: null, error: null }),
          createQueryBuilder({ data: { id: "row-1" }, error: null }),
          createQueryBuilder({ error: null }),
        ],
      });
      vi.mocked(createAccount).mockRejectedValue(new MetaApiError(400, "We failed to authenticate…", "E_AUTH"));

      const response = await POST(createRequest(CONNECT));

      expect(response.status).toBe(400);
      expect(refundBrokerCreate).toHaveBeenCalledWith(expect.anything(), "user-1");
    });

    it("keeps the create when MetaApi failed in a way that may have created one", async () => {
      // Anything that is not a validation 400 — a 202 that never settled, a killed connection —
      // may have left a paid account behind. That is the failure the durable count exists for,
      // so it is NOT refunded.
      mockSession();
      mockAdmin({
        broker_accounts: [
          createQueryBuilder({ data: null, error: null }),
          createQueryBuilder({ data: { id: "row-1" }, error: null }),
          createQueryBuilder({ error: null }),
        ],
      });
      vi.mocked(createAccount).mockRejectedValue(new MetaApiError(202, "MetaApi is still working on this."));

      const response = await POST(createRequest(CONNECT));

      expect(response.status).toBe(502);
      expect(refundBrokerCreate).not.toHaveBeenCalled();
    });

    it("does not refund a create it never charged — a refused reconnect password", async () => {
      // The reconnect path throws from inside the same try without ever reaching the budget.
      // Refunding on its 400 would hand back a create the trader really did make earlier today.
      mockSession();
      const dormantBuilder = createQueryBuilder({ data: ACCOUNT_ROW, error: null });
      const claimBuilder = createQueryBuilder({ data: [{ id: "row-1" }], error: null });
      const restoreBuilder = createQueryBuilder({ error: null });
      mockAdmin({ broker_accounts: [dormantBuilder, claimBuilder, restoreBuilder] });
      vi.mocked(getAccount).mockResolvedValue(LIVE_PARKED);
      vi.mocked(updateAccountPassword).mockRejectedValue(new MetaApiError(400, "We failed to authenticate…", "E_AUTH"));

      const response = await POST(createRequest({ ...CONNECT, password: "wrong-pw" }));

      expect(response.status).toBe(400);
      expect(claimBrokerCreate).not.toHaveBeenCalled();
      expect(refundBrokerCreate).not.toHaveBeenCalled();
    });

    it("does not count a request that loses the claim — it bought nothing", async () => {
      mockSession();
      mockAdmin({
        broker_accounts: [
          createQueryBuilder({ data: null, error: null }),
          createQueryBuilder({ data: null, error: { message: "duplicate key value" } }),
        ],
      });

      const response = await POST(createRequest(CONNECT));

      expect(response.status).toBe(409);
      // This is why the count sits after the claim rather than before it: a stale client
      // tapping Connect against a live row answers here, and three of those would otherwise
      // lock the trader out of connecting for a full day over creates that never happened.
      expect(claimBrokerCreate).not.toHaveBeenCalled();
    });

    it("never spends the create budget on a reconnect — waking a parked account is free", async () => {
      mockSession();
      const dormantBuilder = createQueryBuilder({ data: ACCOUNT_ROW, error: null });
      const claimBuilder = createQueryBuilder({ data: [{ id: "row-1" }], error: null });
      const stampBuilder = createQueryBuilder({ error: null });
      const readBuilder = createQueryBuilder({ data: ACCOUNT_ROW, error: null });
      mockAdmin({ broker_accounts: [dormantBuilder, claimBuilder, stampBuilder, readBuilder] });
      vi.mocked(getAccount).mockResolvedValue(LIVE_PARKED);
      vi.mocked(updateAccountPassword).mockResolvedValue(undefined);

      const response = await POST(createRequest(CONNECT));

      expect(response.status).toBe(200);
      // Nothing is created, so nothing is counted: a trader fixing a password five times in a
      // day must not be locked out by a budget meant for $2.10 creates.
      expect(claimBrokerCreate).not.toHaveBeenCalled();
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

  describe("PUT — investor password update on the live connection", () => {
    function mockConnected() {
      const rowBuilder = createQueryBuilder({ data: ACCOUNT_ROW, error: null });
      const stampBuilder = createQueryBuilder({ data: ACCOUNT_ROW, error: null });
      mockAdmin({ broker_accounts: [rowBuilder, stampBuilder, rowBuilder] });
      vi.mocked(getAccount).mockResolvedValue(LIVE_PARKED);
      vi.mocked(updateAccountPassword).mockResolvedValue(undefined);
      vi.mocked(undeployAccount).mockResolvedValue(undefined);
      return { rowBuilder, stampBuilder };
    }

    it("puts the new password on the account, parks it, and clears the rejected stamp", async () => {
      mockSession();
      const { stampBuilder } = mockConnected();

      const response = await PUT(putRequest({ password: "new-investor-pw" }));

      expect(response.status).toBe(200);
      // MetaApi validates the password synchronously — a bad one never gets this far.
      expect(updateAccountPassword).toHaveBeenCalledWith({
        accountId: "meta-1",
        userId: "user-1",
        server: "ICMarketsSC-MT5",
        password: "new-investor-pw",
      });
      // Parked so a deployed terminal stops hammering the broker with the OLD password; the
      // new one takes effect on the next deploy anyway.
      expect(undeployAccount).toHaveBeenCalledWith("meta-1");
      // Clearing the stamp is what lets the wake pass deploy this account again.
      expect(stampBuilder.update).toHaveBeenCalledWith({ last_sync_error: null, last_synced_at: null });
    });

    it("400s a password the broker refuses, without parking or stamping", async () => {
      mockSession();
      const { stampBuilder } = mockConnected();
      vi.mocked(updateAccountPassword).mockRejectedValue(new MetaApiError(400, "We failed to authenticate…", "E_AUTH"));

      const response = await PUT(putRequest({ password: "still-wrong" }));

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ error: "broker_credentials_rejected" });
      expect(undeployAccount).not.toHaveBeenCalled();
      expect(stampBuilder.update).not.toHaveBeenCalledWith({ last_sync_error: null });
    });

    it("keeps a completed password update when the read-back fails", async () => {
      mockSession();
      const rejected = {
        ...ACCOUNT_ROW,
        last_sync_error: "Your broker turned the login away. Update the investor password and sync again.",
      };
      const rowBuilder = createQueryBuilder({ data: rejected, error: null });
      const stampBuilder = createQueryBuilder({ data: rejected, error: null });
      const failedRead = createQueryBuilder({ data: null, error: { message: "connection reset" } });
      mockAdmin({ broker_accounts: [rowBuilder, stampBuilder, failedRead] });
      vi.mocked(getAccount).mockResolvedValue(LIVE_PARKED);
      vi.mocked(updateAccountPassword).mockResolvedValue(undefined);
      vi.mocked(undeployAccount).mockResolvedValue(undefined);

      const response = await PUT(putRequest({ password: "new-investor-pw" }));

      // The password is already changed at MetaApi. A 502 sends the trader back to pay $0.105
      // for another validation of a password that is already live.
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        account: { state: "linking", lastSyncError: null, credentialsRejected: false },
      });
    });

    it("409s when there is no connection to update", async () => {
      mockSession();
      mockAdmin({ broker_accounts: [createQueryBuilder({ data: null, error: null })] });

      const response = await PUT(putRequest({ password: "new-investor-pw" }));

      expect(response.status).toBe(409);
      expect(updateAccountPassword).not.toHaveBeenCalled();
    });

    it("drops the failed-sync watermark with the stamp, so the trades from the outage still import", async () => {
      // The row a refused login leaves behind. Every failed sync stamps last_synced_at on its
      // way out (it is what the deploy cooldown reads), so that column holds the moment the
      // broker started saying no — not the last time trades actually came in.
      mockSession();
      const rejected = {
        ...ACCOUNT_ROW,
        last_synced_at: "2026-07-28T02:05:00.000Z",
        last_sync_error: "Your broker turned the login away. Update the investor password and sync again.",
      };
      const rowBuilder = createQueryBuilder({ data: rejected, error: null });
      const stampBuilder = createQueryBuilder({ data: rejected, error: null });
      mockAdmin({ broker_accounts: [rowBuilder, stampBuilder, rowBuilder] });
      vi.mocked(getAccount).mockResolvedValue(LIVE_PARKED);
      vi.mocked(updateAccountPassword).mockResolvedValue(undefined);
      vi.mocked(undeployAccount).mockResolvedValue(undefined);

      const response = await PUT(putRequest({ password: "new-investor-pw" }));

      expect(response.status).toBe(200);
      expect(stampBuilder.update).toHaveBeenCalledWith({ last_sync_error: null, last_synced_at: null });

      // What the missing half costs, spelled out: computeSyncWindow only distrusts
      // last_synced_at while last_sync_error is set. Clear the error alone and the very next
      // window opens at the FAILURE stamp — every trade closed while the login was being
      // refused is silently skipped, permanently, because the window never reaches back again.
      const now = new Date("2026-08-04T09:00:00.000Z");
      const stampKept = computeSyncWindow({ last_synced_at: rejected.last_synced_at, last_sync_error: null }, now);
      expect(stampKept.start.toISOString()).toBe("2026-07-27T00:00:00.000Z");
      // Cleared, the recovery sync re-reads the whole first-sync window, which covers the
      // outage however long it ran. Re-imports are idempotent, so it costs a page of reads.
      const stampCleared = computeSyncWindow({ last_synced_at: null, last_sync_error: null }, now);
      expect(stampCleared.start.toISOString()).toBe("2026-07-05T00:00:00.000Z");
    });

    it("hands the attempt back when the failure was ours, not a refused password", async () => {
      // Nothing here reached MetaApi's billable validation: the account read failed first. The
      // budget is claimed before the request knows which path it takes, so an unbillable
      // failure must not spend it — five of these and the trader is locked out for ten minutes
      // over a wobble at our end.
      mockSession();
      mockAdmin({ broker_accounts: [createQueryBuilder({ data: ACCOUNT_ROW, error: null })] });
      vi.mocked(getAccount).mockRejectedValue(new MetaApiError(502, "upstream unavailable"));

      const response = await PUT(putRequest({ password: "new-investor-pw" }));

      expect(response.status).toBe(502);
      expect(updateAccountPassword).not.toHaveBeenCalled();
      expect(refundCredentialAttempt).toHaveBeenCalledWith("user-1");
    });

    it("keeps the attempt when MetaApi refused the password — that validation was billed", async () => {
      mockSession();
      mockConnected();
      vi.mocked(updateAccountPassword).mockRejectedValue(new MetaApiError(400, "We failed to authenticate…", "E_AUTH"));

      const response = await PUT(putRequest({ password: "still-wrong" }));

      expect(response.status).toBe(400);
      expect(refundCredentialAttempt).not.toHaveBeenCalled();
    });
  });
});
