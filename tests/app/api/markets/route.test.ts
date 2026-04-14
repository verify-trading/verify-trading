import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ask/market", () => ({
  getMarketSeries: vi.fn(),
  deriveQuoteFromSeries: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: vi.fn(),
}));

import { GET } from "@/app/api/markets/route";
import { deriveQuoteFromSeries, getMarketSeries } from "@/lib/ask/market";
import { getSessionUser } from "@/lib/auth/session";

describe("GET /api/markets", () => {
  it("returns 401 when there is no session", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null);

    const response = await GET({
      nextUrl: new URL("http://localhost/api/markets"),
    } as never);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "unauthorized",
      message: "Sign in to view Markets.",
    });
    expect(getMarketSeries).not.toHaveBeenCalled();
  });

  it("returns 403 for authenticated free users", async () => {
    vi.mocked(getSessionUser).mockResolvedValue({
      user: { id: "user-free" },
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

    const response = await GET({
      nextUrl: new URL("http://localhost/api/markets"),
    } as never);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "pro_required",
      message: "Upgrade to Pro to unlock Markets.",
    });
    expect(getMarketSeries).not.toHaveBeenCalled();
  });

  it("returns a market snapshot for authenticated pro users", async () => {
    vi.mocked(getSessionUser).mockResolvedValue({
      user: { id: "user-pro" },
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
    vi.mocked(getMarketSeries).mockResolvedValue({
      timeframe: "1W",
      closeValues: [1, 2, 3],
      support: 1,
      resistance: 3,
    } as never);
    vi.mocked(deriveQuoteFromSeries).mockReturnValue({
      price: 123,
      changePercent: 1.5,
      direction: "up",
      symbol: "GCUSD",
      asset: "GOLD",
      isMarketOpen: null,
    } as never);

    const response = await GET({
      nextUrl: new URL("http://localhost/api/markets"),
    } as never);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.timeframe).toBe("1W");
    expect(json.assets).toHaveLength(8);
  });

  it("disables public caching for the authenticated snapshot", async () => {
    vi.mocked(getSessionUser).mockResolvedValue({
      user: { id: "user-pro" },
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
    vi.mocked(getMarketSeries).mockResolvedValue({
      timeframe: "1W",
      closeValues: [1, 2, 3],
      support: 1,
      resistance: 3,
    } as never);
    vi.mocked(deriveQuoteFromSeries).mockReturnValue({
      price: 123,
      changePercent: 1.5,
      direction: "up",
      symbol: "GCUSD",
      asset: "GOLD",
      isMarketOpen: null,
    } as never);

    const response = await GET({
      nextUrl: new URL("http://localhost/api/markets"),
    } as never);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
  });
});
