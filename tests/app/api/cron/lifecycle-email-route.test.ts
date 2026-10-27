import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/email/lifecycle/config", () => ({
  POLICY: { startDate: "2026-10-01T00:00:00.000Z", dailyBudget: 10, maxPerRun: 3, sendGapMs: 600 },
}));

// Test rows carry the pick in `display_name` so each user's due email is set per test.
vi.mock("@/lib/email/lifecycle/pick", () => ({
  factsFromRow: vi.fn((row: { user_id: string; email: string; display_name: string | null }) => ({
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
  })),
  pickEmail: vi.fn((facts: { displayName: string | null }) => {
    if (!facts.displayName) return null;
    const [emailId, priority] = facts.displayName.split(":");
    return {
      emailId,
      dedupeKey: emailId,
      kind: "marketing",
      priority: Number(priority),
      variant: null,
      vars: { firstName: "there" },
    };
  }),
}));

vi.mock("@/lib/email/lifecycle/send", () => ({
  sendLifecycleEmail: vi.fn(),
}));

vi.mock("@/lib/email/maybe-send-subscription-welcome", () => ({
  retrySubscriptionWelcomeEmails: vi.fn(),
}));

import { retrySubscriptionWelcomeEmails } from "@/lib/email/maybe-send-subscription-welcome";
import { GET } from "@/app/api/cron/lifecycle-email/route";
import { sendLifecycleEmail } from "@/lib/email/lifecycle/send";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type Row = { user_id: string; email: string; display_name: string | null };

function row(id: string, pick: string | null, email = `${id}@example.com`): Row {
  return { user_id: id, email, display_name: pick };
}

function createSupabaseMock({ sentToday = 0, rows = [] as Row[], factsError = null as unknown } = {}) {
  const gte = vi.fn().mockResolvedValue({ count: sentToday, error: null });
  const or = vi.fn(() => ({ gte }));
  const select = vi.fn(() => ({ or }));
  // rpc(...).is(...).order(...).range(from, to) — pages through `rows` like PostgREST would.
  const is = vi.fn();
  const range = vi.fn((from: number, to: number) =>
    Promise.resolve(factsError ? { data: null, error: factsError } : { data: rows.slice(from, to + 1), error: null }),
  );
  const chain = { is, order: vi.fn(), range };
  is.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  const rpc = vi.fn(() => chain);
  const client = { from: vi.fn(() => ({ select })), rpc };
  vi.mocked(getSupabaseAdminClient).mockReturnValue(client as never);
  return { client, select, gte, rpc, is, range };
}

function request(secret = "cron-secret") {
  return new Request("http://localhost/api/cron/lifecycle-email", {
    headers: { authorization: `Bearer ${secret}` },
  });
}

async function run(req = request()) {
  const pending = GET(req);
  await vi.runAllTimersAsync();
  const response = await pending;
  return { status: response.status, json: await response.json() };
}

describe("GET /api/cron/lifecycle-email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(retrySubscriptionWelcomeEmails).mockResolvedValue(0);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T12:00:00.000Z"));
    vi.stubEnv("CRON_SECRET", "cron-secret");
    vi.stubEnv("LIFECYCLE_EMAIL_TEST_TO", "");
    vi.mocked(sendLifecycleEmail).mockResolvedValue("sent");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("rejects a request without the cron secret", async () => {
    const supabase = createSupabaseMock();
    const { status } = await run(new Request("http://localhost/api/cron/lifecycle-email"));

    expect(status).toBe(401);
    expect(supabase.client.from).not.toHaveBeenCalled();
  });

  it("stops before loading facts when the daily budget is used up", async () => {
    const supabase = createSupabaseMock({ sentToday: 10, rows: [row("u1", "c1:20")] });

    const { json } = await run();

    expect(json).toEqual({ ok: true, mode: "live", budgetExhausted: true, welcomeRetries: 0 });
    expect(supabase.client.from).toHaveBeenCalledWith("email_sends");
    expect(supabase.select).toHaveBeenCalledWith("id", { count: "exact", head: true });
    expect(supabase.gte).toHaveBeenCalledWith("sent_at", "2026-10-15T00:00:00.000Z");
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(sendLifecycleEmail).not.toHaveBeenCalled();
  });

  it("with TEST_TO set, sends only to those addresses", async () => {
    vi.stubEnv("LIFECYCLE_EMAIL_TEST_TO", " Tester@Example.com , other@example.com");
    createSupabaseMock({
      rows: [row("u1", "c1:20", "tester@example.com"), row("u2", "c1:20", "stranger@example.com")],
    });

    const { json } = await run();

    expect(json).toMatchObject({ mode: "test", considered: 1, picked: 1, sent: 1 });
    expect(sendLifecycleEmail).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendLifecycleEmail).mock.calls[0]?.[0]).toMatchObject({ to: "tester@example.com" });
  });

  it("without TEST_TO, runs live for everyone after START", async () => {
    createSupabaseMock({ rows: [row("u1", "c1:20"), row("u2", "c1:20", "stranger@example.com")] });

    const { json } = await run();

    expect(json).toMatchObject({ mode: "live", considered: 2, sent: 2 });
  });

  it("sends picks by priority, capped by maxPerRun", async () => {
    const supabase = createSupabaseMock({
      rows: [row("u1", "r3:80"), row("u2", "c3:10"), row("u3", null), row("u4", "e2a:40"), row("u5", "c1:20")],
    });

    const { json } = await run();

    expect(supabase.rpc).toHaveBeenCalledWith("lifecycle_user_facts", { p_since: "2026-10-01T00:00:00.000Z" });
    expect(vi.mocked(sendLifecycleEmail).mock.calls.map(([input]) => input.userId)).toEqual(["u2", "u5", "u4"]);
    expect(vi.mocked(sendLifecycleEmail).mock.calls[0]?.[0]).toEqual({
      userId: "u2",
      to: "u2@example.com",
      emailId: "c3",
      dedupeKey: "c3",
      kind: "marketing",
      variant: null,
      vars: { firstName: "there" },
    });
    expect(json).toEqual({
      ok: true,
      mode: "live",
      welcomeRetries: 0,
      considered: 5,
      picked: 3,
      sent: 3,
      duplicate: 0,
      failed: 0,
      skipped: 0,
    });
  });

  it("caps picks by the remaining daily budget and tallies each result", async () => {
    vi.mocked(sendLifecycleEmail).mockResolvedValueOnce("duplicate").mockResolvedValueOnce("failed");
    createSupabaseMock({ sentToday: 8, rows: [row("u1", "c1:20"), row("u2", "c3:10"), row("u3", "e2a:40")] });

    const { json } = await run();

    expect(sendLifecycleEmail).toHaveBeenCalledTimes(2);
    expect(json).toMatchObject({ considered: 3, picked: 2, sent: 0, duplicate: 1, failed: 1, skipped: 0 });
  });

  it("waits sendGapMs between sends, not after the last", async () => {
    const timeout = vi.spyOn(globalThis, "setTimeout");
    createSupabaseMock({ rows: [row("u1", "c1:20"), row("u2", "c3:10"), row("u3", "e2a:40")] });

    await run();

    expect(timeout.mock.calls.filter(([, ms]) => ms === 600)).toHaveLength(2);
  });

  it("returns 500 when the facts query fails", async () => {
    const supabase = createSupabaseMock();
    supabase.range.mockResolvedValue({ data: null, error: { message: "rpc broke" } } as never);

    const { status, json } = await run();

    expect(status).toBe(500);
    expect(json).toEqual({ ok: false, error: "rpc broke" });
    expect(sendLifecycleEmail).not.toHaveBeenCalled();
  });

  it("returns 500 and touches nothing when CRON_SECRET (which signs unsubscribe links) is missing", async () => {
    // Outside production a missing CRON_SECRET leaves the cron auth open, so the request gets this far.
    vi.stubEnv("CRON_SECRET", "");
    createSupabaseMock({ rows: [row("u1", "c1:20")] });

    const { status } = await run();

    expect(status).toBe(500);
    expect(getSupabaseAdminClient).not.toHaveBeenCalled();
    expect(sendLifecycleEmail).not.toHaveBeenCalled();
  });

  it("pages through more than 1000 users and skips opted-out users in the query", async () => {
    const rows = Array.from({ length: 1001 }, (_, i) => row(`u${i}`, null));
    rows[1000] = row("u1000", "c1:20");
    const supabase = createSupabaseMock({ rows });

    const { json } = await run();

    expect(supabase.is).toHaveBeenCalledWith("email_opt_out_at", null);
    expect(supabase.range).toHaveBeenCalledWith(0, 999);
    expect(supabase.range).toHaveBeenCalledWith(1000, 1999);
    expect(json).toMatchObject({ considered: 1001, picked: 1, sent: 1 });
    expect(sendLifecycleEmail).toHaveBeenCalledWith(expect.objectContaining({ userId: "u1000" }));
  });
});

describe("transactional welcome recovery in the cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "cron-secret");
    vi.stubEnv("LIFECYCLE_EMAIL_TEST_TO", "tester@example.com");
    vi.mocked(sendLifecycleEmail).mockResolvedValue("sent");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("retries welcomes even when the marketing budget is exhausted", async () => {
    createSupabaseMock({ sentToday: 10 });
    vi.mocked(retrySubscriptionWelcomeEmails).mockResolvedValue(1);
    const response = await GET(request());
    expect(retrySubscriptionWelcomeEmails).toHaveBeenCalledWith(3);
    expect(await response.json()).toMatchObject({ budgetExhausted: true, welcomeRetries: 1 });
  });

  it("includes welcome retries in the per-run limit", async () => {
    createSupabaseMock({ rows: [row("u1", "c1:20", "tester@example.com")] });
    vi.mocked(retrySubscriptionWelcomeEmails).mockResolvedValue(3);
    const response = await GET(request());
    expect(sendLifecycleEmail).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({ picked: 0, welcomeRetries: 3 });
  });
});
