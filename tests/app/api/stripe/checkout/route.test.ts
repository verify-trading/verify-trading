import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: vi.fn(),
}));

vi.mock("@/lib/billing/config", () => ({
  getCheckoutBillingOffer: vi.fn(),
}));

vi.mock("@/lib/billing/repository", () => ({
  claimBillingCheckoutSession: vi.fn(),
  ensureStripeCustomerForUser: vi.fn(),
  getBillingCheckoutSession: vi.fn(),
  storeBillingCheckoutSession: vi.fn(),
}));

vi.mock("@/lib/billing/stripe-server", () => ({
  getStripeServerClient: vi.fn(),
}));

import { POST } from "@/app/api/stripe/checkout/route";
import { getSessionUser } from "@/lib/auth/session";
import { getCheckoutBillingOffer } from "@/lib/billing/config";
import {
  claimBillingCheckoutSession,
  ensureStripeCustomerForUser,
  getBillingCheckoutSession,
  storeBillingCheckoutSession,
} from "@/lib/billing/repository";
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

function createProfilesQuery(data: unknown) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
  const eq = vi.fn(() => ({ maybeSingle }));
  return {
    select: vi.fn(() => ({ eq })),
  };
}

describe("POST /api/stripe/checkout", () => {
  const createCheckoutSession = vi.fn();
  const expireCheckoutSession = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getSessionUser).mockResolvedValue({
      user: {
        id: "user-1",
        email: "ada@example.com",
      },
      supabase: {
        from: vi.fn((table: string) => {
          if (table === "billing_subscriptions") {
            return createBillingSubscriptionsQuery([]);
          }

          if (table === "profiles") {
            return createProfilesQuery({ display_name: "Ada" });
          }

          throw new Error(`Unexpected table: ${table}`);
        }),
      } as never,
    } as never);

    vi.mocked(getCheckoutBillingOffer).mockReturnValue({
      planKey: "monthly",
      variant: "standard",
      badge: "Pro",
      headline: "£24.99/month",
      detail: "Unlimited access.",
      ctaLabel: "Start Pro",
      checkoutPriceId: "price_standard",
      checkoutCouponId: null,
    });
    vi.mocked(ensureStripeCustomerForUser).mockResolvedValue("cus_123");
    vi.mocked(getBillingCheckoutSession).mockResolvedValue(null);
    vi.mocked(storeBillingCheckoutSession).mockResolvedValue(true);

    createCheckoutSession.mockResolvedValue({
      id: "cs_123",
      url: "https://checkout.stripe.test/cs_123",
      expires_at: 1_700_000_000,
    });
    expireCheckoutSession.mockResolvedValue({});

    vi.mocked(getStripeServerClient).mockReturnValue({
      checkout: {
        sessions: {
          create: createCheckoutSession,
          expire: expireCheckoutSession,
        },
      },
    } as never);
  });

  it("reuses an existing claimed checkout URL instead of creating a new session", async () => {
    vi.mocked(claimBillingCheckoutSession).mockResolvedValue({
      checkoutToken: "token-1",
      stripeCheckoutSessionId: "cs_existing",
      checkoutUrl: "https://checkout.stripe.test/existing",
      expiresAt: new Date().toISOString(),
      reused: true,
      replacedCheckoutSessionId: null,
    });

    const response = await POST(
      new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ plan: "monthly" }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      url: "https://checkout.stripe.test/existing",
    });
    expect(createCheckoutSession).not.toHaveBeenCalled();
    expect(ensureStripeCustomerForUser).not.toHaveBeenCalled();
  });

  it("creates a checkout session with an idempotency key tied to the claimed token", async () => {
    vi.mocked(claimBillingCheckoutSession).mockResolvedValue({
      checkoutToken: "token-2",
      stripeCheckoutSessionId: null,
      checkoutUrl: null,
      expiresAt: new Date().toISOString(),
      reused: false,
      replacedCheckoutSessionId: null,
    });

    const response = await POST(
      new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ plan: "monthly" }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_123",
        mode: "subscription",
      }),
      {
        idempotencyKey: "billing-checkout:token-2",
      },
    );
    expect(storeBillingCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        checkoutToken: "token-2",
        stripeCheckoutSessionId: "cs_123",
      }),
    );
  });

  it("does not apply a coupon to the annual checkout flow", async () => {
    vi.mocked(getCheckoutBillingOffer).mockReturnValue({
      planKey: "annual",
      variant: "standard",
      badge: "Best value",
      headline: "£200/year",
      detail: "Annual Pro",
      ctaLabel: "Start annual plan",
      checkoutPriceId: "price_annual",
      checkoutCouponId: null,
    });
    vi.mocked(claimBillingCheckoutSession).mockResolvedValue({
      checkoutToken: "token-annual",
      stripeCheckoutSessionId: null,
      checkoutUrl: null,
      expiresAt: new Date().toISOString(),
      reused: false,
      replacedCheckoutSessionId: null,
    });

    const response = await POST(
      new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ plan: "annual" }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [
          {
            price: "price_annual",
            quantity: 1,
          },
        ],
        discounts: undefined,
      }),
      {
        idempotencyKey: "billing-checkout:token-annual",
      },
    );
  });

  it("expires a stale session if checkout ownership changes mid-request and returns the current session", async () => {
    vi.mocked(claimBillingCheckoutSession).mockResolvedValue({
      checkoutToken: "token-3",
      stripeCheckoutSessionId: null,
      checkoutUrl: null,
      expiresAt: new Date().toISOString(),
      reused: false,
      replacedCheckoutSessionId: null,
    });
    vi.mocked(storeBillingCheckoutSession).mockResolvedValue(false);
    vi.mocked(getBillingCheckoutSession).mockResolvedValue({
      checkoutToken: "token-4",
      stripeCheckoutSessionId: "cs_current",
      checkoutUrl: "https://checkout.stripe.test/current",
      expiresAt: new Date().toISOString(),
      completedAt: null,
      plan: "monthly",
    });

    const response = await POST(
      new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ plan: "monthly" }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      url: "https://checkout.stripe.test/current",
    });
    expect(expireCheckoutSession).toHaveBeenCalledWith("cs_123");
  });

  it("rejects an invalid checkout payload", async () => {
    const response = await POST(
      new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ plan: "lifetime" }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invalid_request",
      message: "The checkout request is invalid.",
    });
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });
});
