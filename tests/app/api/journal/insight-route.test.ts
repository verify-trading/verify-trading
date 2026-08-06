import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: vi.fn(),
}));

vi.mock("@/lib/observability/logger", () => ({
  logger: { error: vi.fn() },
}));

// generateWeeklyInsight is the only thing the route imports from here. A mock that omits
// something the module under test imports surfaces as a swallowed generic 500, so if the
// route ever reaches for another export it has to be added here.
vi.mock("@/lib/journal/ai", () => ({
  generateWeeklyInsight: vi.fn(),
}));

import { GET, POST } from "@/app/api/journal/insight/route";
import { getSessionUser } from "@/lib/auth/session";
import { generateWeeklyInsight } from "@/lib/journal/ai";

// Chainable thenable stand-in for a PostgREST query: every builder method returns the
// builder, and awaiting it (or .single()) resolves the provided result. A filter method
// added in src must be added here too, or the chain returns undefined mid-query.
function createQueryBuilder(result: { data?: unknown; error?: unknown } = { data: null, error: null }) {
  const builder = {} as Record<string, ReturnType<typeof vi.fn>> & PromiseLike<unknown>;

  for (const method of ["select", "eq", "is", "order", "limit", "insert"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.single = vi.fn().mockResolvedValue(result);
  builder.then = (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected);

  return builder;
}

type Row = { entry_date: string; source: "manual" | "mobile" | "broker"; tags?: string[] };

const row = ({ entry_date, source, tags = [] }: Row) => ({
  id: entry_date,
  entry_date,
  mood: "good",
  pnl_amount: 100,
  pnl_currency: "GBP",
  note: "Held the plan.",
  lesson: null,
  challenge_status_note: null,
  tags,
  source,
  created_at: `${entry_date}T09:00:00.000Z`,
  updated_at: `${entry_date}T09:00:00.000Z`,
});

const day = (index: number) => `2026-07-${String(index).padStart(2, "0")}`;

function mockSession(entries: Row[]) {
  const journal = createQueryBuilder({ data: entries.map(row), error: null });
  const insights = createQueryBuilder({ data: { generated_at: "2026-07-30T10:00:00.000Z" }, error: null });
  const from = vi.fn((table: string) => (table === "journal_entries" ? journal : insights));

  vi.mocked(getSessionUser).mockResolvedValue({
    user: { id: "user-1", email: "alex@example.com" },
    supabase: { from },
  } as never);

  return { journal, insights };
}

describe("Journal insight API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires a session", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null);

    expect((await GET()).status).toBe(401);
    expect((await POST()).status).toBe(401);
  });

  it("counts only the days the trader wrote toward the five-session threshold", async () => {
    mockSession([
      { entry_date: day(10), source: "broker" },
      { entry_date: day(9), source: "broker" },
      { entry_date: day(8), source: "broker" },
      { entry_date: day(7), source: "mobile" },
      { entry_date: day(6), source: "mobile" },
      { entry_date: day(5), source: "manual" },
      { entry_date: day(4), source: "mobile" },
    ]);

    const response = await POST();

    // Seven rows, but only four the trader journaled — three imported P&L days are not
    // four sessions plus three, and there is nothing in them to find a pattern in.
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      insight: "Add more sessions to unlock your AI insight.",
      generatedAt: null,
    });
    expect(generateWeeklyInsight).not.toHaveBeenCalled();
  });

  it("generates from the journaled days only once five of them exist", async () => {
    vi.mocked(generateWeeklyInsight).mockResolvedValue("You cut winners short after a loss.");
    const { insights } = mockSession([
      { entry_date: day(10), source: "broker" },
      { entry_date: day(9), source: "mobile" },
      { entry_date: day(8), source: "mobile" },
      { entry_date: day(7), source: "mobile" },
      { entry_date: day(6), source: "mobile" },
      { entry_date: day(5), source: "manual" },
    ]);

    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      insight: "You cut winners short after a loss.",
      generatedAt: "2026-07-30T10:00:00.000Z",
    });
    // The imported day funds no part of the prompt — a placeholder mood and no note would
    // read back to the trader as a feeling they never reported.
    const [entries] = vi.mocked(generateWeeklyInsight).mock.calls[0];
    expect(entries).toHaveLength(5);
    expect(entries.some((entry) => entry.source === "broker")).toBe(false);
    expect(insights.insert).toHaveBeenCalledWith({ user_id: "user-1", insight_text: "You cut winners short after a loss." });
  });

  it("does not let CSV-imported days reach the threshold or the prompt", async () => {
    mockSession([
      { entry_date: day(10), source: "mobile", tags: ["csv", "csv:1754"] },
      { entry_date: day(9), source: "mobile", tags: ["csv", "csv:1754"] },
      { entry_date: day(8), source: "mobile", tags: ["csv", "csv:1754"] },
      { entry_date: day(7), source: "mobile", tags: ["csv", "csv:1754"] },
      { entry_date: day(6), source: "mobile" },
    ]);

    // Five rows, but four are a spreadsheet the server stamped 'mobile'. Generating over them
    // reads a placeholder mood and "Imported from CSV" back to the trader as their own week.
    await expect((await POST()).json()).resolves.toEqual({
      insight: "Add more sessions to unlock your AI insight.",
      generatedAt: null,
    });
    expect(generateWeeklyInsight).not.toHaveBeenCalled();
  });

  it("leaves soft-deleted days out of the count and out of the prompt", async () => {
    const { journal } = mockSession([{ entry_date: day(9), source: "mobile" }]);

    await POST();

    expect(journal.is).toHaveBeenCalledWith("deleted_at", null);
  });

  it("reports needs_generation when nothing is cached, and serves a fresh cache as-is", async () => {
    const stored = { insight_text: "You trade smaller after a win.", generated_at: new Date().toISOString() };
    const cached = createQueryBuilder({ data: [stored], error: null });
    vi.mocked(getSessionUser).mockResolvedValue({
      user: { id: "user-1", email: "alex@example.com" },
      supabase: { from: vi.fn(() => cached) },
    } as never);

    await expect((await GET()).json()).resolves.toEqual({
      insight: stored.insight_text,
      generatedAt: stored.generated_at,
    });

    const empty = createQueryBuilder({ data: [], error: null });
    vi.mocked(getSessionUser).mockResolvedValue({
      user: { id: "user-1", email: "alex@example.com" },
      supabase: { from: vi.fn(() => empty) },
    } as never);

    // The GET never generates — it is a 7-day cache reader, and the client acts on this flag.
    await expect((await GET()).json()).resolves.toEqual({
      insight: null,
      generatedAt: null,
      status: "needs_generation",
    });
  });
});
