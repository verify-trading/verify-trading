import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("ai", () => ({ streamText: vi.fn() }));

vi.mock("@/lib/ask/service/provider", () => ({ getPsychologyCoachModel: vi.fn(() => "model") }));

vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdminClient: vi.fn(() => ({})) }));

vi.mock("@/lib/ai/consent", () => ({
  AI_CONSENT_KEY: "ai_consent_v2",
  hasAiConsent: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/psychology/context", () => ({ loadCoachContext: vi.fn() }));

vi.mock("@/lib/observability/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { streamText } from "ai";

import { POST as agentLlm } from "@/app/api/psychology/agent-llm/chat/completions/route";
import { hasAiConsent } from "@/lib/ai/consent";
import { signAgentContext } from "@/lib/psychology/agent-token";
import { loadCoachContext } from "@/lib/psychology/context";

const SECRET = "test-agent-secret";
const COACH_FALLBACK_LINE = "Sorry — I lost my train of thought for a second there. Say that again?";

// A fresh session id per test: the route caches the built system prompt by session id for the
// length of the call, and a shared id would let one test's cache answer the next one's request.
let sessionCounter = 0;
const nextSessionId = () => `session-${++sessionCounter}`;

function ctxToken(sessionId: string) {
  return signAgentContext(
    { userId: "user-1", assessmentId: "assessment-1", sessionId, name: "Alex", exp: Math.floor(Date.now() / 1000) + 600 },
    SECRET,
  );
}

function turnRequest(headers: Record<string, string>, sessionId: string) {
  return new Request("http://localhost/api/psychology/agent-llm/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({
      messages: [{ role: "user", content: "I chased a loss this morning." }],
      elevenlabs_extra_body: { vt_ctx: ctxToken(sessionId) },
    }),
  });
}

// The model's side of one turn, as the route consumes it: an async iterable of text deltas.
function modelStream(deltas: string[], failWith?: Error) {
  const textStream = (async function* () {
    for (const delta of deltas) yield delta;
    if (failWith) throw failWith;
  })();
  vi.mocked(streamText).mockReturnValue({ textStream } as never);
}

// Object.defineProperty-free way to iterate the SSE body the route returns.
async function readSse(response: Response): Promise<string> {
  return await response.text();
}

describe("agent-llm custom LLM endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasAiConsent).mockResolvedValue(true);
    process.env.ELEVENLABS_AGENT_LLM_SECRET = SECRET;
    vi.mocked(loadCoachContext).mockResolvedValue({
      name: "Alex",
      assessment: { total_score: 57, zone_label: "At-Risk Trader", focus_area: "compulsion" } as never,
      journal: { sessionCount: 3, weeklyPnl: 120, wins: 2, toughSessions: 1, winningStreak: 1, losingStreak: 0 },
      challenge: null,
      recentEntries: [],
    });
  });

  it("stops a new model turn after consent is withdrawn", async () => {
    vi.mocked(hasAiConsent).mockResolvedValue(false);

    const response = await agentLlm(turnRequest({ "x-vt-agent-secret": SECRET }, nextSessionId()));

    expect(response.status).toBe(403);
    expect(streamText).not.toHaveBeenCalled();
    expect(loadCoachContext).not.toHaveBeenCalled();
  });

  it("refuses a turn that carries neither accepted secret header", async () => {
    const response = await agentLlm(turnRequest({}, nextSessionId()));

    expect(response.status).toBe(401);
    expect(streamText).not.toHaveBeenCalled();
  });

  // ElevenLabs never sends a configured `Authorization` header — it is reserved on their
  // outbound header map, accepted and echoed back but silently dropped. This is the header
  // that actually arrives, so the route must keep accepting it.
  it("accepts the non-reserved x-vt-agent-secret header and streams the turn", async () => {
    modelStream(["Hey Alex,", " what happened just before you clicked?"]);

    const response = await agentLlm(turnRequest({ "x-vt-agent-secret": SECRET }, nextSessionId()));
    const body = await readSse(response);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    expect(body).toContain("Hey Alex,");
    // Deltas are passed through without trimming — trimming each one welded words together.
    expect(body).toContain(" what happened just before you clicked?");
    expect(body.trimEnd().endsWith("data: [DONE]")).toBe(true);
  });

  it("still rejects a turn whose signed context was not signed by us", async () => {
    const forged = signAgentContext(
      { userId: "user-2", assessmentId: "assessment-2", sessionId: nextSessionId(), name: "Mallory", exp: Math.floor(Date.now() / 1000) + 600 },
      "not-our-secret",
    );
    const request = new Request("http://localhost/api/psychology/agent-llm/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-vt-agent-secret": SECRET },
      body: JSON.stringify({ messages: [], elevenlabs_extra_body: { vt_ctx: forged } }),
    });

    const response = await agentLlm(request);

    expect(response.status).toBe(403);
    expect(streamText).not.toHaveBeenCalled();
  });

  // A turn whose message list ends on the companion's own line (or is empty at the start of the
  // call) means no new speech was transcribed.
  function silentTurn(trailingAssistantLines: string[]) {
    return new Request("http://localhost/api/psychology/agent-llm/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-vt-agent-secret": SECRET },
      body: JSON.stringify({
        messages: [
          { role: "user", content: "I chased a loss this morning." },
          ...trailingAssistantLines.map((content) => ({ role: "assistant", content })),
        ],
        elevenlabs_extra_body: { vt_ctx: ctxToken(nextSessionId()) },
      }),
    });
  }

  // When ElevenLabs' turn timeout fires it asks for another turn with NO new user message — the
  // list ends on the companion's own last line (or is empty at the start of the call). The model
  // then sees only itself talking and re-opens the conversation, which is what the trader hears
  // as the companion replaying its greeting as if they had never spoken.
  it("marks a turn that carries no new user speech instead of faking one", async () => {
    modelStream(["Take your time."]);

    await agentLlm(silentTurn(["So what pulled you back into that trade?"]));

    const { messages } = vi.mocked(streamText).mock.calls[0][0] as { messages: Array<{ role: string; content: string }> };
    const last = messages.at(-1);
    expect(last?.role).toBe("user");
    expect(last?.content).toContain("Nothing was transcribed this turn");
    expect(last?.content).not.toBe("Hello.");
    // The never-greet rule belongs to the persona (companion.ts midCallRule) and is already in
    // the system prompt every realtime turn — restating it here was two owners for one rule.
    expect(last?.content).not.toContain("Do NOT greet");
  });

  // The timeout fires again every turn_timeout seconds for as long as the trader stays quiet,
  // so a nudge per silent turn is a loop: the companion talks at an empty room until the
  // platform's silence_end_call_timeout hangs up. One steady line, then nothing.
  it("says one steady line on the second silence in a row and stops asking the model", async () => {
    const body = await readSse(await agentLlm(silentTurn(["So what pulled you back in?", "Take your time."])));

    expect(streamText).not.toHaveBeenCalled();
    expect(body).toContain("I'll stay on the line");
    expect(body.trimEnd().endsWith("data: [DONE]")).toBe(true);
  });

  it("goes quiet from the third silence on, without substituting the provider-failure line", async () => {
    const body = await readSse(
      await agentLlm(silentTurn(["So what pulled you back in?", "Take your time.", "I'll stay on the line — say something when you're ready."])),
    );

    expect(streamText).not.toHaveBeenCalled();
    // The fallback exists for a provider that broke on a REAL turn; spoken here it would just
    // become the loop's new refrain.
    expect(body).not.toContain(COACH_FALLBACK_LINE);
    expect(body).toContain('"finish_reason":"stop"');
    expect(body.trimEnd().endsWith("data: [DONE]")).toBe(true);
  });

  it("bounds the turn so a hung provider cannot outlive the platform's function limit", async () => {
    // Past maxDuration the function is killed mid-stream and ElevenLabs is left holding an SSE
    // that never says [DONE] — which ends the trader's call. The turn has to be cut off here.
    modelStream(["Fine."]);

    await agentLlm(turnRequest({ "x-vt-agent-secret": SECRET }, nextSessionId()));

    const options = vi.mocked(streamText).mock.calls[0][0] as { abortSignal?: AbortSignal };
    expect(options.abortSignal).toBeInstanceOf(AbortSignal);
  });

  it("says something and closes the stream cleanly when the turn dies before a word", async () => {
    // Dead air on a voice call is indistinguishable from the coach ignoring the trader, and an
    // SSE without [DONE] hangs the agent. Both are covered by finishing the stream ourselves.
    modelStream([], new Error("upstream aborted"));

    const response = await agentLlm(turnRequest({ "x-vt-agent-secret": SECRET }, nextSessionId()));
    const body = await readSse(response);

    expect(response.status).toBe(200);
    expect(body).toContain(COACH_FALLBACK_LINE);
    expect(body).toContain('"finish_reason":"stop"');
    expect(body.trimEnd().endsWith("data: [DONE]")).toBe(true);
  });

  it("cuts an over-long answer at a word boundary rather than mid-word", async () => {
    // Deltas are tokens, so the one that trips the 960-char budget routinely ends mid-word.
    // Cutting there had TTS speak a fragment.
    modelStream(["word ".repeat(191), "posi", "tion", " sizing", " matters", " a", " lot"]);

    const body = await readSse(await agentLlm(turnRequest({ "x-vt-agent-secret": SECRET }, nextSessionId())));

    const spoken = [...body.matchAll(/"content":"((?:[^"\\]|\\.)*)"/g)].map((m) => JSON.parse(`"${m[1]}"`)).join("");
    expect(spoken).toContain("position");
    expect(spoken.endsWith("posi")).toBe(false);
    // Bounded overshoot: it does not just read the whole answer out.
    expect(spoken.length).toBeLessThan(960 + 80);
  });

  it("does not repeat itself when the turn dies mid-sentence", async () => {
    modelStream(["Hey Alex, that sounds"], new Error("upstream aborted"));

    const body = await readSse(await agentLlm(turnRequest({ "x-vt-agent-secret": SECRET }, nextSessionId())));

    expect(body).toContain("Hey Alex, that sounds");
    expect(body).not.toContain(COACH_FALLBACK_LINE);
    expect(body.trimEnd().endsWith("data: [DONE]")).toBe(true);
  });
});
