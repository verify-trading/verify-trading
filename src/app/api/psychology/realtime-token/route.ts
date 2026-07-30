import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth/session";
import { hasProAccess } from "@/lib/billing/require-pro";
import { jsonApiError, jsonUnauthorized, PRIVATE_CACHE_HEADERS } from "@/lib/http/json-response";
import { logger } from "@/lib/observability/logger";
import { signAgentContext } from "@/lib/psychology/agent-token";
import { countCallsToday, DAILY_CALL_LIMIT, DAILY_LIMIT_MESSAGE, openCoachSession } from "@/lib/psychology/sessions";

// Mints a WebRTC conversation token for the ElevenLabs coach agent and opens the session row
// the transcript will land in. Auth-gated exactly like the companion route (Pro-only), because
// each connected call bills ElevenLabs + our LLM. The signed context returned here rides the
// call as customLlmExtraBody so the agent-llm endpoint can rebuild this user's persona (and
// trust whose it is — see agent-token.ts).

const requestSchema = z.object({ assessmentId: z.uuid() });

const CONTEXT_TTL_SECS = 3600; // covers the 1800s max call plus mint→connect slack

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonApiError(400, "psychology_realtime_invalid", "The realtime coach request is invalid.");
  }

  try {
    const session = await getSessionUser();
    if (!session) {
      return jsonUnauthorized("Sign in to use the psychology coach.");
    }
    if (!(await hasProAccess(session))) {
      return jsonApiError(403, "psychology_pro_required", "Voice coaching is a Pro feature.");
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    const agentId = process.env.ELEVENLABS_AGENT_ID;
    const llmSecret = process.env.ELEVENLABS_AGENT_LLM_SECRET;
    if (!apiKey || !agentId || !llmSecret) {
      logger.error("Realtime coach is not configured.", {
        hasApiKey: Boolean(apiKey),
        hasAgentId: Boolean(agentId),
        hasLlmSecret: Boolean(llmSecret),
      });
      return jsonApiError(503, "psychology_realtime_unconfigured", "The live coach is not available right now.");
    }

    // The assessment must exist AND belong to the caller before anything is spent. The FK only
    // proves the row exists, so a stale or foreign id used to mint a token, open a session and
    // connect a billed WebRTC call — which then failed on every turn (agent-llm 404s when
    // loadCoachContext finds nothing) and left the trader listening to silence.
    //
    // Today's allowance is counted alongside it — both are reads, and both have to answer
    // before the session row is opened or ElevenLabs is billed, so a refused call costs
    // nothing. A failed count throws into the catch below (500) instead of falling through.
    const [assessment, callsToday] = await Promise.all([
      session.supabase
        .from("psychology_assessments")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("id", parsed.data.assessmentId)
        .maybeSingle(),
      countCallsToday(session.supabase, session.user.id),
    ]);
    if (assessment.error) {
      throw new Error(`psychology_assessments read failed: ${assessment.error.message}`);
    }
    if (!assessment.data) {
      return jsonApiError(404, "psychology_assessment_missing", "Complete the psychology assessment first.");
    }
    // Two mints racing can both pass this and land a 6th call for the day. Left alone on
    // purpose: the overrun is one call, it self-corrects at the next mint, and row locking
    // for it would cost more than the call it saves.
    if (callsToday >= DAILY_CALL_LIMIT) {
      return jsonApiError(429, "psychology_daily_limit", DAILY_LIMIT_MESSAGE);
    }

    // Open the session row and mint the token in parallel — neither depends on the other.
    const [callSession, tokenResponse] = await Promise.all([
      openCoachSession(session.supabase, session.user.id, parsed.data.assessmentId),
      fetch(`https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`, {
        headers: { "xi-api-key": apiKey },
        signal: AbortSignal.timeout(15_000),
      }),
    ]);

    if (!tokenResponse.ok) {
      logger.error("ElevenLabs conversation token request failed.", { status: tokenResponse.status });
      return jsonApiError(502, "psychology_realtime_token_failed", "Could not start the live coach right now.");
    }

    const { token } = (await tokenResponse.json()) as { token?: unknown };
    if (typeof token !== "string" || !token) {
      logger.error("ElevenLabs conversation token response had no token.");
      return jsonApiError(502, "psychology_realtime_token_failed", "Could not start the live coach right now.");
    }
    const sessionId = callSession.id;
    // user_metadata is arbitrary client-writable JSON: coerce it (a non-string rendered as
    // "[object Object]" in the coach's opening line) and cap it, since it lands verbatim in
    // the system prompt that gets re-sent on every turn.
    const rawName = session.user.user_metadata?.name ?? session.user.email ?? "there";
    const name = String(rawName).slice(0, 80);

    const vt_ctx = signAgentContext(
      { userId: session.user.id, assessmentId: parsed.data.assessmentId, sessionId, name, exp: Math.floor(Date.now() / 1000) + CONTEXT_TTL_SECS },
      llmSecret,
    );

    return NextResponse.json(
      { conversationToken: token, sessionId, customLlmExtraBody: { vt_ctx } },
      { headers: PRIVATE_CACHE_HEADERS },
    );
  } catch (error) {
    logger.error("Realtime coach token request failed.", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return jsonApiError(500, "psychology_realtime_failed", "The live coach is unavailable right now.");
  }
}
