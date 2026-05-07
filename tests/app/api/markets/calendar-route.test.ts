import { describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/markets/markets-api-auth", () => ({
  requireMarketsProSession: vi.fn(),
  MARKETS_PRIVATE_CACHE_HEADERS: { "Cache-Control": "private, no-store, max-age=0" },
}));

vi.mock("@/lib/markets/twelve-data-adapter", () => ({
  readCacheRow: vi.fn(),
}));

import { GET } from "@/app/api/markets/calendar/route";
import { requireMarketsProSession } from "@/lib/markets/markets-api-auth";
import { readCacheRow } from "@/lib/markets/twelve-data-adapter";

describe("GET /api/markets/calendar", () => {
  it("returns 401 when there is no session", async () => {
    vi.mocked(requireMarketsProSession).mockResolvedValue({
      ok: false,
      response: new NextResponse(null, { status: 401 }),
    });

    const response = await GET();
    expect(response.status).toBe(401);
    expect(readCacheRow).not.toHaveBeenCalled();
  });

  it("returns 403 for non-pro users", async () => {
    vi.mocked(requireMarketsProSession).mockResolvedValue({
      ok: false,
      response: new NextResponse(null, { status: 403 }),
    });

    const response = await GET();
    expect(response.status).toBe(403);
    expect(readCacheRow).not.toHaveBeenCalled();
  });

  it("returns cached weekly economic calendar for pro users", async () => {
    vi.mocked(requireMarketsProSession).mockResolvedValue({
      ok: true,
      userId: "user-pro",
    });

    vi.mocked(readCacheRow).mockResolvedValue({
      fetchedAt: "2026-05-05T10:00:00.000Z",
      payload: {
        updatedAt: "2026-05-05T10:00:00.000Z",
        from: "2026-05-05",
        to: "2026-05-12",
        countries: ["US", "CN"],
        dayLabel: "This week — 2026-05-05 to 2026-05-12",
        items: [
          {
            id: "event-1",
            timeUtc: "2026-05-05T14:00:00.000Z",
            timeLabel: "14:00 UTC",
            country: "US",
            currency: "USD",
            event: "ISM N-Mfg PMI",
            impact: "high",
            actual: "53.6",
            forecast: "53.7",
            previous: "54",
          },
        ],
      },
    });

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.items).toHaveLength(1);
    expect(json.items[0].id).toBe("event-1");
    expect(json.items[0].event).toBe("ISM N-Mfg PMI");
    expect(json.dayLabel).toContain("This week");
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
  });

  it("returns an empty weekly snapshot before the cache is warm", async () => {
    vi.mocked(requireMarketsProSession).mockResolvedValue({
      ok: true,
      userId: "user-pro",
    });
    vi.mocked(readCacheRow).mockResolvedValue(null);

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.items).toEqual([]);
    expect(json.dayLabel).toBe("This week");
  });
});
