export type CommunityTarget = { user_id: string };

export function normalizeCommunityMessageId(input: { communityMessageId?: string; messageId?: string }): string | undefined {
  return input.communityMessageId ?? input.messageId;
}

export function canBlockUser(callerId: string, targetUserId: string): boolean {
  return callerId !== targetUserId;
}

export function canReportCommunityTarget(
  category: "community_message" | "community_user",
  callerId: string,
  targetUserId: string | undefined,
  message: CommunityTarget | null,
): { ok: true; targetUserId: string } | { ok: false; code: "not_found" | "invalid" } {
  if (!message) return { ok: false, code: "not_found" };
  if (category === "community_user" && targetUserId !== message.user_id) return { ok: false, code: "invalid" };
  if (message.user_id === callerId) return { ok: false, code: "invalid" };
  return { ok: true, targetUserId: message.user_id };
}

export function isReportRateLimited(count: number | null | undefined): boolean {
  return (count ?? 0) >= 20;
}

export function isDuplicateReport(count: number | null | undefined): boolean {
  return (count ?? 0) > 0;
}
