import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getEconomicCalendarWeekSnapshot,
  shouldRefreshEconomicCalendar,
} from "@/lib/markets/rapidapi-economic-calendar";

function mockForexApi(events: unknown[], overrides: Partial<Response> = {}) {
  global.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ data: events, errors: [], hasError: false }),
    ...overrides,
  }) as Response) as unknown as typeof fetch;
}

describe("forex-api2 economic calendar", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("requests the whole country set in one call and maps UK -> GB", async () => {
    vi.stubEnv("RAPIDAPI_KEY", "test-key");
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          {
            id: "uk-1",
            dateUtc: "2026-05-06T06:00:00.000Z",
            countryCode: "UK",
            currencyCode: "GBP",
            name: "BoE Interest Rate Decision",
            actual: 4.25,
            consensus: 4.25,
            previous: 4.5,
            revised: 0,
            volatility: "HIGH",
          },
        ],
        errors: [],
        hasError: false,
      }),
    }) as Response);
    global.fetch = fetchSpy as unknown as typeof fetch;

    const snapshot = await getEconomicCalendarWeekSnapshot(null, new Date("2026-05-05T12:00:00.000Z"));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const requestedUrl = new URL(String((fetchSpy.mock.calls[0] as unknown[])[0]));
    expect(requestedUrl.searchParams.get("startDate")).toBe("2026-05-04");
    expect(requestedUrl.searchParams.get("endDate")).toBe("2026-05-13");
    expect(requestedUrl.searchParams.get("includeCountries")).toBe("us;de;uk;ca;jp;au;nz;cn");
    expect(requestedUrl.searchParams.get("includeVolatilities")).toBe("none;low;medium;high");

    expect(snapshot.from).toBe("2026-05-04");
    expect(snapshot.to).toBe("2026-05-13");
    expect(snapshot.dayLabel).toBe("Upcoming events");
    expect(snapshot.items).toHaveLength(1);
    expect(snapshot.items[0]).toMatchObject({
      id: "uk-1",
      country: "GB",
      currency: "GBP",
      event: "BoE Interest Rate Decision",
      impact: "high",
      actual: "4.25",
      forecast: "4.25",
      previous: "4.5",
    });
  });

  it("maps volatility to impact and blanks zero placeholders", async () => {
    vi.stubEnv("RAPIDAPI_KEY", "test-key");
    mockForexApi([
      {
        id: "us-speech",
        dateUtc: "2026-05-06T14:00:00.000Z",
        countryCode: "US",
        currencyCode: "USD",
        name: "Fed's Barkin speech",
        actual: 0,
        consensus: 0,
        previous: 0,
        revised: 0,
        volatility: "MEDIUM",
      },
      {
        id: "nz-rate",
        dateUtc: "2026-05-06T12:30:00.000Z",
        countryCode: "NZ",
        currencyCode: "NZD",
        name: "RBNZ Interest Rate Decision",
        actual: 0, // not released yet — a placeholder, not a real 0
        consensus: 2.5,
        previous: 2.25,
        revised: 0,
        volatility: "HIGH",
      },
    ]);

    const snapshot = await getEconomicCalendarWeekSnapshot(null, new Date("2026-05-05T12:00:00.000Z"));

    // Sorted by time: rate decision (12:30) before the speech (14:00).
    expect(snapshot.items.map((item) => item.id)).toEqual(["nz-rate", "us-speech"]);

    const speech = snapshot.items.find((item) => item.id === "us-speech")!;
    expect(speech.impact).toBe("medium");
    expect(speech.actual).toBeNull();
    expect(speech.forecast).toBeNull();
    expect(speech.previous).toBeNull();

    const rate = snapshot.items.find((item) => item.id === "nz-rate")!;
    expect(rate.impact).toBe("high");
    // Unreleased actual reports as 0, so it blanks; forecast/previous stay.
    expect(rate.actual).toBeNull();
    expect(rate.forecast).toBe("2.5");
    expect(rate.previous).toBe("2.25");
  });

  it("throws when the provider reports an error", async () => {
    vi.stubEnv("RAPIDAPI_KEY", "test-key");
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        data: [],
        errors: [{ message: "Parameter 'includeCountries' contains an invalid value" }],
        hasError: true,
      }),
    }) as Response) as unknown as typeof fetch;

    await expect(
      getEconomicCalendarWeekSnapshot(null, new Date("2026-05-05T12:00:00.000Z")),
    ).rejects.toThrow("invalid value");
  });

  it("throws when empty and no previous snapshot exists", async () => {
    vi.stubEnv("RAPIDAPI_KEY", "test-key");
    mockForexApi([]);

    await expect(
      getEconomicCalendarWeekSnapshot(null, new Date("2026-05-05T12:00:00.000Z")),
    ).rejects.toThrow("temporarily unavailable");
  });

  it("uses a one-day refresh threshold", () => {
    vi.spyOn(Date, "now").mockReturnValue(new Date("2026-05-05T12:00:00.000Z").getTime());

    // 23h59m since last fetch — still fresh.
    expect(shouldRefreshEconomicCalendar("2026-05-04T12:01:00.000Z")).toBe(false);
    // Exactly 24h — refresh.
    expect(shouldRefreshEconomicCalendar("2026-05-04T12:00:00.000Z")).toBe(true);
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
        "2026-05-06T00:00:00.000Z",
        "2026-05-05",
        new Date("2026-05-06T00:10:00.000Z"),
      ),
    ).toBe(false);
  });
});
