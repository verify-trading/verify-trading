import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: vi.fn(),
}));

vi.mock("@/lib/billing/config", () => ({
  getStripePortalConfigurationId: vi.fn(() => "bpc_test"),
}));

vi.mock("@/lib/billing/stripe-server", () => ({
  getStripeServerClient: vi.fn(),
}));

import { POST } from "@/app/api/stripe/customer-portal/route";
import { getSessionUser } from "@/lib/auth/session";
import { getStripePortalConfigurationId } from "@/lib/billing/config";
import { getStripeServerClient } from "@/lib/billing/stripe-server";

function createProfilesQuery(data: unknown) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
  const eq = vi.fn(() => ({ maybeSingle }));
  return {
    select: vi.fn(() => ({ eq })),
  };
}

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

describe("POST /api/stripe/customer-portal", () => {
  const createPortalSession = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSessionUser).mockResolvedValue({
      user: {
        id: "user-1",
      },
      supabase: {
        from: vi.fn((table: string) => {
          if (table === "profiles") {
            return createProfilesQuery({ stripe_customer_id: "cus_123" });
          }

          if (table === "billing_subscriptions") {
            return createBillingSubscriptionsQuery([{ stripe_subscription_id: "sub_123" }]);
          }

          throw new Error(`Unexpected table: ${table}`);
        }),
      } as never,
    });
    vi.mocked(getStripePortalConfigurationId).mockReturnValue("bpc_test");
    createPortalSession.mockResolvedValue({
      url: "https://billing.stripe.test/session",
    });
    vi.mocked(getStripeServerClient).mockReturnValue({
      billingPortal: {
        sessions: {
          create: createPortalSession,
        },
      },
    } as never);
  });

  it("creates a standard billing portal session by default", async () => {
    const response = await POST(
      new Request("http://localhost/api/stripe/customer-portal", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      url: "https://billing.stripe.test/session",
    });
    expect(createPortalSession).toHaveBeenCalledWith({
      customer: "cus_123",
      return_url: "http://localhost/billing",
      configuration: "bpc_test",
      flow_data: undefined,
    });
  });

  it("creates a subscription update flow when plan changes are requested", async () => {
    const response = await POST(
      new Request("http://localhost/api/stripe/customer-portal", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          flow: "subscription_update",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(createPortalSession).toHaveBeenCalledWith({
      customer: "cus_123",
      return_url: "http://localhost/billing",
      configuration: "bpc_test",
      flow_data: {
        type: "subscription_update",
        after_completion: {
          type: "redirect",
          redirect: {
            return_url: "http://localhost/billing",
          },
        },
        subscription_update: {
          subscription: "sub_123",
        },
      },
    });
  });
});
