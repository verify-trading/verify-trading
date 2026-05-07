import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getEconomicCalendarWeekSnapshot,
  shouldRefreshEconomicCalendar,
} from "@/lib/markets/rapidapi-economic-calendar";

describe("rapidapi economic calendar", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("normalizes weekly events and maps DE display currency to EUR", async () => {
    vi.stubEnv("ULTIMATE_ECONOMIC_CALENDAR_API_KEY", "test-key");
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const country = new URL(url).searchParams.get("countries");
      return {
        ok: true,
        json: async () => ({
          result:
            country === "DE"
              ? [
                  {
                    id: "de-1",
                    date: "2026-05-06T07:55:00.000Z",
                    country: "DE",
                    currency: "DEM",
                    title: "HCOB Composite Final PMI",
                    importance: 0,
                    actual: null,
                    forecast: 48.3,
                    previous: 51.9,
                    unit: "Index (diffusion)",
                    scale: "",
                    source: "Markit",
                    period: "Apr. 2026",
                  },
                ]
              : [],
        }),
      } as Response;
    }) as unknown as typeof fetch;

    const snapshot = await getEconomicCalendarWeekSnapshot(
      null,
      new Date("2026-05-05T12:00:00.000Z"),
    );

    expect(snapshot.from).toBe("2026-05-04");
    expect(snapshot.to).toBe("2026-05-13");
    expect(snapshot.dayLabel).toBe("Upcoming events");
    expect(snapshot.items).toHaveLength(1);
    expect(snapshot.items[0]).toMatchObject({
      id: "de-1",
      country: "DE",
      currency: "EUR",
      impact: "medium",
      forecast: "48.3 Index (diffusion)",
      previous: "51.9 Index (diffusion)",
    });
  });

  it("keeps previous country events when that country fetch fails", async () => {
    vi.stubEnv("ULTIMATE_ECONOMIC_CALENDAR_API_KEY", "test-key");
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const country = new URL(String(input)).searchParams.get("countries");
      if (country === "CN") {
        return {
          ok: false,
          json: async () => ({ message: "rate limited" }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({ result: [] }),
      } as Response;
    }) as unknown as typeof fetch;

    const snapshot = await getEconomicCalendarWeekSnapshot(
      {
        updatedAt: "2026-05-05T00:00:00.000Z",
        dayLabel: "old",
        items: [
          {
            id: "cn-old",
            timeUtc: "2026-05-07T08:00:00.000Z",
            timeLabel: "08:00 UTC",
            country: "CN",
            currency: "CNY",
            event: "FX Reserves",
            impact: "high",
            actual: null,
            forecast: "3.363T USD",
            previous: "3.342T USD",
          },
        ],
      },
      new Date("2026-05-05T12:00:00.000Z"),
    );

    expect(snapshot.items).toHaveLength(1);
    expect(snapshot.items[0]?.id).toBe("cn-old");
  });

  it("does not retain previous country events outside the current cache window", async () => {
    vi.stubEnv("ULTIMATE_ECONOMIC_CALENDAR_API_KEY", "test-key");
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const country = new URL(String(input)).searchParams.get("countries");
      if (country === "CN") {
        return {
          ok: false,
          json: async () => ({ message: "temporary provider failure" }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({
          result:
            country === "US"
              ? [
                  {
                    id: "us-current",
                    date: "2026-05-06T14:00:00.000Z",
                    country: "US",
                    currency: "USD",
                    title: "ISM Services PMI",
                    importance: 1,
                    forecast: 53.7,
                    previous: 54,
                  },
                ]
              : [],
        }),
      } as Response;
    }) as unknown as typeof fetch;

    const snapshot = await getEconomicCalendarWeekSnapshot(
      {
        updatedAt: "2026-04-28T00:00:00.000Z",
        from: "2026-04-28",
        to: "2026-05-05",
        dayLabel: "old",
        items: [
          {
            id: "cn-old-window",
            timeUtc: "2026-04-30T08:00:00.000Z",
            timeLabel: "08:00 UTC",
            country: "CN",
            currency: "CNY",
            event: "NBS Manufacturing PMI",
            impact: "high",
            actual: null,
            forecast: "50.5",
            previous: "50.8",
          },
        ],
      },
      new Date("2026-05-05T12:00:00.000Z"),
    );

    expect(snapshot.items.map((item) => item.id)).toEqual(["us-current"]);
  });

  it("uses a two-hour refresh threshold", () => {
    vi.spyOn(Date, "now").mockReturnValue(new Date("2026-05-05T12:00:00.000Z").getTime());

    expect(shouldRefreshEconomicCalendar("2026-05-05T10:01:00.000Z")).toBe(false);
    expect(shouldRefreshEconomicCalendar("2026-05-05T10:00:00.000Z")).toBe(true);
  });

  it("refreshes before the TTL when the cached window is for the previous UTC day", () => {
    vi.spyOn(Date, "now").mockReturnValue(new Date("2026-05-06T00:10:00.000Z").getTime());

    expect(
      shouldRefreshEconomicCalendar(
        "2026-05-05T23:50:00.000Z",
        "2026-05-04",
        new Date("2026-05-06T00:10:00.000Z"),
      ),
    ).toBe(true);
    expect(
      shouldRefreshEconomicCalendar(
        "2026-05-05T23:50:00.000Z",
        "2026-05-05",
        new Date("2026-05-06T00:10:00.000Z"),
      ),
    ).toBe(false);
  });
});
