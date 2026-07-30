import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: vi.fn(),
}));

vi.mock("@/lib/billing/require-pro", () => ({
  hasProAccess: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/observability/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { POST as mintToken } from "@/app/api/psychology/realtime-token/route";
import { GET as getUsage } from "@/app/api/psychology/usage/route";
import { getSessionUser } from "@/lib/auth/session";
import { DAILY_CALL_LIMIT, DAILY_MINT_LIMIT, REAL_CALL_FILTER } from "@/lib/psychology/sessions";
import { getTodayUtcDateString } from "@/lib/rate-limit/usage";

const ASSESSMENT_ID = "0b54c9de-2f7a-4d31-8f9e-6a1b2c3d4e5f";
const SESSION_ID = "3f9d2c1e-8a4b-4c6d-9e0f-1a2b3c4d5e6f";

// Chainable thenable stand-in for a PostgREST query: every builder method returns the
// builder, awaiting it (or .single()/.maybeSingle()) resolves the provided result. The
// result carries `count` too, so one builder can answer both a head-count and a row read.
function createQueryBuilder(result: { data?: unknown; count?: number | null; error?: unknown } = { data: null, error: null }) {
  const builder = {} as Record<string, ReturnType<typeof vi.fn>> & PromiseLike<unknown>;

  for (const method of ["select", "eq", "gte", "gt", "or", "order", "limit", "insert", "update"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.single = vi.fn().mockResolvedValue(result);
  builder.maybeSingle = vi.fn().mockResolvedValue(result);
  builder.then = (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected);

  return builder;
}

type Builder = ReturnType<typeof createQueryBuilder>;

// from() dispatcher: hands out per-table builders in order, reusing the last one once the
// queue runs dry (psychology_sessions is read twice by the usage route).
function createFrom(tables: Record<string, Builder[]>) {
  const counters: Record<string, number> = {};
  return vi.fn((table: string) => {
    const queue = tables[table] ?? [createQueryBuilder()];
    const index = counters[table] ?? 0;
    counters[table] = index + 1;
    return queue[Math.min(index, queue.length - 1)];
  });
}

function mockSession(from: ReturnType<typeof vi.fn>) {
  vi.mocked(getSessionUser).mockResolvedValue({
    user: { id: "user-1", email: "alex@example.com", user_metadata: { name: "Alex" } },
    supabase: { from },
  } as never);
}

const mintRequest = () =>
  new Request("http://localhost/api/psychology/realtime-token", {
    method: "POST",
    body: JSON.stringify({ assessmentId: ASSESSMENT_ID }),
  });

// One mint's worth of tables: the assessment ownership read, and the sessions table answering
// both the daily count and the row insert.
function mintTables(callsToday: number) {
  const assessments = createQueryBuilder({ data: { id: ASSESSMENT_ID }, error: null });
  const sessions = createQueryBuilder({
    data: { id: SESSION_ID, message_count: 0 },
    count: callsToday,
    error: null,
  });
  return { assessments, sessions, from: createFrom({ psychology_assessments: [assessments], psychology_sessions: [sessions] }) };
}

describe("Psychology daily call limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ELEVENLABS_API_KEY = "xi-test-key";
    process.env.ELEVENLABS_AGENT_ID = "agent-test";
    process.env.ELEVENLABS_AGENT_LLM_SECRET = "test-agent-secret";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ token: "conv-token" }) }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("mints the last call inside the allowance", async () => {
    // Four taken today means the fifth is still owed to the trader.
    const { sessions, from } = mintTables(DAILY_CALL_LIMIT - 1);
    mockSession(from);

    const response = await mintToken(mintRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.sessionId).toBe(SESSION_ID);
    expect(sessions.insert).toHaveBeenCalled();
  });

  it("refuses the call past the allowance without opening a row or calling ElevenLabs", async () => {
    const { sessions, from } = mintTables(DAILY_CALL_LIMIT);
    mockSession(from);

    const response = await mintToken(mintRequest());

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      error: "psychology_daily_limit",
      message: "You've used today's 5 coaching calls. They reset at midnight UTC.",
    });
    // The whole point of counting before the Promise.all: a refused call must cost nothing
    // and must not leave a phantom session row behind.
    expect(sessions.insert).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("counts only sessions that became real calls, from midnight UTC", async () => {
    const { sessions, from } = mintTables(0);
    mockSession(from);

    await mintToken(mintRequest());

    // A row minted but never connected matches none of these three clauses, so backing out of
    // the call screen can never burn a call. Same filter the history list uses.
    expect(sessions.or).toHaveBeenCalledWith(REAL_CALL_FILTER);
    expect(sessions.select).toHaveBeenCalledWith("id", { count: "exact", head: true });
    // The server's own day, not the device's — a trader east of UTC must not get a second
    // allowance at their local midnight.
    expect(sessions.gte).toHaveBeenCalledWith("created_at", `${getTodayUtcDateString()}T00:00:00.000Z`);
  });

  it("refuses to keep minting tokens for a client that never reports its calls", async () => {
    // The cap above can only see calls the CLIENT told us about — a session row is opened at
    // mint with no duration, no messages and no conversation id, so it matches none of
    // REAL_CALL_FILTER until a PATCH arrives. An app that simply never PATCHes therefore holds
    // callsToday at zero forever and bills unlimited voice minutes. Tokens minted is the one
    // number it cannot touch.
    const assessments = createQueryBuilder({ data: { id: ASSESSMENT_ID }, error: null });
    // Read in call order: the real-call count, then the mint count.
    const calls = createQueryBuilder({ count: 0, error: null });
    const mints = createQueryBuilder({ count: DAILY_MINT_LIMIT, error: null });
    mockSession(createFrom({ psychology_assessments: [assessments], psychology_sessions: [calls, mints] }));

    const response = await mintToken(mintRequest());

    expect(response.status).toBe(429);
    expect(mints.insert).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    // Counted unfiltered on purpose: filtering it by REAL_CALL_FILTER would put the number
    // straight back under the client's control.
    expect(mints.or).not.toHaveBeenCalled();
    expect(mints.gte).toHaveBeenCalledWith("created_at", `${getTodayUtcDateString()}T00:00:00.000Z`);
  });

  it("fails the mint when the count cannot be read, rather than granting a free call", async () => {
    const assessments = createQueryBuilder({ data: { id: ASSESSMENT_ID }, error: null });
    const sessions = createQueryBuilder({ count: null, error: { message: "pg down" } });
    mockSession(createFrom({ psychology_assessments: [assessments], psychology_sessions: [sessions] }));

    const response = await mintToken(mintRequest());

    expect(response.status).toBe(500);
    expect(sessions.insert).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("Psychology usage API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires a session", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null);

    const response = await getUsage();

    expect(response.status).toBe(401);
  });

  it("reports today's calls, the limit, and lifetime totals", async () => {
    // Read in call order: the head-count first, then the durations behind the totals.
    const count = createQueryBuilder({ count: 2, error: null });
    const totals = createQueryBuilder({
      // 5:30 + 4:30 + a call whose hang-up report was lost + a null column = 10 whole minutes.
      data: [{ duration_secs: 330 }, { duration_secs: 270 }, { duration_secs: 0 }, { duration_secs: null }],
      error: null,
    });
    mockSession(createFrom({ psychology_sessions: [count, totals] }));

    const response = await getUsage();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      callsToday: 2,
      dailyLimit: DAILY_CALL_LIMIT,
      callsTotal: 4,
      minutesTotal: 10,
    });
    // Lifetime totals are filtered the same way, so "Calls" and the history list agree.
    expect(totals.or).toHaveBeenCalledWith(REAL_CALL_FILTER);
  });

  it("500s rather than reporting a usage number it could not read", async () => {
    const count = createQueryBuilder({ count: null, error: { message: "pg down" } });
    mockSession(createFrom({ psychology_sessions: [count] }));

    const response = await getUsage();

    expect(response.status).toBe(500);
  });
});
