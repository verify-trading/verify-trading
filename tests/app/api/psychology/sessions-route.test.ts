import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: vi.fn(),
}));

vi.mock("@/lib/observability/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { GET as listSessions } from "@/app/api/psychology/sessions/route";
import { GET as getSession, PATCH as patchSession } from "@/app/api/psychology/sessions/[id]/route";
import { getSessionUser } from "@/lib/auth/session";
import { signAgentContext } from "@/lib/psychology/agent-token";

const SESSION_ID = "3f9d2c1e-8a4b-4c6d-9e0f-1a2b3c4d5e6f";

const sessionRow = {
  id: SESSION_ID,
  created_at: "2026-07-17T09:00:00.000Z",
  duration_secs: 320,
  message_count: 6,
  break_recommended: false,
  assessment_id: "assessment-1",
};

const sessionShape = {
  id: SESSION_ID,
  createdAt: "2026-07-17T09:00:00.000Z",
  durationSecs: 320,
  messageCount: 6,
  breakRecommended: false,
  assessmentId: "assessment-1",
};

// Chainable thenable stand-in for a PostgREST query: every builder method returns the
// builder, awaiting it (or .single()/.maybeSingle()) resolves the provided result.
function createQueryBuilder(result: { data?: unknown; error?: unknown } = { data: null, error: null }) {
  const builder = {} as Record<string, ReturnType<typeof vi.fn>> & PromiseLike<unknown>;

  for (const method of ["select", "eq", "gt", "or", "order", "limit", "insert", "update"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.single = vi.fn().mockResolvedValue(result);
  builder.maybeSingle = vi.fn().mockResolvedValue(result);
  builder.then = (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected);

  return builder;
}

function mockSession(from: ReturnType<typeof vi.fn>) {
  vi.mocked(getSessionUser).mockResolvedValue({
    user: { id: "user-1" },
    supabase: { from },
  } as never);
}

function paramsContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("Psychology sessions API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires a session to list coaching sessions", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null);

    const response = await listSessions();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "unauthorized",
      message: "Sign in to load coaching sessions.",
    });
  });

  it("lists sessions that have messages or a recorded duration, newest first, as camelCase rows", async () => {
    const builder = createQueryBuilder({ data: [sessionRow], error: null });
    const from = vi.fn(() => builder);
    mockSession(from);

    const response = await listSessions();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(from).toHaveBeenCalledWith("psychology_sessions");
    expect(builder.eq).toHaveBeenCalledWith("user_id", "user-1");
    // A stored conversation id is proof a call happened even when the hang-up report was lost,
    // and listing it is what lets the detail view repair its transcript.
    expect(builder.or).toHaveBeenCalledWith("message_count.gt.0,duration_secs.gt.0,elevenlabs_conversation_id.not.is.null");
    expect(builder.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(json).toEqual([sessionShape]);
  });

  it("rejects an invalid session id", async () => {
    const response = await getSession(
      new Request(`http://localhost/api/psychology/sessions/not-a-uuid`),
      paramsContext("not-a-uuid"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "psychology_session_invalid",
      message: "The coaching session id is invalid.",
    });
  });

  it("returns a session with its transcript ordered oldest first", async () => {
    const messages = [
      { role: "coach", content: "Hey Alex, how are you landing today?", created_at: "2026-07-17T09:00:01.000Z" },
      { role: "user", content: "Rough morning, I chased a loss.", created_at: "2026-07-17T09:00:20.000Z" },
    ];
    const sessionBuilder = createQueryBuilder({ data: sessionRow, error: null });
    const messagesBuilder = createQueryBuilder({ data: messages, error: null });
    const from = vi.fn((table: string) =>
      table === "psychology_sessions" ? sessionBuilder : messagesBuilder,
    );
    mockSession(from);

    const response = await getSession(
      new Request(`http://localhost/api/psychology/sessions/${SESSION_ID}`),
      paramsContext(SESSION_ID),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(from).toHaveBeenCalledWith("psychology_session_messages");
    expect(messagesBuilder.eq).toHaveBeenCalledWith("session_id", SESSION_ID);
    expect(messagesBuilder.order).toHaveBeenCalledWith("created_at", { ascending: true });
    expect(json).toEqual({
      session: sessionShape,
      messages: [
        { role: "coach", content: "Hey Alex, how are you landing today?", createdAt: "2026-07-17T09:00:01.000Z" },
        { role: "user", content: "Rough morning, I chased a loss.", createdAt: "2026-07-17T09:00:20.000Z" },
      ],
    });
  });

  it("repairs a transcript stranded at 0 messages using the stored conversation id", async () => {
    const previousKey = process.env.ELEVENLABS_API_KEY;
    const previousSecret = process.env.ELEVENLABS_AGENT_LLM_SECRET;
    process.env.ELEVENLABS_API_KEY = "xi-test-key";
    process.env.ELEVENLABS_AGENT_LLM_SECRET = "test-agent-secret";
    // The repair only stores turns it can prove belong to this caller, so the conversation has to
    // echo a real signed context — the same one realtime-token plants at mint.
    const vtCtx = signAgentContext(
      {
        userId: "user-1",
        assessmentId: "assessment-1",
        sessionId: SESSION_ID,
        name: "Alex",
        exp: Math.floor(Date.now() / 1000) - 60, // expired: a repair legitimately runs later
      },
      "test-agent-secret",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          conversation_initiation_client_data: { custom_llm_extra_body: { vt_ctx: vtCtx } },
          transcript: [
            { role: "agent", message: "Hey, how are you landing today?" },
            { role: "user", message: "Rough morning, I chased a loss." },
          ],
        }),
      }),
    );

    const repaired = [
      { role: "coach", content: "Hey, how are you landing today?", created_at: "2026-07-17T09:00:01.000Z" },
      { role: "user", content: "Rough morning, I chased a loss.", created_at: "2026-07-17T09:00:02.000Z" },
    ];
    // In call order: the initial read (stranded), storeTurns' idempotency re-check, the insert,
    // then the read-back after the repair.
    const messageResults: Array<{ data: unknown; error: unknown }> = [
      { data: [], error: null },
      { data: [], error: null },
      { data: null, error: null },
      { data: repaired, error: null },
    ];
    const sessionBuilder = createQueryBuilder({
      data: { ...sessionRow, message_count: 0, elevenlabs_conversation_id: "conv_abc" },
      error: null,
    });
    const from = vi.fn((table: string) =>
      table === "psychology_sessions"
        ? sessionBuilder
        : createQueryBuilder(messageResults.shift() ?? { data: [], error: null }),
    );
    mockSession(from);

    const response = await getSession(
      new Request(`http://localhost/api/psychology/sessions/${SESSION_ID}`),
      paramsContext(SESSION_ID),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain("/convai/conversations/conv_abc");
    // The transcript comes back, and the count is corrected so it no longer reads "0 messages".
    expect(json.messages).toHaveLength(2);
    expect(json.messages[0].content).toBe("Hey, how are you landing today?");
    expect(json.session.messageCount).toBe(2);

    vi.unstubAllGlobals();
    process.env.ELEVENLABS_API_KEY = previousKey;
    process.env.ELEVENLABS_AGENT_LLM_SECRET = previousSecret;
  });

  it("refuses to repair a transcript whose signed context names a different session", async () => {
    const previousKey = process.env.ELEVENLABS_API_KEY;
    const previousSecret = process.env.ELEVENLABS_AGENT_LLM_SECRET;
    process.env.ELEVENLABS_API_KEY = "xi-test-key";
    process.env.ELEVENLABS_AGENT_LLM_SECRET = "test-agent-secret";
    // A conversation id is client-supplied and stored unverified, so pointing one at someone
    // else's conversation must never pull their transcript in.
    const foreign = signAgentContext(
      {
        userId: "user-1",
        assessmentId: "assessment-1",
        sessionId: "11111111-2222-3333-4444-555555555555",
        name: "Alex",
        exp: Math.floor(Date.now() / 1000) + 600,
      },
      "test-agent-secret",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          conversation_initiation_client_data: { custom_llm_extra_body: { vt_ctx: foreign } },
          transcript: [{ role: "agent", message: "Someone else's private call." }],
        }),
      }),
    );

    const sessionBuilder = createQueryBuilder({
      data: { ...sessionRow, message_count: 0, elevenlabs_conversation_id: "conv_stolen" },
      error: null,
    });
    const from = vi.fn((table: string) =>
      table === "psychology_sessions" ? sessionBuilder : createQueryBuilder({ data: [], error: null }),
    );
    mockSession(from);

    const response = await getSession(
      new Request(`http://localhost/api/psychology/sessions/${SESSION_ID}`),
      paramsContext(SESSION_ID),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.messages).toEqual([]);

    vi.unstubAllGlobals();
    process.env.ELEVENLABS_API_KEY = previousKey;
    process.env.ELEVENLABS_AGENT_LLM_SECRET = previousSecret;
  });

  it("404s when the session does not belong to the caller", async () => {
    const sessionBuilder = createQueryBuilder({ data: null, error: null });
    const messagesBuilder = createQueryBuilder({ data: [], error: null });
    const from = vi.fn((table: string) =>
      table === "psychology_sessions" ? sessionBuilder : messagesBuilder,
    );
    mockSession(from);

    const response = await getSession(
      new Request(`http://localhost/api/psychology/sessions/${SESSION_ID}`),
      paramsContext(SESSION_ID),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "psychology_session_missing",
      message: "That coaching session was not found.",
    });
  });

  it("rejects an invalid duration patch", async () => {
    const response = await patchSession(
      new Request(`http://localhost/api/psychology/sessions/${SESSION_ID}`, {
        method: "PATCH",
        body: JSON.stringify({ durationSecs: -5 }),
      }),
      paramsContext(SESSION_ID),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "psychology_session_invalid",
      message: "The coaching session update is invalid.",
    });
  });

  it("sets duration_secs on the caller's session and returns the updated row", async () => {
    const builder = createQueryBuilder({ data: { ...sessionRow, duration_secs: 415 }, error: null });
    const from = vi.fn(() => builder);
    mockSession(from);

    const response = await patchSession(
      new Request(`http://localhost/api/psychology/sessions/${SESSION_ID}`, {
        method: "PATCH",
        body: JSON.stringify({ durationSecs: 415 }),
      }),
      paramsContext(SESSION_ID),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(builder.update).toHaveBeenCalledWith({ duration_secs: 415 });
    expect(builder.eq).toHaveBeenCalledWith("id", SESSION_ID);
    expect(builder.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(json).toEqual({ ...sessionShape, durationSecs: 415 });
  });
});
