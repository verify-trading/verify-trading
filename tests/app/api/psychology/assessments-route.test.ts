import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: vi.fn(),
}));

vi.mock("@/lib/observability/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

import { GET, POST } from "@/app/api/psychology/assessments/route";
import { getSessionUser } from "@/lib/auth/session";

// Chainable thenable stand-in for a PostgREST query: every builder method returns the
// builder, and awaiting it (or .single()) resolves the provided result. A filter method
// added in src must be added here too, or the chain returns undefined mid-query.
function createQueryBuilder(result: { data?: unknown; error?: unknown } = { data: null, error: null }) {
  const builder = {} as Record<string, ReturnType<typeof vi.fn>> & PromiseLike<unknown>;

  for (const method of ["select", "eq", "order", "limit", "insert"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.single = vi.fn().mockResolvedValue(result);
  builder.maybeSingle = vi.fn().mockResolvedValue(result);
  builder.then = (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected);

  return builder;
}

describe("Psychology assessments API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires a session to list psychology assessments", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/psychology/assessments"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "unauthorized",
      message: "Sign in to load psychology assessments.",
    });
  });

  it("lists stored psychology assessments", async () => {
    const row = {
      id: "assessment-1",
      section_scores: {
        wrong: 6,
        fear: 9,
        compulsion: 12,
        awareness: 8,
        discipline: 7,
      },
      total_score: 42,
      max_score: 75,
      zone_label: "Reactive Trader",
      focus_area: "compulsion",
      summary: "Compulsion is the loudest signal right now.",
      answers: null,
      q29_focus: "My tendency to overtrade",
      created_at: "2026-05-26T12:00:00.000Z",
      updated_at: "2026-05-26T12:00:00.000Z",
    };
    const builder = createQueryBuilder({ data: [row], error: null });
    const from = vi.fn(() => builder);

    vi.mocked(getSessionUser).mockResolvedValue({
      user: { id: "user-1" },
      supabase: { from },
    } as never);

    const response = await GET(new Request("http://localhost/api/psychology/assessments"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(from).toHaveBeenCalledWith("psychology_assessments");
    expect(builder.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(json.assessments[0]).toEqual(expect.objectContaining({
      id: "assessment-1",
      totalScore: 42,
      zoneLabel: "Reactive Trader",
      focusArea: "compulsion",
    }));
  });

  it("rejects invalid section scores", async () => {
    const response = await POST(
      new Request("http://localhost/api/psychology/assessments", {
        method: "POST",
        body: JSON.stringify({
          sectionScores: {
            wrong: 6,
            fear: 9,
            compulsion: 20,
            awareness: 8,
            discipline: 7,
          },
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "psychology_assessment_invalid",
      message: "The psychology assessment request body is invalid.",
    });
  });

  it("scores and stores a psychology assessment for the signed-in user", async () => {
    const row = {
      id: "assessment-1",
      section_scores: {
        wrong: 6,
        fear: 9,
        compulsion: 12,
        awareness: 8,
        discipline: 7,
      },
      total_score: 42,
      max_score: 75,
      zone_label: "Reactive Trader",
      focus_area: "compulsion",
      summary: "Compulsion is the loudest signal right now.",
      answers: { q14: 2 },
      q29_focus: "My tendency to overtrade",
      created_at: "2026-05-26T12:00:00.000Z",
      updated_at: "2026-05-26T12:00:00.000Z",
    };
    const builder = createQueryBuilder({ data: row, error: null });
    // The POST is Pro-gated, and hasProAccess reads profiles.tier off the same client.
    const profiles = createQueryBuilder({ data: { tier: "pro" }, error: null });
    const from = vi.fn((table: string) => (table === "profiles" ? profiles : builder));

    vi.mocked(getSessionUser).mockResolvedValue({
      user: { id: "user-1" },
      supabase: { from },
    } as never);

    const response = await POST(
      new Request("http://localhost/api/psychology/assessments", {
        method: "POST",
        body: JSON.stringify({
          sectionScores: {
            wrong: 6,
            fear: 9,
            compulsion: 12,
            awareness: 8,
            discipline: 7,
          },
          answers: { q14: "Very frustrated" },
          q1TradingSituation: "I trade alongside a job or studies",
          q2StressLevel: "Moderate",
          q3FinancialSituation: "Some pressure but manageable",
          q4SleepQuality: "Variable",
          q5EnergyLevel: "Moderate",
          q29Focus: "My tendency to overtrade",
          flags: {
            chasing: false,
            compulsive: true,
            financialPressure: false,
            sleepPoor: false,
            rebuilding: false,
          },
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "user-1",
      total_score: 42,
      max_score: 75,
      focus_area: "compulsion",
      answers: { q14: "Very frustrated" },
      q29_focus: "My tendency to overtrade",
    }));
  });

  it("refuses to store an assessment for a free trader", async () => {
    // Mind is Pro (v1.5). The client gates it too, but the client is not the enforcement.
    const builder = createQueryBuilder({ data: null, error: null });
    const profiles = createQueryBuilder({ data: { tier: "free" }, error: null });
    const from = vi.fn((table: string) => (table === "profiles" ? profiles : builder));

    vi.mocked(getSessionUser).mockResolvedValue({
      user: { id: "user-1" },
      supabase: { from },
    } as never);

    const response = await POST(
      new Request("http://localhost/api/psychology/assessments", {
        method: "POST",
        body: JSON.stringify({
          sectionScores: { wrong: 6, fear: 9, compulsion: 12, awareness: 8, discipline: 7 },
          answers: { q14: "Very frustrated" },
          q1TradingSituation: "I trade alongside a job or studies",
          q2StressLevel: "Moderate",
          q3FinancialSituation: "Some pressure but manageable",
          q4SleepQuality: "Variable",
          q5EnergyLevel: "Moderate",
          q29Focus: "My tendency to overtrade",
          flags: { chasing: false, compulsive: true, financialPressure: false, sleepPoor: false, rebuilding: false },
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(builder.insert).not.toHaveBeenCalled();
  });
});
