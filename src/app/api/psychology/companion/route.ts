import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth/session";
import { hasProAccess } from "@/lib/billing/require-pro";
import { jsonApiError, jsonUnauthorized, PRIVATE_CACHE_HEADERS } from "@/lib/http/json-response";
import { logger } from "@/lib/observability/logger";
import { coachDisplayName, generatePsychologyReply, shouldRecommendBreak } from "@/lib/psychology/companion";
import { loadCoachContext } from "@/lib/psychology/context";
import { insertSessionMessages, openCoachSession } from "@/lib/psychology/sessions";

const companionRequestSchema = z.object({
  assessmentId: z.uuid(),
  transcript: z.string().trim().min(1).max(2_000),
  sessionId: z.uuid().optional(),
});

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonApiError(400, "psychology_companion_invalid", "The psychology companion request body is invalid.");
  }

  const parsedBody = companionRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonApiError(400, "psychology_companion_invalid", "The psychology companion request body is invalid.");
  }

  const input = parsedBody.data;

  try {
    const session = await getSessionUser();
    if (!session) {
      return jsonUnauthorized("Sign in to use the psychology coach.");
    }
    // Pro-only: each turn is a billed model call, so entitlement is enforced server-side.
    if (!(await hasProAccess(session))) {
      return jsonApiError(403, "psychology_pro_required", "Voice coaching is a Pro feature.");
    }

    // The call-session read (only when the client passed sessionId) doubles as the ownership
    // check.
    const name = coachDisplayName(session.user);
    const [coachContext, callSessionQuery] = await Promise.all([
      loadCoachContext(session.supabase, session.user.id, input.assessmentId, name, input.sessionId),
      input.sessionId
        ? session.supabase
            .from("psychology_sessions")
            .select("id, message_count")
            .eq("user_id", session.user.id)
            .eq("id", input.sessionId)
            .maybeSingle()
        : Promise.resolve(null),
    ]);

    if (!coachContext) {
      return jsonApiError(404, "psychology_assessment_missing", "Complete the psychology assessment first.");
    }

    const transcript = input.transcript;

    // Reuse the session the client threaded (turns 2+), else open a fresh row (first turn), so
    // message_count always equals the messages actually written — 2 per turn.
    let callSession: { id: string; message_count: number } | null = null;
    if (input.sessionId) {
      if (callSessionQuery?.error) {
        throw new Error(`psychology_sessions read failed: ${callSessionQuery.error.message}`);
      }
      const existing = (callSessionQuery?.data ?? null) as { id: string; message_count: number } | null;
      if (!existing) {
        return jsonApiError(404, "psychology_session_missing", "That coaching session was not found.");
      }
      callSession = existing;
    }

    // Generation doesn't need the session id, so it starts first and the session insert plus
    // user-message write overlap the model call.
    const replyPromise = generatePsychologyReply({ ...coachContext, transcript });
    if (!callSession) {
      callSession = await openCoachSession(session.supabase, session.user.id, input.assessmentId);
    }
    const [reply] = await Promise.all([
      replyPromise,
      insertSessionMessages(session.supabase, [{
        session_id: callSession.id,
        user_id: session.user.id,
        role: "user",
        content: transcript,
      }]),
    ]);
    const breakRecommended = shouldRecommendBreak(coachContext.journal);

    // Both writes must land before responding. Turns are sequential on a live call, so the
    // read-then-write increment is race-free.
    const [, sessionUpdate] = await Promise.all([
      insertSessionMessages(session.supabase, [{
        session_id: callSession.id,
        user_id: session.user.id,
        role: "coach",
        content: reply,
      }]),
      session.supabase
        .from("psychology_sessions")
        .update({
          message_count: callSession.message_count + 2,
          break_recommended: breakRecommended,
        })
        .eq("id", callSession.id)
        .eq("user_id", session.user.id),
    ]);

    if (sessionUpdate.error) {
      throw new Error(`psychology_sessions update failed: ${sessionUpdate.error.message}`);
    }

    return NextResponse.json(
      { sessionId: callSession.id, reply, breakRecommended },
      { headers: PRIVATE_CACHE_HEADERS },
    );
  } catch (error) {
    logger.error("Psychology companion request failed.", {
      error: error instanceof Error ? error.message : "unknown",
    });

    return jsonApiError(500, "psychology_companion_failed", "The psychology coach is unavailable right now.");
  }
}
