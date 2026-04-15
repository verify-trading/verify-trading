import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/markets/fmp-json", () => ({
  fetchFmpJson: vi.fn(),
}));

import { getEconomicCalendarSnapshot } from "@/lib/markets/fmp-economic-calendar";
import { fetchFmpJson } from "@/lib/markets/fmp-json";

describe("getEconomicCalendarSnapshot", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T06:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("parses common FMP timestamp shapes and keeps only today's UTC events", async () => {
    vi.mocked(fetchFmpJson).mockResolvedValue([
      {
        date: "2026-04-15T08:30:00Z",
        event: "CPI m/m",
        currency: "USD",
        impact: "High",
        forecast: "0.3%",
        previous: "0.2%",
      },
      {
        date: "2026-04-15",
        time: "14:00 UTC",
        event: "Retail Sales",
        currency: "USD",
        importance: "2",
      },
      {
        date: "2026-04-16",
        time: "09:00 UTC",
        event: "Tomorrow event",
        currency: "EUR",
        impact: "High",
      },
    ]);

    const snapshot = await getEconomicCalendarSnapshot();

    expect(fetchFmpJson).toHaveBeenCalledWith(
      "stable/economic-calendar",
      { from: "2026-04-15", to: "2026-04-15" },
      2_700,
    );
    expect(snapshot.dayLabel).toContain("Today");
    expect(snapshot.dayLabel).toContain("2026");
    expect(snapshot.items).toHaveLength(2);
    expect(snapshot.items[0]?.event).toBe("CPI m/m");
    expect(snapshot.items[0]?.timeUtc).toBe("2026-04-15T08:30:00.000Z");
    expect(snapshot.items[1]?.event).toBe("Retail Sales");
    expect(snapshot.items[1]?.timeUtc).toBe("2026-04-15T14:00:00.000Z");
  });
});
