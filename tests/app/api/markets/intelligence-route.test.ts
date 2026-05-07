import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: vi.fn(),
}));

vi.mock("@/lib/markets/twelve-data-adapter", () => ({
  readCacheRow: vi.fn(),
}));

import { GET } from "@/app/api/markets/intelligence/route";
import { readCacheRow } from "@/lib/markets/twelve-data-adapter";
import { getSessionUser } from "@/lib/auth/session";

describe("GET /api/markets/intelligence", () => {
  it("returns 401 when there is no session", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null);

    const response = await GET();
    expect(response.status).toBe(401);
    expect(readCacheRow).not.toHaveBeenCalled();
  });

  it("returns 403 for authenticated free users", async () => {
    vi.mocked(getSessionUser).mockResolvedValue({
      user: { id: "user-free" } as never,
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
    expect(readCacheRow).not.toHaveBeenCalled();
  });

  it("returns intelligence snapshot for pro users", async () => {
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
    vi.mocked(readCacheRow).mockResolvedValue({
      fetchedAt: "2026-04-15T10:00:00.000Z",
      payload: {
        updatedAt: "2026-04-15T10:00:00.000Z",
        items: [
          {
            id: "a1",
            title: "Test",
            source: "NewsData",
            publishedAt: "2026-04-15T09:00:00.000Z",
            summary: "Hello",
          },
        ],
      },
    });

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.items).toHaveLength(1);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
  });

  it("returns 503 for pro users before the intelligence cache is warm", async () => {
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
    vi.mocked(readCacheRow).mockResolvedValue(null);

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(503);
    expect(json.error).toBe("market_intelligence_cache_empty");
  });
});
