import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: vi.fn(),
}));

vi.mock("@/lib/observability/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock("@/lib/journal/ai", () => ({
  generateChallengeStatus: vi.fn(),
  overheatTrigger: vi.fn(() => null),
}));

import { GET, POST } from "@/app/api/journal/entries/route";
import { getSessionUser } from "@/lib/auth/session";

function createQueryBuilder(result: unknown) {
  const builder = Promise.resolve(result) as Promise<unknown> & {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    lt: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
  };

  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.lt = vi.fn(() => builder);
  builder.insert = vi.fn(() => builder);
  builder.upsert = vi.fn(() => builder);
  builder.single = vi.fn().mockResolvedValue(result);
  builder.maybeSingle = vi.fn().mockResolvedValue(result);

  return builder;
}

describe("Journal entries API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires a session to list journal entries", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/journal/entries"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "unauthorized",
      message: "Sign in to load journal entries.",
    });
  });

  it("lists user-owned journal entries", async () => {
    const row = {
      id: "entry-1",
      entry_date: "2026-05-26",
      mood: "good",
      pnl_amount: "180.00",
      pnl_currency: "GBP",
      note: "Waited for confirmation.",
      lesson: "Patience is the edge.",
      challenge_status_note: null,
      tags: ["london"],
      created_at: "2026-05-26T12:00:00.000Z",
      updated_at: "2026-05-26T12:00:00.000Z",
    };
    const builder = createQueryBuilder({ data: [row], error: null });
    const from = vi.fn(() => builder);

    vi.mocked(getSessionUser).mockResolvedValue({
      user: { id: "user-1" },
      supabase: { from },
    } as never);

    const response = await GET(new Request("http://localhost/api/journal/entries?limit=10"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(from).toHaveBeenCalledWith("journal_entries");
    expect(builder.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(json.entries).toEqual([
      {
        id: "entry-1",
        entryDate: "2026-05-26",
        mood: "good",
        pnlAmount: 180,
        pnlCurrency: "GBP",
        note: "Waited for confirmation.",
        lesson: "Patience is the edge.",
        challengeStatusNote: null,
        tags: ["london"],
        createdAt: "2026-05-26T12:00:00.000Z",
        updatedAt: "2026-05-26T12:00:00.000Z",
      },
    ]);
  });

  it("rejects an invalid journal entry body", async () => {
    vi.mocked(getSessionUser).mockResolvedValue({
      user: { id: "user-1" },
      supabase: { from: vi.fn() },
    } as never);

    const response = await POST(
      new Request("http://localhost/api/journal/entries", {
        method: "POST",
        body: JSON.stringify({ entryDate: "2026-05-26", mood: "angry" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "journal_entry_invalid",
      message: "The journal entry request body is invalid.",
    });
  });

  it("creates a journal entry for the signed-in user", async () => {
    const row = {
      id: "entry-1",
      entry_date: "2026-05-26",
      mood: "okay",
      pnl_amount: "-25.00",
      pnl_currency: "GBP",
      note: "Choppy NY session.",
      lesson: null,
      challenge_status_note: null,
      tags: [],
      created_at: "2026-05-26T12:00:00.000Z",
      updated_at: "2026-05-26T12:00:00.000Z",
    };
    const savedBuilder = createQueryBuilder({ data: row, error: null });
    const entriesBuilder = createQueryBuilder({ data: [row], error: null });
    const configBuilder = createQueryBuilder({ data: null, error: null });
    let journalCallCount = 0;
    const from = vi.fn((table: string) => {
      if (table === "journal_entries") journalCallCount += 1;
      if (table === "journal_entries" && journalCallCount === 1) return savedBuilder;
      if (table === "journal_entries") return entriesBuilder;
      if (table === "challenge_config") return configBuilder;
      return createQueryBuilder({ data: null, error: null });
    });

    vi.mocked(getSessionUser).mockResolvedValue({
      user: { id: "user-1" },
      supabase: { from },
    } as never);

    const response = await POST(
      new Request("http://localhost/api/journal/entries", {
        method: "POST",
        body: JSON.stringify({
          entryDate: "2026-05-26",
          mood: "okay",
          pnlAmount: -25,
          note: "Choppy NY session.",
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(savedBuilder.upsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "user-1",
      entry_date: "2026-05-26",
      mood: "okay",
      pnl_amount: -25,
      pnl_currency: "GBP",
      source: "mobile",
    }), { onConflict: "user_id,entry_date" });
  });
});
