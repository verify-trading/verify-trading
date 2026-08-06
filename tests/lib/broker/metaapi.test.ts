import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/observability/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { logger } from "@/lib/observability/logger";
import {
  createAccount,
  deleteAccount,
  deployAccount,
  fetchHistoricalTrades,
  formatMetaStatsTime,
  MetaApiError,
  searchServers,
  updateAccountPassword,
} from "@/lib/broker/metaapi";

/**
 * The paging walk. What is under test is the EXIT, not the happy path: the loop is bounded,
 * and running it out on a full page means there are trades we never read. Returning the
 * partial set would import the last day of the walk as if it were complete and then stamp
 * last_synced_at past it, so the missing trades are never asked for again.
 */

const PAGE_SIZE = 1000;
const MAX_PAGES = 100;
const TOTAL_PAGE_BUDGET = 400;

function tradesPage(size: number) {
  return Array.from({ length: size }, (_, index) => ({
    _id: `trade-${index}`,
    accountId: "meta-1",
    type: "DEAL_TYPE_BUY",
    profit: 1,
    closeTime: "2026-07-20 10:00:00.000",
  }));
}

/**
 * Stubs fetch with a scripted list of replies, recording each request. The last entry
 * repeats, so a one-element script means "answer every call the same way" — which is what
 * the paging tests want, and a multi-element one is the 202-poll sequence below.
 * `retry-after: 0` collapses the transport's real backoff so nothing here actually sleeps.
 */
function stubSequence(replies: Array<{ status: number; body?: unknown }>) {
  const calls: Array<{ url: string; transactionId: string | null; body: string }> = [];
  let index = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      calls.push({
        url: decodeURIComponent(String(input)),
        transactionId: headers.get("transaction-id"),
        body: typeof init?.body === "string" ? init.body : "",
      });
      const reply = replies[Math.min(index, replies.length - 1)];
      index += 1;
      // null, not "": bodyless statuses (204 on the password PUT) reject any body at all.
      return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
        status: reply.status,
        headers: { "Content-Type": "application/json", "retry-after": "0" },
      });
    }),
  );
  return calls;
}

const tradesReply = (size: number) => [{ status: 200, body: { trades: tradesPage(size) } }];

const window = {
  accountId: "meta-1",
  region: "london",
  start: new Date("2026-05-01T00:00:00.000Z"),
  end: new Date("2026-07-30T00:00:00.000Z"),
};

describe("fetchHistoricalTrades", () => {
  beforeEach(() => {
    vi.stubEnv("METAAPI_TOKEN", "test-token");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("stops at the first short page and returns what it read", async () => {
    const calls = stubSequence(tradesReply(12));

    const trades = await fetchHistoricalTrades(window);

    expect(trades).toHaveLength(12);
    expect(calls).toHaveLength(1);
    // Only the first page refreshes from the terminal; there is no second page here.
    expect(calls[0].url).toContain("updateHistory=true");
  });

  it("halves a dense window instead of failing, and refreshes the terminal only once", async () => {
    // First window is full to the cap -> too dense; each half then comes back short. What
    // must NOT happen is a throw: throwing stamps last_sync_error, computeSyncWindow reads
    // that as "never synced", and the next run re-requests the same window forever.
    let call = 0;
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = decodeURIComponent(String(input));
      calls.push(url);
      call += 1;
      // Only the first window (the first MAX_PAGES calls) is dense; the halves are short.
      const size = call <= MAX_PAGES ? PAGE_SIZE : 3;
      return new Response(JSON.stringify({ trades: tradesPage(size) }), {
        status: 200,
        headers: { "Content-Type": "application/json", "retry-after": "0" },
      });
    }));

    const trades = await fetchHistoricalTrades(window);

    // The two halves' trades came back rather than an exception. The dense first attempt is
    // DISCARDED rather than merged: it was a partial view of a window we then read properly,
    // and keeping it would mix two readings of the same range.
    expect(trades).toHaveLength(6);
    // 100 pages proving the window was too dense, then one short page per half.
    expect(calls).toHaveLength(MAX_PAGES + 2);
    // Exactly one terminal refresh across the whole walk, splits included — each one costs a
    // round trip through the running terminal.
    expect(calls.filter((url) => url.includes("updateHistory=true"))).toHaveLength(1);
    // And the halves really were narrower than the window they came from.
    expect(calls.at(-1)).not.toEqual(calls[0]);
  });

  it("gives up once the whole walk exceeds its total page budget", async () => {
    // Every window dense at every depth: bisection would subdivide until the function timed
    // out, so the total budget — not the per-window cap — is what stops it.
    const calls = stubSequence(tradesReply(PAGE_SIZE));

    await expect(fetchHistoricalTrades(window)).rejects.toBeInstanceOf(MetaApiError);
    expect(calls.length).toBeLessThanOrEqual(TOTAL_PAGE_BUDGET);
  });
});

/**
 * The transport. MetaApi answers a write with `202 Accepted` meaning "still working, ask
 * again", and the poll is the IDENTICAL request with the SAME transaction-id — a fresh id
 * registers as a second billable write. 202 also satisfies `response.ok`, so nothing below
 * the transport can tell a half-finished write from a finished one. That combination is why
 * this layer gets its own tests rather than being covered incidentally through the engine.
 */
describe("MetaApi transport", () => {
  beforeEach(() => {
    vi.stubEnv("METAAPI_TOKEN", "test-token");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("re-sends a 202 with the SAME transaction-id, so the poll is not a second billable write", async () => {
    const calls = stubSequence([{ status: 202 }, { status: 202 }, { status: 200, body: { id: "meta-1" } }]);

    const created = await createAccount({ userId: "user-1", platform: "mt5", server: "ICMarketsSC-MT5", login: "123456", password: "pw" });

    expect(created).toEqual({ id: "meta-1" });
    expect(calls).toHaveLength(3);
    // The whole point: one id across the retries. Minting a fresh one per attempt is what
    // would turn a slow create into three paid accounts.
    expect(new Set(calls.map((call) => call.transactionId)).size).toBe(1);
    expect(calls[0].transactionId).toMatch(/^[0-9a-f]{32}$/);
    // And the payload is re-sent byte-identical, which is what makes it the same write.
    expect(new Set(calls.map((call) => call.body)).size).toBe(1);
  });

  it("throws instead of returning a half-finished body when 202 never settles", async () => {
    // 202 satisfies response.ok. Waving it through hands the caller an object with no `id`,
    // and account/route.ts then aims its compensating delete at `undefined` while the real
    // account bills on. So the transport has to refuse it.
    const calls = stubSequence([{ status: 202 }]);

    await expect(
      createAccount({ userId: "user-1", platform: "mt5", server: "ICMarketsSC-MT5", login: "123456", password: "pw" }),
    ).rejects.toMatchObject({ status: 202 });
    // And it gives up after THREE polls. The budget is bounded by the route's 300 s maxDuration,
    // not by patience: each poll can wait a capped 60 s and costs up to ~30 s of its own (the
    // transport sends every request twice before giving up), so a fourth reaches the ceiling —
    // where the function is killed mid-poll and the compensating delete never runs.
    expect(calls).toHaveLength(3);
  });

  it("sends the create payload the cost model depends on, credentials included", async () => {
    const calls = stubSequence([{ status: 200, body: { id: "meta-1" } }]);

    await createAccount({ userId: "user-1", platform: "mt5", server: "ICMarketsSC-MT5", login: "123456", password: "investor-pw" });

    const body = JSON.parse(calls[0].body);
    // The credentials ARE the point of this create: MetaApi validates them synchronously, so
    // a wrong investor password fails the request (E_AUTH) instead of the next deploy. They
    // are forwarded here and nowhere else — never stored, never logged.
    expect(body.login).toBe("123456");
    expect(body.password).toBe("investor-pw");
    // metastatsApiEnabled cannot be turned on later without stopping and re-billing the
    // account, and historical-trades 403s without it — so it has to be right at creation.
    expect(body.metastatsApiEnabled).toBe(true);
    // cloud-g2 + high is the tier the whole cost model is quoted against.
    expect(body).toMatchObject({ type: "cloud-g2", reliability: "high", manualTrades: true, magic: 0 });
    expect(body.metadata).toEqual({ verifyUserId: "user-1" });
  });

  it("logs the create's transaction-id BEFORE the call, so a killed invocation still leaves a trail", async () => {
    const calls = stubSequence([{ status: 200, body: { id: "meta-1" } }]);

    await createAccount({ userId: "user-1", platform: "mt5", server: "ICMarketsSC-MT5", login: "123456", password: "pw" });

    // The id logged is the id sent — a different one would be useless for finding the account.
    expect(logger.info).toHaveBeenCalledWith("MetaApi account create starting.", {
      transactionId: calls[0].transactionId,
      userId: "user-1",
    });
    // And it is on the record before the network call. This create can outlive its 300 s
    // invocation while polling; a killed function returns nothing, throws nothing and runs no
    // compensating delete, so the only trace of a paid $2.10 orphan is what was logged first.
    expect(vi.mocked(logger.info).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(fetch).mock.invocationCallOrder[0],
    );
  });

  it("reads MetaApi's validation code and server suggestions out of a failed create", async () => {
    // The account route rewrites E_AUTH/E_SRV_NOT_FOUND into short trader copy keyed off
    // `code` — losing it here would turn a wrong password into an anonymous 502.
    stubSequence([{
      status: 400,
      body: {
        error: "ValidationError",
        message: ".dat file for server ICMarkets-Demo not found…",
        details: { code: "E_SRV_NOT_FOUND", serversByBrokers: { "Raw Trading Ltd": ["ICMarketsSC-Demo", "ICMarketsSC-MT5"] } },
      },
    }]);

    const failure = await createAccount({ userId: "user-1", platform: "mt5", server: "ICMarkets-Demo", login: "1", password: "pw" }).catch((error) => error);
    expect(failure).toMatchObject({
      status: 400,
      code: "E_SRV_NOT_FOUND",
      suggestedServers: ["ICMarketsSC-Demo", "ICMarketsSC-MT5"],
    });

    // …and the other documented shape, `details` as a plain string (E_AUTH).
    stubSequence([{ status: 400, body: { error: "ValidationError", message: "We failed to authenticate…", details: "E_AUTH" } }]);

    await expect(
      createAccount({ userId: "user-1", platform: "mt5", server: "ICMarketsSC-MT5", login: "1", password: "wrong" }),
    ).rejects.toMatchObject({ status: 400, code: "E_AUTH" });
  });

  it("puts a new password on the account with the fields the update requires", async () => {
    // 204 No Content on success — and the PUT re-validates synchronously, so this call is
    // where a bad replacement password surfaces, not the next deploy.
    const calls = stubSequence([{ status: 204 }]);

    await updateAccountPassword({ accountId: "meta-1", userId: "user-1", server: "ICMarketsSC-MT5", password: "new-pw" });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("/users/current/accounts/meta-1");
    const body = JSON.parse(calls[0].body);
    // password, name and server are the required PUT fields; login is not in the schema
    // because it cannot change — a different login is a different account, created fresh.
    expect(body).toMatchObject({ password: "new-pw", server: "ICMarketsSC-MT5" });
    expect(body.name).toContain("user-1");
    expect(body).not.toHaveProperty("login");
    // Every setting the create chose rides along, unchanged. MetaApi does not document whether
    // this PUT merges or replaces, and under replace semantics a partial body silently drops
    // the g2 tier the cost model is quoted against, the metadata tying the account to a user,
    // and metastatsApiEnabled — which cannot be turned back on without re-billing the account.
    // Re-sending what is already stored is a no-op under merge, so this body is safe under both.
    expect(body).toMatchObject({
      type: "cloud-g2",
      reliability: "high",
      manualTrades: true,
      magic: 0,
      metastatsApiEnabled: true,
      riskManagementApiEnabled: false,
      tags: ["verify-trading"],
      metadata: { verifyUserId: "user-1" },
    });
  });

  it("surfaces MetaApi's own message, because the trader reads it", async () => {
    stubSequence([{ status: 400, body: { message: "Configuration token does not match the account id" } }]);

    await expect(deployAccount("meta-1")).rejects.toThrow(/Configuration token does not match/);
  });

  it("treats a 404 delete as success — already gone is the state we wanted", async () => {
    stubSequence([{ status: 404, body: { message: "account not found" } }]);

    await expect(deleteAccount("meta-1")).resolves.toBeUndefined();
  });

  it("still throws on a delete that failed for any other reason", async () => {
    stubSequence([{ status: 403, body: { message: "forbidden" } }]);

    await expect(deleteAccount("meta-1")).rejects.toBeInstanceOf(MetaApiError);
  });

  it("flattens and dedupes the broker→servers map for the picker", async () => {
    stubSequence([{ status: 200, body: { "IC Markets": ["ICMarketsSC-MT5", "ICMarketsSC-Demo"], "IC Markets EU": ["ICMarketsSC-MT5"] } }]);

    await expect(searchServers("mt5", "ic markets")).resolves.toEqual(["ICMarketsSC-MT5", "ICMarketsSC-Demo"]);
  });

  it("asks the version-numbered server path, not the platform string", async () => {
    const calls = stubSequence([{ status: 200, body: {} }]);

    await searchServers("mt4", "pepper");

    // /known-mt-servers/4/… with no /users/current prefix. Both are easy to get wrong and
    // both 404 in a way that reads like "no such broker".
    expect(calls[0].url).toContain("/known-mt-servers/4/search?query=pepper");
    expect(calls[0].url).not.toContain("/users/current");
  });

  it("throws a clear error rather than calling MetaApi unauthenticated", async () => {
    vi.stubEnv("METAAPI_TOKEN", "");
    const calls = stubSequence([{ status: 200, body: {} }]);

    await expect(deployAccount("meta-1")).rejects.toThrow(/METAAPI_TOKEN/);
    expect(calls).toHaveLength(0);
  });
});

describe("formatMetaStatsTime", () => {
  it("emits MetaStats' space-separated shape, not ISO", async () => {
    // No `T`, no `Z`, milliseconds kept. The caller must encodeURIComponent it — the literal
    // space has to survive as %20 or the request never leaves the process.
    expect(formatMetaStatsTime(new Date("2026-07-29T14:25:11.579Z"))).toBe("2026-07-29 14:25:11.579");
  });
});
