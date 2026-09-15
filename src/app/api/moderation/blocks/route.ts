import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth/session";
import { jsonApiError, jsonUnauthorized } from "@/lib/http/json-response";
import { canBlockUser } from "@/lib/moderation/policy";

const blockSchema = z.object({ targetUserId: z.string().uuid() });

export async function GET() {
  const session = await getSessionUser();
  if (!session) return jsonUnauthorized("Sign in to load blocked members.");
  const { data, error } = await session.supabase.from("user_blocks").select("blocked_user_id").eq("blocker_user_id", session.user.id);
  if (error) return jsonApiError(503, "blocks_unavailable", "Blocked members are temporarily unavailable.");
  return NextResponse.json({ blockedUserIds: (data ?? []).map((row) => row.blocked_user_id) });
}

export async function POST(request: Request) {
  const parsed = blockSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonApiError(400, "block_invalid", "The member to block is invalid.");
  const session = await getSessionUser();
  if (!session) return jsonUnauthorized("Sign in to block a member.");
  if (!canBlockUser(session.user.id, parsed.data.targetUserId)) return jsonApiError(400, "block_invalid", "You cannot block yourself.");
  const { error } = await session.supabase.from("user_blocks").upsert({ blocker_user_id: session.user.id, blocked_user_id: parsed.data.targetUserId }, { onConflict: "blocker_user_id,blocked_user_id" });
  if (error) return jsonApiError(503, "block_unavailable", "Blocking is temporarily unavailable.");
  return NextResponse.json({ ok: true }, { status: 201 });
}
