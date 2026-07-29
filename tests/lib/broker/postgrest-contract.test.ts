import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { createClient } from "@supabase/supabase-js";

import { deployAccount, fetchHistoricalTrades, getAccount } from "@/lib/broker/metaapi";
import { advanceBrokerSync } from "@/lib/broker/sync";

/**
 * The engine's two money/data guards are not written in TypeScript — they are PostgREST
 * request shapes, and the hand-rolled builder fakes the other broker tests use will return
 * whatever you hand them however the query is written. So these run the REAL engine through
 * the REAL supabase-js with only `fetch` stubbed, and assert what actually goes on the wire:
 *
 *   1. The importer's insert must carry `resolution=ignore-duplicates` AND
 *      `return=representation`. Together those are `ON CONFLICT DO NOTHING … RETURNING`,
 *      whose result set is exactly the rows that were really inserted — which is the ONLY
 *      reason `insertedDates` can be trusted to say "these days were not already there".
 *      Lose the first and an existing day is overwritten; lose the second and the response
 *      is empty, every day looks pre-existing, and the rewrite branch takes over.
 *   2. The deploy claim must be ONE conditional PATCH carrying the `or=(…)` staleness test,
 *      with `return=representation` so the matched rows come back. That returned row count is
 *      what decides whether we pay MetaApi's per-deployment fee, so a claim that silently
 *      stopped filtering — or stopped returning rows — is a billing bug, not a logic bug.
 *
 * A missing `.select()`, a dropped filter, or a supabase-js release that renames a Prefer
 * token all fail here. They do not fail anywhere else.
 */

type Captured = { method: string; url: string; prefer: string; body: string };

const ROW = {
  id: "row-1",
  user_id: "user-1",
  metaapi_account_id: "meta-1",
  platform: "mt5" as const,
  region: "london",
  last_synced_at: null,
  last_sync_error: null,
  created_at: "2026-07-01T00:00:00.000Z",
};

/**
 * A supabase client whose transport is a recorder. Each reply is keyed by the table in the
 * path, so the engine's own call order decides which is used.
 */
function recordingClient(replies: Record<string, unknown[]>) {
  const captured: Captured[] = [];

  const fetchStub = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    captured.push({
      method: init?.method ?? "GET",
      url: decodeURIComponent(url),
      prefer: headers.get("prefer") ?? "",
      body: typeof init?.body === "string" ? init.body : "",
    });

    const table = url.split("/rest/v1/")[1]?.split("?")[0] ?? "";
    return new Response(JSON.stringify(replies[table] ?? []), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });

  const client = createClient("https://example.supabase.co", "service-role-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchStub as unknown as typeof fetch },
  });

  return { client, captured };
}

const find = (captured: Captured[], method: string, table: string) =>
  captured.filter((call) => call.method === method && call.url.includes(`/rest/v1/${table}`));

describe("broker engine → PostgREST contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("imports with ON CONFLICT DO NOTHING … RETURNING, and rewrites only its own live rows", async () => {
    // Two days come back from the broker; the reply says only one was newly inserted, so the
    // other must fall through to the rewrite branch. That split is the behaviour under test.
    const { client, captured } = recordingClient({
      journal_entries: [{ entry_date: "2026-07-02" }],
      broker_accounts: [],
    });
    vi.mocked(getAccount).mockResolvedValue({
      _id: "meta-1",
      state: "DEPLOYED",
      connectionStatus: "CONNECTED",
      region: "london",
      baseCurrency: "USD",
    });
    vi.mocked(fetchHistoricalTrades).mockResolvedValue([
      { _id: "t1", accountId: "meta-1", type: "DEAL_TYPE_BUY", profit: 10, closeTime: "2026-07-01 10:00:00.000" },
      { _id: "t2", accountId: "meta-1", type: "DEAL_TYPE_SELL", profit: -4, closeTime: "2026-07-02 11:00:00.000" },
    ]);

    const result = await advanceBrokerSync(client, ROW);

    const insert = find(captured, "POST", "journal_entries");
    expect(insert).toHaveLength(1);
    // Guard 1. Both tokens, or the importer either clobbers a trader's day or loses track of
    // which days it actually created.
    expect(insert[0].prefer).toContain("resolution=ignore-duplicates");
    expect(insert[0].prefer).toContain("return=representation");
    expect(insert[0].url).toContain("on_conflict=user_id,entry_date");
    // The broker's base currency, not the journal's GBP default.
    expect(insert[0].body).toContain('"pnl_currency":"USD"');

    // 2026-07-02 came back as inserted, so 2026-07-01 is the pre-existing one to rewrite.
    const rewrite = find(captured, "PATCH", "journal_entries");
    expect(rewrite).toHaveLength(1);
    expect(rewrite[0].url).toContain("entry_date=eq.2026-07-01");
    // `source=eq.broker` is what makes a hand-typed day untouchable; `deleted_at=is.null` is
    // what keeps a deleted day deleted. Both live in the WHERE, never in TypeScript.
    expect(rewrite[0].url).toContain("source=eq.broker");
    expect(rewrite[0].url).toContain("deleted_at=is.null");
    expect(rewrite[0].prefer).toContain("return=representation");

    expect(result).toEqual({ status: "imported", importedDays: 2, skippedDays: 0 });
  });

  it("counts a day it does not own as skipped rather than imported", async () => {
    // Nothing inserted and nothing rewritten: the day exists and is either the trader's own
    // or soft-deleted. It must not be counted as imported.
    const { client } = recordingClient({ journal_entries: [], broker_accounts: [] });
    vi.mocked(getAccount).mockResolvedValue({
      _id: "meta-1",
      state: "DEPLOYED",
      connectionStatus: "CONNECTED",
      region: "london",
      baseCurrency: "USD",
    });
    vi.mocked(fetchHistoricalTrades).mockResolvedValue([
      { _id: "t1", accountId: "meta-1", type: "DEAL_TYPE_BUY", profit: 10, closeTime: "2026-07-01 10:00:00.000" },
    ]);

    const result = await advanceBrokerSync(client, ROW);

    expect(result).toEqual({ status: "imported", importedDays: 0, skippedDays: 1 });
  });

  it("claims the deployment in one conditional PATCH before paying for it", async () => {
    const { client, captured } = recordingClient({ broker_accounts: [{ id: "row-1" }] });
    vi.mocked(getAccount).mockResolvedValue({
      _id: "meta-1",
      state: "UNDEPLOYED",
      connectionStatus: "DISCONNECTED",
      region: "london",
    });

    const result = await advanceBrokerSync(client, ROW);

    const claim = find(captured, "PATCH", "broker_accounts");
    expect(claim).toHaveLength(1);
    // Guard 2. The staleness test and the take are the same statement — check-then-update
    // leaves a gap two pollers both fit through, and each one bills.
    expect(claim[0].url).toContain("or=(last_deploy_at.is.null,last_deploy_at.lt.");
    expect(claim[0].url).toContain("id=eq.row-1");
    expect(claim[0].prefer).toContain("return=representation");
    expect(deployAccount).toHaveBeenCalledWith("meta-1");
    expect(result).toEqual({ status: "linking" });
  });

  it("does not deploy when another poller already holds the claim", async () => {
    // Same conditional PATCH, but it matched nothing — someone else got there first.
    const { client } = recordingClient({ broker_accounts: [] });
    vi.mocked(getAccount).mockResolvedValue({
      _id: "meta-1",
      state: "UNDEPLOYED",
      connectionStatus: "DISCONNECTED",
      region: "london",
    });

    const result = await advanceBrokerSync(client, ROW);

    expect(deployAccount).not.toHaveBeenCalled();
    expect(result).toEqual({ status: "linking" });
  });
});
