import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/broker/sync", () => ({
  runBrokerSyncPass: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/observability/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { GET } from "@/app/api/broker/cron/route";
import { runBrokerSyncPass } from "@/lib/broker/sync";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * The cron endpoint is the only unauthenticated-by-session surface in the broker feature and
 * it is the one that SPENDS: `?pass=wake` deploys every connected account, at MetaApi's
 * per-deployment fee each. An open door here is a bill, not a data leak — which is why the
 * gate gets tested rather than assumed.
 */

const SECRET = "cron-secret-value";

function request(query: string, headers: Record<string, string> = {}) {
  return new Request(`http://localhost/api/broker/cron${query}`, { headers });
}

const authed = { authorization: `Bearer ${SECRET}` };

describe("Broker cron route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", SECRET);
    vi.mocked(getSupabaseAdminClient).mockReturnValue({} as never);
    vi.mocked(runBrokerSyncPass).mockResolvedValue({ accounts: 0, results: [], errors: [] });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("401s a request with no bearer, before any account is touched", async () => {
    const response = await GET(request("?pass=wake"));

    expect(response.status).toBe(401);
    expect(runBrokerSyncPass).not.toHaveBeenCalled();
  });

  it("401s a wrong bearer", async () => {
    const response = await GET(request("?pass=wake", { authorization: "Bearer nope" }));

    expect(response.status).toBe(401);
    expect(runBrokerSyncPass).not.toHaveBeenCalled();
  });

  it("fails CLOSED in production when CRON_SECRET is missing", async () => {
    // A misconfigured production deploy must be shut, not open — otherwise an anonymous GET
    // wakes and bills every connected account.
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("VERCEL_ENV", "production");

    const response = await GET(request("?pass=wake"));

    expect(response.status).toBe(401);
    expect(runBrokerSyncPass).not.toHaveBeenCalled();
  });

  it("stays open in dev when CRON_SECRET is missing, so a local run needs no secret", async () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("VERCEL_ENV", "development");

    const response = await GET(request("?pass=pull"));

    expect(response.status).toBe(200);
    expect(runBrokerSyncPass).toHaveBeenCalledWith(expect.anything(), "pull");
  });

  it("rejects an unknown pass rather than guessing which one was meant", async () => {
    // Guessing would be expensive in one direction: defaulting to `wake` spends money.
    const response = await GET(request("?pass=everything", authed));

    expect(response.status).toBe(400);
    expect(runBrokerSyncPass).not.toHaveBeenCalled();
  });

  // The old three-pass cadence. A stale pg_cron job still firing these must 400 rather than
  // be quietly mapped onto a pass that now means something different.
  it.each(["deploy", "collect", "close"])("400s the retired %s pass", async (pass) => {
    const response = await GET(request(`?pass=${pass}`, authed));

    expect(response.status).toBe(400);
    expect(runBrokerSyncPass).not.toHaveBeenCalled();
  });

  it("rejects a missing pass", async () => {
    const response = await GET(request("", authed));

    expect(response.status).toBe(400);
    expect(runBrokerSyncPass).not.toHaveBeenCalled();
  });

  it.each(["wake", "pull"] as const)("runs the %s pass", async (pass) => {
    vi.mocked(runBrokerSyncPass).mockResolvedValue({
      accounts: 2,
      results: [`row-1:imported:3/1`],
      errors: [],
    });

    const response = await GET(request(`?pass=${pass}`, authed));

    expect(response.status).toBe(200);
    expect(runBrokerSyncPass).toHaveBeenCalledWith(expect.anything(), pass);
    await expect(response.json()).resolves.toMatchObject({ ok: true, pass, accounts: 2 });
  });

  it("500s without running anything when the service-role client is unavailable", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue(null as never);

    const response = await GET(request("?pass=pull", authed));

    expect(response.status).toBe(500);
    expect(runBrokerSyncPass).not.toHaveBeenCalled();
  });

  it("reports a pass that blew up rather than answering ok", async () => {
    vi.mocked(runBrokerSyncPass).mockRejectedValue(new Error("broker_accounts read failed"));

    const response = await GET(request("?pass=pull", authed));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ ok: false, pass: "pull" });
  });
});
