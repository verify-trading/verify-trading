import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: vi.fn(),
}));

vi.mock("@/lib/billing/repository", () => ({
  syncStripeSubscription: vi.fn(),
}));

vi.mock("@/lib/billing/stripe-server", () => ({
  getStripeServerClient: vi.fn(),
}));

import { POST } from "@/app/api/stripe/subscription/route";
import { getSessionUser } from "@/lib/auth/session";
import { syncStripeSubscription } from "@/lib/billing/repository";
import { getStripeServerClient } from "@/lib/billing/stripe-server";

function createBillingSubscriptionsQuery(data: unknown) {
  const limit = vi.fn().mockResolvedValue({ data, error: null });
  const secondOrder = vi.fn(() => ({ limit }));
  const firstOrder = vi.fn(() => ({ order: secondOrder }));
  const inFilter = vi.fn(() => ({ order: firstOrder }));
  const eq = vi.fn(() => ({ in: inFilter }));
  return {
    select: vi.fn(() => ({ eq })),
  };
}

describe("POST /api/stripe/subscription", () => {
  const updateSubscription = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getSessionUser).mockResolvedValue({
      user: {
        id: "user-1",
      },
      supabase: {
        from: vi.fn((table: string) => {
          if (table === "billing_subscriptions") {
            return createBillingSubscriptionsQuery([
              {
                stripe_subscription_id: "sub_123",
                status: "active",
                cancel_at_period_end: false,
              },
            ]);
          }

          throw new Error(`Unexpected table: ${table}`);
        }),
      } as never,
    });

    updateSubscription.mockResolvedValue({
      id: "sub_123",
      status: "active",
      cancel_at_period_end: true,
    });

    vi.mocked(getStripeServerClient).mockReturnValue({
      subscriptions: {
        update: updateSubscription,
      },
    } as never);

    vi.mocked(syncStripeSubscription).mockResolvedValue({
      status: "active",
      tier: "pro",
    });
  });

  it("updates the Stripe subscription and syncs the result", async () => {
    const response = await POST(
      new Request("http://localhost/api/stripe/subscription", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: "cancel_at_period_end",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "active",
      tier: "pro",
      message: "Your subscription will cancel at the end of the current billing period.",
    });
    expect(updateSubscription).toHaveBeenCalledWith("sub_123", {
      cancel_at_period_end: true,
    });
    expect(syncStripeSubscription).toHaveBeenCalled();
  });

  it("resumes renewal before the billing period ends", async () => {
    updateSubscription.mockResolvedValue({
      id: "sub_123",
      status: "active",
      cancel_at_period_end: false,
    });

    const response = await POST(
      new Request("http://localhost/api/stripe/subscription", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: "resume",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "active",
      tier: "pro",
      message: "Your subscription will continue renewing normally.",
    });
    expect(updateSubscription).toHaveBeenCalledWith("sub_123", {
      cancel_at_period_end: false,
    });
    expect(syncStripeSubscription).toHaveBeenCalled();
  });

  it("rejects invalid subscription actions", async () => {
    const response = await POST(
      new Request("http://localhost/api/stripe/subscription", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: "cancel_now",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invalid_request",
      message: "The subscription action is invalid.",
    });
    expect(updateSubscription).not.toHaveBeenCalled();
  });
});
