import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth/session";
import { jsonApiError, jsonUnauthorized } from "@/lib/http/json-response";

const idSchema = z.string().uuid();

export async function DELETE(_request: Request, context: { params: Promise<{ targetUserId: string }> }) {
  const parsed = idSchema.safeParse((await context.params).targetUserId);
  if (!parsed.success) return jsonApiError(400, "block_invalid", "The member to unblock is invalid.");
  const session = await getSessionUser();
  if (!session) return jsonUnauthorized("Sign in to unblock a member.");
  const { error } = await session.supabase.from("user_blocks").delete().eq("blocker_user_id", session.user.id).eq("blocked_user_id", parsed.data);
  if (error) return jsonApiError(503, "block_unavailable", "Unblocking is temporarily unavailable.");
  return NextResponse.json({ ok: true });
}
