import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: vi.fn(),
}));

vi.mock("@/lib/billing/config", () => ({
  getCheckoutBillingOffer: vi.fn(),
  getBillingPlanAmountGbp: vi.fn(() => 1900),
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
  const listSubscriptions = vi.fn();

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
      badge: "Pro",
      headline: "£19.99/month",
      detail: "Unlimited access.",
      ctaLabel: "Start Pro",
      checkoutPriceId: "price_standard",
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
    listSubscriptions.mockResolvedValue({ data: [] });

    vi.mocked(getStripeServerClient).mockReturnValue({
      checkout: {
        sessions: {
          create: createCheckoutSession,
          expire: expireCheckoutSession,
        },
      },
      subscriptions: {
        list: listSubscriptions,
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
      checkout: { plan: "monthly", currency: "GBP", value: 1900 },
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

  it("creates annual checkout without coupon discounts", async () => {
    vi.mocked(getCheckoutBillingOffer).mockReturnValue({
      planKey: "annual",
      badge: "Best value",
      headline: "£119.99/year",
      detail: "Annual Pro",
      ctaLabel: "Start annual plan",
      checkoutPriceId: "price_annual",
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
      }),
      {
        idempotencyKey: "billing-checkout:token-annual",
      },
    );
    expect(createCheckoutSession.mock.calls[0]?.[0]).not.toHaveProperty("discounts");
  });

  it("creates mobile checkout with app return URLs", async () => {
    vi.mocked(claimBillingCheckoutSession).mockResolvedValue({
      checkoutToken: "token-mobile",
      stripeCheckoutSessionId: null,
      checkoutUrl: null,
      expiresAt: new Date().toISOString(),
      reused: false,
      replacedCheckoutSessionId: null,
    });

    const response = await POST(
      new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ plan: "monthly", source: "mobile" }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        success_url: "verifytrading://billing/checkout?checkout=success&session_id={CHECKOUT_SESSION_ID}",
        cancel_url: "verifytrading://billing/checkout?checkout=cancelled",
      }),
      {
        idempotencyKey: "billing-checkout:token-mobile",
      },
    );
  });

  it("replaces a reused web checkout when mobile needs app return URLs", async () => {
    vi.mocked(claimBillingCheckoutSession).mockResolvedValue({
      checkoutToken: "token-reused-mobile",
      stripeCheckoutSessionId: "cs_web",
      checkoutUrl: "https://checkout.stripe.test/web-return",
      expiresAt: new Date().toISOString(),
      reused: true,
      replacedCheckoutSessionId: null,
    });

    const response = await POST(
      new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ plan: "monthly", source: "mobile" }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(expireCheckoutSession).toHaveBeenCalledWith("cs_web");
    expect(storeBillingCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        checkoutToken: "token-reused-mobile",
        stripeCheckoutSessionId: "cs_123",
      }),
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
      checkout: { plan: "monthly", currency: "GBP", value: 1900 },
    });
    expect(expireCheckoutSession).toHaveBeenCalledWith("cs_123");
  });

  it("gives the promo link a free week and still collects the card", async () => {
    vi.mocked(claimBillingCheckoutSession).mockResolvedValue({
      checkoutToken: "token-trial",
      stripeCheckoutSessionId: null,
      checkoutUrl: null,
      expiresAt: new Date().toISOString(),
      reused: false,
      replacedCheckoutSessionId: null,
    });

    const response = await POST(
      new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ plan: "weekly", trial: true }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        subscription_data: expect.objectContaining({ trial_period_days: 7 }),
      }),
      {
        idempotencyKey: "billing-checkout:token-trial:trial",
      },
    );
    // Checkout's default payment_method_collection ("always") is what forces card entry.
    expect(createCheckoutSession.mock.calls[0]?.[0]).not.toHaveProperty("payment_method_collection");
  });

  it("skips the trial for a customer who already subscribed before", async () => {
    listSubscriptions.mockResolvedValue({ data: [{ id: "sub_old" }] });
    vi.mocked(claimBillingCheckoutSession).mockResolvedValue({
      checkoutToken: "token-repeat",
      stripeCheckoutSessionId: null,
      checkoutUrl: null,
      expiresAt: new Date().toISOString(),
      reused: false,
      replacedCheckoutSessionId: null,
    });

    const response = await POST(
      new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ plan: "weekly", trial: true }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(createCheckoutSession.mock.calls[0]?.[0].subscription_data).not.toHaveProperty(
      "trial_period_days",
    );
  });

  it("replaces a reused checkout when the promo link asks for a trial", async () => {
    vi.mocked(claimBillingCheckoutSession).mockResolvedValue({
      checkoutToken: "token-reused-trial",
      stripeCheckoutSessionId: "cs_no_trial",
      checkoutUrl: "https://checkout.stripe.test/no-trial",
      expiresAt: new Date().toISOString(),
      reused: true,
      replacedCheckoutSessionId: null,
    });

    const response = await POST(
      new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ plan: "weekly", trial: true }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(expireCheckoutSession).toHaveBeenCalledWith("cs_no_trial");
    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_data: expect.objectContaining({ trial_period_days: 7 }),
      }),
      // The expired session's id is in the key. Without it a reused claim keeps its token, so
      // Stripe replays the cached response and hands back the session just expired.
      { idempotencyKey: "billing-checkout:token-reused-trial:trial:cs_no_trial" },
    );
  });

  it("does not replay the first session's idempotency key when the promo link is clicked twice", async () => {
    // Click 1: nothing claimed yet. Click 2: the claim is REUSED, so it comes back carrying the
    // same token and the session from click 1 — which this request expires and replaces.
    vi.mocked(claimBillingCheckoutSession)
      .mockResolvedValueOnce({
        checkoutToken: "token-promo",
        stripeCheckoutSessionId: null,
        checkoutUrl: null,
        expiresAt: new Date().toISOString(),
        reused: false,
        replacedCheckoutSessionId: null,
      })
      .mockResolvedValueOnce({
        checkoutToken: "token-promo",
        stripeCheckoutSessionId: "cs_123",
        checkoutUrl: "https://checkout.stripe.test/cs_123",
        expiresAt: new Date().toISOString(),
        reused: true,
        replacedCheckoutSessionId: null,
      });

    const promoRequest = () =>
      new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ plan: "weekly", trial: true }),
        headers: {
          "content-type": "application/json",
        },
      });

    await POST(promoRequest());
    await POST(promoRequest());

    // Same key twice would make Stripe replay the stored response and hand back cs_123 — the
    // session the second request just expired — leaving the trader on a dead Checkout page.
    const keys = createCheckoutSession.mock.calls.map((call) => call[1].idempotencyKey);
    expect(keys).toHaveLength(2);
    expect(new Set(keys).size).toBe(2);
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
