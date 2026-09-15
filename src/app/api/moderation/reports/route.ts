import { NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSessionUser } from "@/lib/auth/session";
import { jsonApiError, jsonUnauthorized } from "@/lib/http/json-response";
import { canReportCommunityTarget, isDuplicateReport, isReportRateLimited, normalizeCommunityMessageId } from "@/lib/moderation/policy";

const reportSchema = z.object({
  category: z.enum(["community_message", "community_user", "ai_response"]),
  reason: z.enum(["spam", "harassment", "hate", "sexual", "violence", "scam", "self_harm", "inaccurate", "harmful_advice", "offensive", "other"]),
  note: z.string().trim().max(500).optional(),
  // `messageId` is the mobile API name; keep the persisted column/server name explicit.
  messageId: z.string().uuid().optional(),
  communityMessageId: z.string().uuid().optional(),
  targetUserId: z.string().uuid().optional(),
  source: z.enum(["community", "ask", "mind", "journal", "challenge"]).optional(),
  sourceId: z.string().uuid().optional(),
}).superRefine((input, ctx) => {
  if (input.category === "ai_response" && (!input.source || !input.sourceId)) {
    ctx.addIssue({ code: "custom", path: ["sourceId"], message: "A persisted AI response is required." });
  }
  if (input.category !== "ai_response" && !(input.communityMessageId ?? input.messageId)) {
    ctx.addIssue({ code: "custom", path: ["communityMessageId"], message: "A community message is required." });
  }
});

type CommunityMessage = { id: string; user_id: string; room_id: string };

export async function POST(request: Request) {
  const parsed = reportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonApiError(400, "moderation_report_invalid", "The report details are invalid.");

  const session = await getSessionUser();
  if (!session) return jsonUnauthorized("Sign in to submit a report.");
  const input = parsed.data;
  const communityMessageId = normalizeCommunityMessageId(input);

  if (input.category === "community_message" || input.category === "community_user") {
    const { data: message, error } = await session.supabase
      .from("community_messages")
      .select("id, user_id, room_id")
      .eq("id", communityMessageId!)
      .maybeSingle();
    if (error) return jsonApiError(503, "moderation_unavailable", "Reporting is temporarily unavailable.");
    const row = message as CommunityMessage;
    const target = canReportCommunityTarget(input.category, session.user.id, input.targetUserId, message ? row : null);
    if (!target.ok) return target.code === "not_found"
      ? jsonApiError(404, "moderation_target_not_found", "That community message is no longer available.")
      : jsonApiError(400, "moderation_target_invalid", "The reported member does not match the message.");
    input.targetUserId = target.targetUserId;
  } else {
    const valid = input.source !== "community"
      && await ownsAiTarget(session.supabase, session.user.id, input.source!, input.sourceId!);
    if (!valid) return jsonApiError(404, "moderation_target_not_found", "That generated response is no longer available.");
  }

  const { count, error: countError } = await session.supabase
    .from("moderation_reports")
    .select("id", { count: "exact", head: true })
    .eq("reporter_user_id", session.user.id)
    .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
  // A missing count is fail-closed for the write. It avoids silently disabling the spam guard
  // if the new table has not been migrated yet.
  if (countError) return jsonApiError(503, "moderation_unavailable", "Reporting is temporarily unavailable.");
  if (isReportRateLimited(count)) return jsonApiError(429, "moderation_rate_limited", "Too many reports. Try again later.");

  const duplicateQuery = session.supabase
    .from("moderation_reports")
    .select("id", { count: "exact", head: true })
    .eq("reporter_user_id", session.user.id)
    .eq("category", input.category)
    .eq("reason", input.reason)
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  const duplicate = input.category === "ai_response"
    ? duplicateQuery.eq("source", input.source!).eq("source_id", input.sourceId!)
    : duplicateQuery.eq("community_message_id", communityMessageId!);
  const { count: duplicateCount, error: duplicateError } = await duplicate;
  if (duplicateError) return jsonApiError(503, "moderation_unavailable", "Reporting is temporarily unavailable.");
  if (isDuplicateReport(duplicateCount)) return NextResponse.json({ ok: true });

  const { data: result, error } = await session.supabase.rpc("submit_moderation_report", {
    p_category: input.category,
    p_reason: input.reason,
    p_note: input.note || null,
    p_community_message_id: communityMessageId ?? null,
    p_target_user_id: input.targetUserId ?? null,
    p_source: input.source ?? null,
    p_source_id: input.sourceId ?? null,
  });
  if (error) return jsonApiError(503, "moderation_unavailable", "Reporting is temporarily unavailable.");
  if (result === "target_not_found") return jsonApiError(404, "moderation_target_not_found", "That generated response is no longer available.");
  if (result === "target_invalid") return jsonApiError(400, "moderation_target_invalid", "The reported member does not match the message.");
  if (result === "rate_limited") return jsonApiError(429, "moderation_rate_limited", "Too many reports. Try again later.");
  if (result === "duplicate") return NextResponse.json({ ok: true });
  if (result !== "submitted") return jsonApiError(503, "moderation_unavailable", "Reporting is temporarily unavailable.");
  return NextResponse.json({ ok: true }, { status: 201 });
}

async function ownsAiTarget(supabase: SupabaseClient, userId: string, source: "ask" | "mind" | "journal" | "challenge", sourceId: string) {
  if (source === "ask") {
    const { data } = await supabase.from("chat_messages").select("id, chat_sessions!inner(user_id)").eq("id", sourceId).eq("role", "assistant").eq("chat_sessions.user_id", userId).maybeSingle();
    return Boolean(data);
  }
  if (source === "mind") {
    const { data } = await supabase.from("psychology_session_messages").select("id, psychology_sessions!inner(user_id)").eq("id", sourceId).eq("role", "coach").eq("psychology_sessions.user_id", userId).maybeSingle();
    return Boolean(data);
  }
  if (source === "journal") {
    const { data } = await supabase.from("journal_insights").select("id").eq("id", sourceId).eq("user_id", userId).maybeSingle();
    return Boolean(data);
  }
  const { data } = await supabase.from("challenge_config").select("id").eq("id", sourceId).eq("user_id", userId).maybeSingle();
  return Boolean(data);
}
