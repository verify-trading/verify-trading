import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: vi.fn(),
}));

vi.mock("@/lib/billing/repository", () => ({
  syncCheckoutSessionById: vi.fn(),
}));

import { POST } from "@/app/api/stripe/sync-checkout/route";
import { getSessionUser } from "@/lib/auth/session";
import { syncCheckoutSessionById } from "@/lib/billing/repository";

describe("POST /api/stripe/sync-checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getSessionUser).mockResolvedValue({
      user: {
        id: "user-1",
      },
    } as never);

    vi.mocked(syncCheckoutSessionById).mockResolvedValue({
      userId: "user-1",
      customerId: "cus_123",
      tier: "pro",
      status: "active",
    });
  });

  it("syncs the checkout session for the current user", async () => {
    const response = await POST(
      new Request("http://localhost/api/stripe/sync-checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          checkoutSessionId: "cs_123",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      tier: "pro",
      status: "active",
    });
    expect(syncCheckoutSessionById).toHaveBeenCalledWith("cs_123", "user-1");
  });

  it("rejects an empty checkout session id", async () => {
    const response = await POST(
      new Request("http://localhost/api/stripe/sync-checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          checkoutSessionId: "",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invalid_request",
      message: "The checkout sync payload is invalid.",
    });
    expect(syncCheckoutSessionById).not.toHaveBeenCalled();
  });
});
