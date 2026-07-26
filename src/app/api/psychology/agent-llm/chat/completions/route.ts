import { streamText, type ModelMessage } from "ai";

import { getPsychologyCoachModel } from "@/lib/ask/service/provider";
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

// ElevenLabs calls this endpoint once per spoken turn, but the trader's context (assessment +
// journal + challenge) is static for the call — so build the system prompt once per session and
// cache it, keyed by sessionId and expired with the signed token. Saves 3 Supabase reads + a
// persona rebuild on every turn after the first.
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
  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${secret}`) {
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

  try {
    const nowSecs = Math.floor(Date.now() / 1000);
    let system = cachedSystem(ctx.sessionId, nowSecs);
    if (!system) {
      const coachContext = await loadCoachContext(supabase, ctx.userId, ctx.assessmentId, ctx.name);
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
    if (messages.length === 0) messages.push({ role: "user", content: "Hello." });

    const result = streamText({
      model: getPsychologyCoachModel(),
      maxOutputTokens: 240,
      system,
      messages,
      // streamText does NOT reject when the provider fails — verified against ai@6: the step
      // promise enqueues an error part and closes the stream, so `textStream` finishes
      // normally with zero deltas and the catch below never runs. Without this hook an
      // Anthropic outage is invisible in our logs and silent in the trader's ear.
      onError: ({ error }) =>
        logger.error("agent-llm model stream failed.", {
          sessionId: ctx.sessionId,
          error: error instanceof Error ? error.message : String(error),
        }),
    });

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
          for await (const delta of result.textStream) {
            if (!delta) continue;
            spoke = true;
            controller.enqueue(chunk({ content: speakable(delta) }, null));
          }
          // Zero deltas means the provider failed (see onError above). Say something — dead
          // air on a voice call is indistinguishable from the coach ignoring the trader.
          if (!spoke) controller.enqueue(chunk({ content: COACH_FALLBACK_LINE }, null));
          finish();
        } catch (error) {
          logger.error("agent-llm stream failed.", { error: error instanceof Error ? error.message : "unknown" });
          safe(finish);
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
