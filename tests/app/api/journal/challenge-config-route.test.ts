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

import { DELETE, POST } from "@/app/api/journal/challenge-config/route";
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

describe("DELETE /api/journal/challenge-config", () => {
  beforeEach(() => vi.clearAllMocks());

  // The config row IS challenge mode's on/off state, so this endpoint is the only "off" there
  // is. Before it existed the mobile switch had nothing to write to and was hardcoded to false.
  it("deletes only the caller's own config", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const del = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ delete: del }));
    vi.mocked(getSessionUser).mockResolvedValue({
      user: { id: "user-1" },
      supabase: { from },
    } as never);

    const response = await DELETE();

    expect(response.status).toBe(200);
    // Same shape as GET, so the client writes it straight into its cache.
    await expect(response.json()).resolves.toEqual({ config: null });
    expect(from).toHaveBeenCalledWith("challenge_config");
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("refuses an anonymous caller instead of deleting", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null as never);

    expect((await DELETE()).status).toBe(401);
  });

  it("reports a failed delete rather than claiming challenge mode is off", async () => {
    const eq = vi.fn().mockResolvedValue({ error: { message: "boom" } });
    vi.mocked(getSessionUser).mockResolvedValue({
      user: { id: "user-1" },
      supabase: { from: vi.fn(() => ({ delete: vi.fn(() => ({ eq })) })) },
    } as never);

    const response = await DELETE();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: "challenge_config_delete_failed" });
  });
});
