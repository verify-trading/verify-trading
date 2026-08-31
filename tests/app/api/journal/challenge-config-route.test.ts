import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: vi.fn(),
}));

vi.mock("@/lib/ai/consent", () => ({
  AI_CONSENT_KEY: "ai_consent_v2",
  hasAiConsent: vi.fn(),
}));

vi.mock("@/lib/journal/challenge", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/journal/challenge")>();
  return { ...actual, extractChallengeRules: vi.fn() };
});

import { POST } from "@/app/api/journal/challenge-config/route";
import { hasAiConsent } from "@/lib/ai/consent";
import { getSessionUser } from "@/lib/auth/session";
import { extractChallengeRules } from "@/lib/journal/challenge";

function queryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {} as Record<string, ReturnType<typeof vi.fn>>;
  for (const method of ["select", "eq"]) builder[method] = vi.fn(() => builder);
  builder.maybeSingle = vi.fn().mockResolvedValue(result);
  return builder;
}

describe("POST /api/journal/challenge-config AI consent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const prior = queryBuilder({ data: null, error: null });
    vi.mocked(getSessionUser).mockResolvedValue({
      user: { id: "user-1" },
      supabase: { from: vi.fn(() => prior) },
    } as never);
  });

  it("does not send selected challenge details to AI before consent", async () => {
    vi.mocked(hasAiConsent).mockResolvedValue(false);

    const response = await POST(new Request("http://localhost/api/journal/challenge-config", {
      method: "POST",
      body: JSON.stringify({ firmUrl: "https://example.com", accountSize: 10000, accountType: "2step" }),
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "ai_consent_required",
      message: "Allow AI data sharing before reading challenge rules.",
    });
    expect(extractChallengeRules).not.toHaveBeenCalled();
  });
});
