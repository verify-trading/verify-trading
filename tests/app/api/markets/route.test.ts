import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: vi.fn(),
}));

vi.mock("@/lib/markets/twelve-data-adapter", () => ({
  readCacheRow: vi.fn(),
}));

import { GET } from "@/app/api/markets/route";
import { readCacheRow } from "@/lib/markets/twelve-data-adapter";
import { getSessionUser } from "@/lib/auth/session";

describe("GET /api/markets (Twelve Data)", () => {
  it("returns 401 when there is no session", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "unauthorized",
      message: "Sign in to view Markets.",
    });
    expect(readCacheRow).not.toHaveBeenCalled();
  });

  it("returns 403 for authenticated free users", async () => {
    vi.mocked(getSessionUser).mockResolvedValue({
      user: { id: "user-free", app_metadata: {}, user_metadata: {}, aud: "", created_at: "" },
      supabase: {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { tier: "free" },
                error: null,
              }),
            }),
          }),
        }),
      } as never,
    });

    const response = await GET();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "pro_required",
      message: "Upgrade to Pro to unlock Markets.",
    });
    expect(readCacheRow).not.toHaveBeenCalled();
  });

  it("returns cached market snapshot for pro users", async () => {
    vi.mocked(getSessionUser).mockResolvedValue({
      user: { id: "user-pro", app_metadata: {}, user_metadata: {}, aud: "", created_at: "" },
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
    vi.mocked(readCacheRow).mockImplementation(async (key: string) => {
      if (key === "quotes:all") {
        return {
          payload: {
            quotes: {
              "EUR/USD": { symbol: "EUR/USD", name: "Euro", price: 1.17, percent_change: -0.33, change: -0.004, open: 1.18, high: 1.19, low: 1.16, previous_close: 1.174, is_market_open: true, exchange: "Forex" },
            },
          },
          fetchedAt: "2026-05-04T12:00:00.000Z",
        };
      }
      if (key === "sparklines:all") {
        return {
          payload: { sparklines: { "EUR/USD": [1.18, 1.179, 1.177, 1.175, 1.17] } },
          fetchedAt: "2026-05-04T12:05:00.000Z",
        };
      }
      if (key === "series:1D") {
        return {
          payload: { series: { "EUR/USD": [1.18, 1.179, 1.177, 1.175, 1.17] } },
          fetchedAt: "2026-05-04T12:05:00.000Z",
        };
      }
      if (key === "series:1W") {
        return {
          payload: { series: { "EUR/USD": [1.14, 1.15, 1.16, 1.17] } },
          fetchedAt: "2026-05-04T12:06:00.000Z",
        };
      }
      return null;
    });

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.quotes).toBeDefined();
    expect(json.updatedAt).toBe("2026-05-04T12:00:00.000Z");
    expect(json.quotes["EUR/USD"].price).toBe(1.17);
    expect(json.sparklines["EUR/USD"]).toHaveLength(5);
    expect(json.seriesByTimeframe["1D"]["EUR/USD"]).toHaveLength(5);
    expect(json.seriesByTimeframe["1W"]["EUR/USD"]).toHaveLength(4);
  });

  it("disables public caching for the authenticated snapshot", async () => {
    vi.mocked(getSessionUser).mockResolvedValue({
      user: { id: "user-pro", app_metadata: {}, user_metadata: {}, aud: "", created_at: "" },
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
    vi.mocked(readCacheRow).mockResolvedValue({ payload: { quotes: {}, sparklines: {} }, fetchedAt: null });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
  });
});
