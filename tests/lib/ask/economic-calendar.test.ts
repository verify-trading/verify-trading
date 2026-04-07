import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchEconomicCalendar,
  getEconomicCalendarWindow,
} from "@/lib/ask/economic-calendar";

describe("fetchEconomicCalendar", () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.FMP_API_KEY;

  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.FINANCIAL_MODELING_PREP_API_KEY;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.FMP_API_KEY;
    } else {
      process.env.FMP_API_KEY = originalApiKey;
    }
  });

  it("returns a configuration note when no API key is present", async () => {
    delete process.env.FMP_API_KEY;

    const result = await fetchEconomicCalendar({
      from: "2026-04-07",
      to: "2026-04-10",
    });

    expect(result).toEqual({
      from: "2026-04-07",
      to: "2026-04-10",
      events: [],
      note: "Economic calendar is not configured on the server.",
      source: "FMP",
    });
  });

  it("normalizes, filters, and limits FMP calendar rows", async () => {
    process.env.FMP_API_KEY = "test-key";
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            date: "2026-04-10",
            time: "12:30",
            country: "United States",
            event: "CPI",
            impact: "High",
            currency: "USD",
            actual: "3.1%",
            previous: "3.0%",
            estimate: "3.2%",
          },
          {
            date: "2026-04-09",
            time: "11:00",
            country: "United Kingdom",
            event: "GDP",
            impact: "Medium",
            currency: "GBP",
          },
        ]),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    const result = await fetchEconomicCalendar({
      from: "2026-04-07",
      to: "2026-04-14",
      country: "US",
      importance: "high",
      limit: 1,
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        href: expect.stringContaining("from=2026-04-07"),
      }),
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(result).toEqual({
      from: "2026-04-07",
      to: "2026-04-14",
      events: [
        {
          date: "2026-04-10",
          time: "12:30",
          country: "United States",
          event: "CPI",
          impact: "high",
          currency: "USD",
          actual: "3.1%",
          previous: "3.0%",
          estimate: "3.2%",
        },
      ],
      source: "FMP",
    });
  });
});

describe("getEconomicCalendarWindow", () => {
  it("uses the explicit end date when only to is provided", () => {
    expect(getEconomicCalendarWindow({ to: "2026-04-10" })).toEqual({
      from: "2026-04-10",
      to: "2026-04-10",
    });
  });
});
