import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: vi.fn(),
}));

vi.mock("@/lib/ai/consent", () => ({
  AI_CONSENT_KEY: "ai_consent_v2",
  hasAiConsent: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/observability/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Keep the pure helpers (ruleToAmount, shouldRecommendBreak) real; only the model
// calls are stubbed.
vi.mock("@/lib/psychology/companion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/psychology/companion")>();
  return {
    ...actual,
    generatePsychologyReply: vi.fn(),
  };
});

import { POST } from "@/app/api/psychology/companion/route";
import { hasAiConsent } from "@/lib/ai/consent";
import { getSessionUser } from "@/lib/auth/session";
import { generatePsychologyReply } from "@/lib/psychology/companion";

const ASSESSMENT_ID = "0b54c9de-2f7a-4d31-8f9e-6a1b2c3d4e5f";
const SESSION_ID = "3f9d2c1e-8a4b-4c6d-9e0f-1a2b3c4d5e6f";

const assessmentRow = {
  total_score: 42,
  zone_label: "Reactive Trader",
  focus_area: "compulsion",
  q29_focus: "stop revenge trading",
};

// Chainable thenable stand-in for a PostgREST query: every builder method returns the
// builder, awaiting it (or .single()/.maybeSingle()) resolves the provided result.
function createQueryBuilder(result: { data?: unknown; count?: number; error?: unknown } = { data: null, error: null }) {
  const builder = {} as Record<string, ReturnType<typeof vi.fn>> & PromiseLike<unknown>;

  for (const method of ["select", "eq", "neq", "is", "gt", "order", "limit", "insert", "update"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.single = vi.fn().mockResolvedValue(result);
  builder.maybeSingle = vi.fn().mockResolvedValue(result);
  builder.then = (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected);

  return builder;
}

type Builder = ReturnType<typeof createQueryBuilder>;

// Building the persona now reads psychology_sessions FIRST, for the tail of the trader's last
// call — so this is the first builder out of that table's queue on every turn, before the
// route's own session select/insert. A trader with no earlier calls: no rows, count 0.
const noPriorCalls = () => createQueryBuilder({ data: [], count: 0, error: null });

// from() dispatcher: hands out per-table builders in order, reusing the last one once
// the queue runs dry (psychology_sessions is hit twice on a session-aware turn).
function createFrom(tables: Record<string, Builder[]>) {
  const counters: Record<string, number> = {};
  return vi.fn((table: string) => {
    const queue = tables[table] ?? [createQueryBuilder()];
    const index = Math.min(counters[table] ?? 0, queue.length - 1);
    counters[table] = index + 1;
    return queue[index];
  });
}

function mockSession(from: ReturnType<typeof vi.fn>) {
  vi.mocked(getSessionUser).mockResolvedValue({
    user: { id: "user-1", email: "alex@example.com", user_metadata: { name: "Alex" } },
    supabase: { from },
  } as never);
}

function baseTables(): Record<string, Builder[]> {
  return {
    // Voice coaching is Pro-only, so every happy-path turn needs an entitled profile.
    profiles: [createQueryBuilder({ data: { tier: "pro" }, error: null })],
    psychology_assessments: [createQueryBuilder({ data: assessmentRow, error: null })],
    journal_entries: [createQueryBuilder({ data: [], error: null })],
    challenge_config: [createQueryBuilder({ data: null, error: null })],
    psychology_sessions: [noPriorCalls()],
  };
}

function companionRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/psychology/companion", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("Psychology companion API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasAiConsent).mockResolvedValue(true);
  });

  it("does not send a turn to the model before consent", async () => {
    mockSession(createFrom(baseTables()));
    vi.mocked(hasAiConsent).mockResolvedValue(false);

    const response = await POST(companionRequest({ assessmentId: ASSESSMENT_ID, transcript: "I chased a loss." }));

    expect(response.status).toBe(403);
    expect(generatePsychologyReply).not.toHaveBeenCalled();
  });

  it("rejects a request without a transcript", async () => {
    const response = await POST(companionRequest({ assessmentId: ASSESSMENT_ID }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "psychology_companion_invalid",
      message: "The psychology companion request body is invalid.",
    });
  });

  it("stores both sides of a session-aware turn and bumps message_count by 2", async () => {
    vi.mocked(generatePsychologyReply).mockResolvedValue("One loss doesn't need winning back. What's your plan for the next hour?");
    const sessionSelect = createQueryBuilder({ data: { id: SESSION_ID, message_count: 2 }, error: null });
    const sessionUpdate = createQueryBuilder({ error: null });
    const messageInsert = createQueryBuilder({ error: null });
    const from = createFrom({
      ...baseTables(),
      psychology_sessions: [noPriorCalls(), sessionSelect, sessionUpdate],
      psychology_session_messages: [messageInsert],
    });
    mockSession(from);

    const response = await POST(
      companionRequest({ assessmentId: ASSESSMENT_ID, sessionId: SESSION_ID, transcript: "I want to double my size." }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      sessionId: SESSION_ID,
      reply: "One loss doesn't need winning back. What's your plan for the next hour?",
      breakRecommended: false,
    });
    expect(messageInsert.insert).toHaveBeenNthCalledWith(
      1,
      [expect.objectContaining({ session_id: SESSION_ID, role: "user", content: "I want to double my size." })],
    );
    expect(messageInsert.insert).toHaveBeenNthCalledWith(
      2,
      [expect.objectContaining({ session_id: SESSION_ID, role: "coach" })],
    );
    expect(sessionUpdate.update).toHaveBeenCalledWith({ message_count: 4, break_recommended: false });
  });

  it("403s a free user before spending a model call", async () => {
    const from = createFrom({
      ...baseTables(),
      profiles: [createQueryBuilder({ data: { tier: "free" }, error: null })],
    });
    mockSession(from);

    const response = await POST(
      companionRequest({ assessmentId: ASSESSMENT_ID, transcript: "I want to talk." }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "psychology_pro_required",
      message: "Voice coaching is a Pro feature.",
    });
    // The gate must short-circuit before the billed call.
    expect(generatePsychologyReply).not.toHaveBeenCalled();
  });

  it("404s a turn against a session the caller does not own", async () => {
    const from = createFrom({
      ...baseTables(),
      psychology_sessions: [noPriorCalls(), createQueryBuilder({ data: null, error: null })],
    });
    mockSession(from);

    const response = await POST(
      companionRequest({ assessmentId: ASSESSMENT_ID, sessionId: SESSION_ID, transcript: "Hello?" }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "psychology_session_missing",
      message: "That coaching session was not found.",
    });
  });

  it("opens the session on the first turn (no sessionId) and stores both sides", async () => {
    vi.mocked(generatePsychologyReply).mockResolvedValue("Take a breath first.");
    // Insert returns the new row; a second builder handles the count update.
    const sessionInsert = createQueryBuilder({ data: { id: SESSION_ID, message_count: 0 }, error: null });
    const sessionUpdate = createQueryBuilder({ error: null });
    const messageInsert = createQueryBuilder({ error: null });
    const from = createFrom({
      ...baseTables(),
      psychology_sessions: [noPriorCalls(), sessionInsert, sessionUpdate],
      psychology_session_messages: [messageInsert],
    });
    mockSession(from);

    const response = await POST(
      companionRequest({ assessmentId: ASSESSMENT_ID, transcript: "Rough session today." }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      sessionId: SESSION_ID,
      reply: "Take a breath first.",
      breakRecommended: false,
    });
    // Session opened at 0; both messages stored; count bumped to 2 — matching what's
    // actually inside, never the old off-by-one contentless-row count.
    expect(sessionInsert.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-1", assessment_id: ASSESSMENT_ID, message_count: 0 }),
    );
    expect(messageInsert.insert).toHaveBeenNthCalledWith(
      1,
      [expect.objectContaining({ session_id: SESSION_ID, role: "user", content: "Rough session today." })],
    );
    expect(messageInsert.insert).toHaveBeenNthCalledWith(
      2,
      [expect.objectContaining({ session_id: SESSION_ID, role: "coach" })],
    );
    expect(sessionUpdate.update).toHaveBeenCalledWith({ message_count: 2, break_recommended: false });
  });
});
