import { streamText, type ModelMessage } from "ai";

import { getPsychologyCoachModel } from "@/lib/ask/service/provider";
import { jsonApiError } from "@/lib/http/json-response";
import { logger } from "@/lib/observability/logger";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyAgentContext } from "@/lib/psychology/agent-token";
import { buildPsychologyCoachInstructions } from "@/lib/psychology/companion";
import { loadCoachContext } from "@/lib/psychology/context";

// OpenAI-compatible custom-LLM endpoint for the ElevenLabs coach agent. ElevenLabs calls this
// per turn with the running conversation as OpenAI `messages`; we discard whatever system prompt
// it sends and rebuild the real verify.trading persona from the trader's own data (identical to
// the turn-based companion), then stream the reply back as OpenAI SSE chunks. The break-nudge UI
// flag can't ride this path — the persona is built with realtime:true so the coach voices a break
// aloud instead (see buildPsychologyCoachInstructions).

export const runtime = "nodejs";

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
function cacheSystem(sessionId: string, system: string, exp: number, nowSecs: number): void {
  if (systemCache.size > 500) for (const [k, v] of systemCache) if (v.exp <= nowSecs) systemCache.delete(k);
  systemCache.set(sessionId, { system, exp });
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

    const result = streamText({ model: getPsychologyCoachModel(), maxOutputTokens: 240, system, messages });

    const encoder = new TextEncoder();
    const id = `chatcmpl-${ctx.sessionId}`;
    const created = Math.floor(Date.now() / 1000);
    const chunk = (delta: Record<string, unknown>, finish: string | null) =>
      encoder.encode(
        `data: ${JSON.stringify({ id, object: "chat.completion.chunk", created, model: "verify-coach", choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`,
      );

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const finish = () => {
          controller.enqueue(chunk({}, "stop"));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        };
        try {
          controller.enqueue(chunk({ role: "assistant" }, null));
          for await (const delta of result.textStream) {
            if (delta) controller.enqueue(chunk({ content: delta }, null));
          }
          finish();
        } catch (error) {
          logger.error("agent-llm stream failed.", { error: error instanceof Error ? error.message : "unknown" });
          finish();
        } finally {
          controller.close();
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
