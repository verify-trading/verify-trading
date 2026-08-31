import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth/session";
import { AI_CONSENT_KEY, hasAiConsent } from "@/lib/ai/consent";
import { hasProAccess } from "@/lib/billing/require-pro";
import { jsonApiError, jsonUnauthorized, PRIVATE_CACHE_HEADERS } from "@/lib/http/json-response";
import { logger } from "@/lib/observability/logger";
import { signAgentContext } from "@/lib/psychology/agent-token";
import { coachDisplayName } from "@/lib/psychology/companion";
import {
  countCallsToday,
  countMintsToday,
  DAILY_CALL_LIMIT,
  DAILY_LIMIT_MESSAGE,
  MINT_LIMIT_MESSAGE,
  DAILY_MINT_LIMIT,
  openCoachSession,
} from "@/lib/psychology/sessions";

// Mints a WebRTC conversation token and opens the session row the transcript lands in.
// Pro-only: each connected call bills ElevenLabs + our LLM. The signed context returned here
// rides the call as customLlmExtraBody so agent-llm can trust whose persona to build.

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
    if (!(await hasAiConsent(session.supabase, session.user.id, AI_CONSENT_KEY))) {
      return jsonApiError(403, "ai_consent_required", "Allow AI data sharing before starting a Companion call.");
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

    // The assessment must exist AND belong to the caller before anything is spent — the FK only
    // proves the row exists, so a foreign id used to mint a token and connect a billed call
    // that then failed on every turn. Today's allowance is read alongside it, both before the
    // session row is opened or ElevenLabs is billed. A failed count throws (500), never falls
    // through.
    const [assessment, callsToday, mintsToday] = await Promise.all([
      session.supabase
        .from("psychology_assessments")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("id", parsed.data.assessmentId)
        .maybeSingle(),
      countCallsToday(session.supabase, session.user.id),
      countMintsToday(session.supabase, session.user.id),
    ]);
    if (assessment.error) {
      throw new Error(`psychology_assessments read failed: ${assessment.error.message}`);
    }
    if (!assessment.data) {
      return jsonApiError(404, "psychology_assessment_missing", "Complete the psychology assessment first.");
    }
    // The daily cap is enforced HERE, at mint, before anything is billed; the counts throw
    // rather than default, so it fails closed. mintsToday is the backstop: callsToday only
    // rises once the CLIENT reports a call, so a modified app can hold it at zero forever.
    // Different messages on purpose — whoever trips the backstop has a meter reading under the
    // limit, which "you've used your five" would contradict.
    // Two mints racing can both pass and land a 6th call; left alone, it self-corrects.
    if (callsToday >= DAILY_CALL_LIMIT) {
      return jsonApiError(429, "psychology_daily_limit", DAILY_LIMIT_MESSAGE);
    }
    if (mintsToday >= DAILY_MINT_LIMIT) {
      return jsonApiError(429, "psychology_daily_limit", MINT_LIMIT_MESSAGE);
    }

    const [callSession, tokenResponse] = await Promise.all([
      openCoachSession(session.supabase, session.user.id, parsed.data.assessmentId),
      fetch(`https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`, {
        headers: { "xi-api-key": apiKey },
        // Must stay under the platform function ceiling (15 s; this route sets no maxDuration),
        // or the function is killed first and the trader gets a platform 504 instead of our 502.
        signal: AbortSignal.timeout(10_000),
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
    // client-written user_metadata landing verbatim in the system prompt; see coachDisplayName.
    const name = coachDisplayName(session.user);

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
