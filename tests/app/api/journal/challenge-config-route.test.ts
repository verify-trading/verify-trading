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

describe("POST /api/journal/challenge-config account scoping", () => {
  beforeEach(() => vi.clearAllMocks());

  // Fuller than the file's queryBuilder above: the account resolution chains is/order/limit.
  function chain(result: { data: unknown; error: unknown }) {
    const b = {} as Record<string, ReturnType<typeof vi.fn>> & PromiseLike<unknown>;
    for (const m of ["select", "eq", "is", "order", "limit", "insert", "update"]) b[m] = vi.fn(() => b);
    b.maybeSingle = vi.fn().mockResolvedValue(result);
    b.single = vi.fn().mockResolvedValue(result);
    b.then = (ok, no) => Promise.resolve(result).then(ok, no);
    return b;
  }

  function session(overrides: Record<string, unknown> = {}) {
    const upsert = vi.fn(() => ({ select: () => ({ single: async () => ({ data: {
      id: "c1", firm_name: "FTMO", firm_url: "https://ftmo.com", account_size: 10000,
      account_type: "2step", rules: {}, trading_account_id: null,
      created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z",
    }, error: null }) }) }));
    const from = vi.fn((table: string) => {
      if (table === "challenge_config") return { ...chain({ data: null, error: null }), upsert };
      return chain({ data: { id: "33333333-3333-4333-8333-333333333333" }, error: null });
    });
    vi.mocked(getSessionUser).mockResolvedValue({ user: { id: "user-1" }, supabase: { from }, ...overrides } as never);
    return { upsert };
  }

  const body = (tradingAccountId?: unknown) => new Request("http://localhost/api/journal/challenge-config", {
    method: "POST",
    body: JSON.stringify({
      firmUrl: "https://ftmo.com", accountSize: 10000, accountType: "2step",
      ...(tradingAccountId === undefined ? {} : { tradingAccountId }),
    }),
  });

  it('resolves "manual" to a real account, never to null', async () => {
    // The trap: null would mean "count every entry", so a trader who said they track this by
    // hand would silently have their connected broker's imports counted against the challenge.
    vi.mocked(hasAiConsent).mockResolvedValue(true);
    vi.mocked(extractChallengeRules).mockResolvedValue({ firm_name: "FTMO" } as never);
    const { upsert } = session();

    await POST(body("manual"));

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ trading_account_id: "33333333-3333-4333-8333-333333333333" }),
      expect.anything(),
    );
  });

  it("leaves the stored account alone when an older build sends nothing", async () => {
    // Editing account size from an old build must not un-scope a challenge already attached.
    vi.mocked(hasAiConsent).mockResolvedValue(true);
    vi.mocked(extractChallengeRules).mockResolvedValue({ firm_name: "FTMO" } as never);
    const { upsert } = session();

    await POST(body(undefined));

    expect(upsert).toHaveBeenCalledWith(
      expect.not.objectContaining({ trading_account_id: expect.anything() }),
      expect.anything(),
    );
  });

  it("rejects an account the caller does not own", async () => {
    vi.mocked(hasAiConsent).mockResolvedValue(true);
    const from = vi.fn(() => chain({ data: null, error: null }));
    vi.mocked(getSessionUser).mockResolvedValue({ user: { id: "user-1" }, supabase: { from } } as never);

    const response = await POST(body("44444444-4444-4444-8444-444444444444"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "challenge_config_account_invalid" });
  });
});
