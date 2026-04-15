import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: vi.fn(),
}));

vi.mock("@/lib/markets/fmp-economic-calendar", () => ({
  getEconomicCalendarSnapshot: vi.fn(),
}));

import { GET } from "@/app/api/markets/calendar/route";
import { getEconomicCalendarSnapshot } from "@/lib/markets/fmp-economic-calendar";
import { getSessionUser } from "@/lib/auth/session";

describe("GET /api/markets/calendar", () => {
  it("returns 401 when there is no session", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null);

    const response = await GET();
    expect(response.status).toBe(401);
    expect(getEconomicCalendarSnapshot).not.toHaveBeenCalled();
  });

  it("returns calendar snapshot for pro users", async () => {
    vi.mocked(getSessionUser).mockResolvedValue({
      user: { id: "user-pro" } as never,
      supabase: {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { tier: "pro" },
                error: null,
              }),
            }),
          }),
        }),
      } as never,
    });
    vi.mocked(getEconomicCalendarSnapshot).mockResolvedValue({
      updatedAt: "2026-04-15T10:00:00.000Z",
      dayLabel: "Today — April 15, 2026",
      items: [
        {
          id: "e1",
          timeUtc: "2026-04-15T12:00:00.000Z",
          timeLabel: "12:00 UTC",
          currency: "USD",
          event: "CPI",
          impact: "high",
          forecast: "0.1%",
          previous: "0.2%",
        },
      ],
    });

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.items).toHaveLength(1);
    expect(json.dayLabel).toContain("Today");
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
  });
});
