import { streamText, type ModelMessage } from "ai";

import { getPsychologyCoachModel } from "@/lib/ask/service/provider";
import { AI_CONSENT_KEY, hasAiConsent } from "@/lib/ai/consent";
import { jsonApiError } from "@/lib/http/json-response";
import { logger } from "@/lib/observability/logger";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyAgentContext } from "@/lib/psychology/agent-token";
import { buildPsychologyCoachInstructions, speakable } from "@/lib/psychology/companion";
import { loadCoachContext } from "@/lib/psychology/context";

// OpenAI-compatible custom-LLM endpoint for the ElevenLabs coach agent. ElevenLabs calls this
// per turn with the running conversation as OpenAI `messages`; we discard whatever system prompt
// it sends and rebuild the real verify.trading persona from the trader's own data (identical to
// the turn-based companion), then stream the reply back as OpenAI SSE chunks. The break-nudge UI
// flag can't ride this path — the persona is built with realtime:true so the coach voices a break
// aloud instead (see buildPsychologyCoachInstructions).

export const runtime = "nodejs";
// A turn streams for as long as the model takes; the platform default would cut the SSE off
// mid-sentence.
export const maxDuration = 60;

// Spoken when the model produced nothing at all, so a provider outage sounds like a hiccup
// rather than the coach going mute.
const COACH_FALLBACK_LINE = "Sorry — I lost my train of thought for a second there. Say that again?";

// A hung provider must be cut off by US, inside maxDuration: past that the platform kills the
// function mid-stream, ElevenLabs never sees [DONE], and the trader's call ends. Aborting here
// surfaces in the catch below, which still closes cleanly and still says something.
// Measured margin: warm turns reach first token in ~2.4-8.5s, but a cold start took 20.9s — if
// the coach starts opening calls with COACH_FALLBACK_LINE, check this before blaming the model.
const TURN_BUDGET_MS = 25_000;

// The real cap on one spoken turn: the gateway ignores/rejects maxOutputTokens (see
// provider.ts), and an unbounded answer is a monologue the trader cannot interrupt.
// ~4 chars per token, matching the 240 the request asks for.
const SPOKEN_CHAR_BUDGET = 960;

// ElevenLabs asks for a fresh turn when its turn timeout fires with NO new user message, so the
// list arrives empty or ending on the companion's own line. Left alone the model sees only
// itself talking and re-opens the conversation — what the trader hears as the greeting replaying.
// The agent's turn_timeout is raised alongside this (scripts/tune-coach-agent.mjs).
const SILENT_TURN_DIRECTIVE =
  "[Nothing was transcribed this turn — the line just went quiet. Your standing rules still " +
  "apply. Reply with one short, warm nudge to take their time — under fifteen words — and " +
  "nothing else.]";

// Said ONCE on the second silence in a row, then nothing. The turn timeout fires every
// turn_timeout seconds for as long as the trader stays quiet, so a nudge per silent turn is a
// loop: the companion talks at an empty room until the platform's silence_end_call_timeout
// finally hangs up. One steady line tells them the line is still open; after that, silence is
// the correct answer to silence.
const STILL_HERE_LINE = "I'll stay on the line — say something when you're ready.";

type ChatMessage = { role: string; content: unknown };

// customLlmExtraBody is echoed by ElevenLabs under `elevenlabs_extra_body`; read it defensively
// since the exact merge location isn't tightly documented.
function readVtCtx(body: Record<string, unknown>): string | null {
  const extra = (body.elevenlabs_extra_body ?? body.extra_body ?? body) as Record<string, unknown>;
  const ctx = extra?.vt_ctx ?? (body as Record<string, unknown>).vt_ctx;
  return typeof ctx === "string" ? ctx : null;
}

// OpenAI content can be a string or an array of parts; the voice agent sends strings, but fold
// array parts to text so an unusual turn doesn't come through empty.
function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => (typeof part === "string" ? part : typeof part?.text === "string" ? part.text : "")).join(" ").trim();
  }
  return "";
}

// Called once per spoken turn, but the trader's context is static for the call: build the
// system prompt once per session, keyed by sessionId and expired with the signed token.
// Saves 3 Supabase reads + a persona rebuild on every turn after the first.
// ponytail: context is frozen for the call — a trade logged mid-call won't reflect until the
// next call. Fine for a short voice session; drop the cache if live mid-call updates ever matter.
const systemCache = new Map<string, { system: string; exp: number }>();
function cachedSystem(sessionId: string, nowSecs: number): string | undefined {
  const hit = systemCache.get(sessionId);
  return hit && hit.exp > nowSecs ? hit.system : undefined;
}
const MAX_CALL_SECS = 1800; // the agent's own max_duration_seconds
const CACHE_LIMIT = 500;

function cacheSystem(sessionId: string, system: string, exp: number, nowSecs: number): void {
  for (const [k, v] of systemCache) if (v.exp <= nowSecs) systemCache.delete(k);
  // Sweeping only expired entries frees nothing when every entry is live, so cap by age too:
  // Map iterates in insertion order, making the first key the oldest.
  while (systemCache.size >= CACHE_LIMIT) {
    const oldest = systemCache.keys().next().value;
    if (oldest === undefined) break;
    systemCache.delete(oldest);
  }
  // Never trust the token's exp as the cache lifetime — an entry can't outlive the longest
  // possible call, whatever the token claims.
  systemCache.set(sessionId, { system, exp: Math.min(exp, nowSecs + MAX_CALL_SECS) });
}

export async function POST(request: Request) {
  const secret = process.env.ELEVENLABS_AGENT_LLM_SECRET;
  if (!secret) {
    logger.error("agent-llm called but ELEVENLABS_AGENT_LLM_SECRET is unset.");
    return jsonApiError(503, "agent_llm_unconfigured", "The live coach is not available right now.");
  }

  // Bearer secret proves the request is from ElevenLabs (configured in the agent's request headers).
  // `Authorization` is a reserved header on some platforms' outbound request-header maps — set in
  // the agent config, echoed back by their API, silently not sent. Accept the same secret under a
  // non-reserved name too, so the coach authenticates either way.
  const authorization = request.headers.get("authorization");
  const agentSecretHeader = request.headers.get("x-vt-agent-secret");
  if (authorization !== `Bearer ${secret}` && agentSecretHeader !== secret) {
    return jsonApiError(401, "agent_llm_unauthorized", "Unauthorized.");
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonApiError(400, "agent_llm_invalid", "Invalid request body.");
  }

  // The signed context binds this turn to a specific user + session; the raw body cannot be trusted.
  const token = readVtCtx(body);
  const ctx = token ? verifyAgentContext(token, secret) : null;
  if (!ctx) {
    return jsonApiError(403, "agent_llm_context_invalid", "Missing or invalid session context.");
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    logger.error("agent-llm has no Supabase admin client (service role key unset).");
    return jsonApiError(503, "agent_llm_unconfigured", "The live coach is not available right now.");
  }
  // Re-check on every turn. This stops new transcript/context from reaching Anthropic if the
  // user withdraws consent from another device during an active ElevenLabs session.
  if (!(await hasAiConsent(supabase, ctx.userId, AI_CONSENT_KEY))) {
    return jsonApiError(403, "ai_consent_required", "AI data sharing is turned off.");
  }

  try {
    const nowSecs = Math.floor(Date.now() / 1000);
    let system = cachedSystem(ctx.sessionId, nowSecs);
    if (!system) {
      const coachContext = await loadCoachContext(supabase, ctx.userId, ctx.assessmentId, ctx.name, ctx.sessionId);
      if (!coachContext) {
        return jsonApiError(404, "agent_llm_assessment_missing", "Assessment not found.");
      }
      system = buildPsychologyCoachInstructions({ ...coachContext, realtime: true });
      cacheSystem(ctx.sessionId, system, ctx.exp, nowSecs);
    }

    // Keep only the spoken turns; our own system prompt replaces ElevenLabs' minimal one.
    const incoming = Array.isArray(body.messages) ? (body.messages as ChatMessage[]) : [];
    const messages: ModelMessage[] = incoming
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: messageText(m.content) }))
      .filter((m) => m.content.length > 0);
    // How many turns in a row have brought no new speech. Each silent turn appends only our own
    // reply, so the run of assistant messages at the tail IS that count; an empty list is the
    // same situation at the very start of the call. Covers both shapes of a no-new-input turn.
    let silentTurns = messages.length === 0 ? 1 : 0;
    while (messages.at(-1 - silentTurns)?.role === "assistant") silentTurns += 1;
    if (silentTurns === 1) messages.push({ role: "user", content: SILENT_TURN_DIRECTIVE });

    // From the second silence on, answer without the model at all: one steady line, then
    // nothing. `null` means "ask the model" — an empty string is a deliberate silent turn and
    // must NOT fall through to COACH_FALLBACK_LINE, which exists for a provider that broke on a
    // real turn and would otherwise become the loop's new refrain.
    const held = silentTurns < 2 ? null : silentTurns === 2 ? STILL_HERE_LINE : "";

    const textStream =
      held === null
        ? streamText({
            model: getPsychologyCoachModel(),
            maxOutputTokens: 240,
            system,
            messages,
            abortSignal: AbortSignal.timeout(TURN_BUDGET_MS),
            // streamText does NOT reject when the provider fails — verified against ai@6: the step
            // promise enqueues an error part and closes the stream, so `textStream` finishes
            // normally with zero deltas and the catch below never runs. Without this hook an
            // Anthropic outage is invisible in our logs and silent in the trader's ear.
            onError: ({ error }) =>
              logger.error("agent-llm model stream failed.", {
                sessionId: ctx.sessionId,
                error: error instanceof Error ? error.message : String(error),
              }),
          }).textStream
        : held
          ? [held]
          : [];

    const encoder = new TextEncoder();
    const id = `chatcmpl-${ctx.sessionId}`;
    const created = Math.floor(Date.now() / 1000);
    const chunk = (delta: Record<string, unknown>, finish: string | null) =>
      encoder.encode(
        `data: ${JSON.stringify({ id, object: "chat.completion.chunk", created, model: "verify-coach", choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`,
      );

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        // Once the caller hangs up mid-turn the controller is closed and every further
        // enqueue/close throws; without this the teardown throws over the original error.
        const safe = (run: () => void) => {
          try {
            run();
          } catch {
            /* controller already closed — the agent went away mid-stream */
          }
        };
        const finish = () => {
          controller.enqueue(chunk({}, "stop"));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        };
        let spoke = false;
        try {
          controller.enqueue(chunk({ role: "assistant" }, null));
          let spokenChars = 0;
          for await (const delta of textStream) {
            if (!delta) continue;
            // Cut on a word boundary: deltas are tokens (" the", "posi", "tion"), so stopping
            // the instant the budget tripped left TTS speaking a fragment ("...position siz").
            // The overshoot cap stops an answer with no whitespace running on forever.
            // Leaving the loop does not stop the provider generating (ai@6 exposes no abort
            // handle here) — TURN_BUDGET_MS is that ceiling; this bounds what the trader hears.
            if (spokenChars >= SPOKEN_CHAR_BUDGET && (/^\s/.test(delta) || spokenChars - SPOKEN_CHAR_BUDGET >= 80)) break;
            spoke = true;
            controller.enqueue(chunk({ content: speakable(delta) }, null));
            spokenChars += delta.length;
          }
          // Zero deltas means the provider failed (see onError above). Say something — dead
          // air on a voice call is indistinguishable from the companion ignoring the trader.
          // Never on the held-silence path: there the silence is the answer (see STILL_HERE_LINE).
          if (!spoke && held === null) controller.enqueue(chunk({ content: COACH_FALLBACK_LINE }, null));
          finish();
        } catch (error) {
          logger.error("agent-llm stream failed.", { error: error instanceof Error ? error.message : "unknown" });
          // Same reason as the zero-delta case: a turn that dies before a single word is
          // dead air, and dead air is indistinguishable from the companion ignoring the trader.
          // Mid-sentence there is nothing useful left to say, so just close cleanly.
          safe(() => {
            if (!spoke && held === null) controller.enqueue(chunk({ content: COACH_FALLBACK_LINE }, null));
            finish();
          });
        } finally {
          safe(() => controller.close());
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    logger.error("agent-llm request failed.", { error: error instanceof Error ? error.message : "unknown" });
    return jsonApiError(500, "agent_llm_failed", "The live coach is unavailable right now.");
  }
}
