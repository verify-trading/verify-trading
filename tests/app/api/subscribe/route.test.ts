import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

import { POST } from "@/app/api/subscribe/route";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

describe("POST /api/subscribe", () => {
  it("stores normalized guide emails for tracking", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue({ upsert }),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/subscribe", {
        method: "POST",
        body: JSON.stringify({ email: " Trader@Example.COM ", source: "landing_guide" }),
      }) as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "trader@example.com",
        source: "landing_guide",
        subscribed: true,
      }),
      { onConflict: "email,source" },
    );
  });
});
