import { describe, expect, it } from "vitest";

import {
  canBlockUser,
  canReportCommunityTarget,
  isDuplicateReport,
  isReportRateLimited,
  normalizeCommunityMessageId,
} from "@/lib/moderation/policy";

describe("moderation policy", () => {
  it("normalizes the mobile message id without allowing an empty target", () => {
    expect(normalizeCommunityMessageId({ messageId: "m1" })).toBe("m1");
    expect(normalizeCommunityMessageId({ communityMessageId: "m2", messageId: "m1" })).toBe("m2");
    expect(normalizeCommunityMessageId({})).toBeUndefined();
  });

  it("does not allow self blocks or self reports", () => {
    expect(canBlockUser("u1", "u1")).toBe(false);
    expect(canReportCommunityTarget("community_message", "u1", "u1", { user_id: "u1" })).toEqual({ ok: false, code: "invalid" });
  });

  it("does not let a caller change the reported user away from the server message owner", () => {
    expect(canReportCommunityTarget("community_user", "u1", "u3", { user_id: "u2" })).toEqual({ ok: false, code: "invalid" });
    expect(canReportCommunityTarget("community_user", "u1", "u2", { user_id: "u2" })).toEqual({ ok: true, targetUserId: "u2" });
    expect(canReportCommunityTarget("community_message", "u1", undefined, null)).toEqual({ ok: false, code: "not_found" });
  });

  it("enforces report rate and duplicate guards", () => {
    expect(isReportRateLimited(19)).toBe(false);
    expect(isReportRateLimited(20)).toBe(true);
    expect(isDuplicateReport(0)).toBe(false);
    expect(isDuplicateReport(1)).toBe(true);
  });
});
