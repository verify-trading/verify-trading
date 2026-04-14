import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

vi.mock("@/lib/billing/config", () => ({
  getStripeWebhookSecret: vi.fn(() => "whsec_test"),
}));

vi.mock("@/lib/billing/repository", () => ({
  claimStripeWebhookEvent: vi.fn(),
  markStripeWebhookEventProcessed: vi.fn(),
  releaseStripeWebhookEventClaim: vi.fn(),
  syncCheckoutSessionById: vi.fn(),
  syncStripeSubscription: vi.fn(),
  syncStripeSubscriptionById: vi.fn(),
}));

vi.mock("@/lib/billing/stripe-server", () => ({
  getStripeServerClient: vi.fn(),
}));

import { headers } from "next/headers";

import { POST } from "@/app/api/stripe/webhook/route";
import {
  claimStripeWebhookEvent,
  markStripeWebhookEventProcessed,
  releaseStripeWebhookEventClaim,
  syncCheckoutSessionById,
  syncStripeSubscription,
  syncStripeSubscriptionById,
} from "@/lib/billing/repository";
import { getStripeServerClient } from "@/lib/billing/stripe-server";

describe("POST /api/stripe/webhook", () => {
  const constructEvent = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(headers).mockResolvedValue({
      get: vi.fn(() => "sig_test"),
    } as never);
    vi.mocked(claimStripeWebhookEvent).mockResolvedValue(true);
    vi.mocked(releaseStripeWebhookEventClaim).mockResolvedValue(undefined);
    vi.mocked(getStripeServerClient).mockReturnValue({
      webhooks: {
        constructEvent,
      },
    } as never);
  });

  it("returns duplicate when another worker already claimed the webhook", async () => {
    constructEvent.mockReturnValue({
      id: "evt_duplicate",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_123",
        },
      },
    });
    vi.mocked(claimStripeWebhookEvent).mockResolvedValue(false);

    const response = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: "{}",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      received: true,
      duplicate: true,
    });
    expect(syncStripeSubscriptionById).not.toHaveBeenCalled();
  });

  it("syncs a completed subscription checkout and marks the event processed", async () => {
    constructEvent.mockReturnValue({
      id: "evt_checkout_completed",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_success",
          mode: "subscription",
        },
      },
    });

    const response = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: "{}",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      received: true,
    });
    expect(syncCheckoutSessionById).toHaveBeenCalledWith("cs_success");
    expect(markStripeWebhookEventProcessed).toHaveBeenCalledWith(
      "evt_checkout_completed",
      "checkout.session.completed",
    );
  });

  it("syncs newly created subscriptions by re-reading the canonical subscription from Stripe", async () => {
    constructEvent.mockReturnValue({
      id: "evt_created",
      type: "customer.subscription.created",
      data: {
        object: {
          id: "sub_created",
        },
      },
    });

    const response = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: "{}",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      received: true,
    });
    expect(syncStripeSubscriptionById).toHaveBeenCalledWith("sub_created");
    expect(markStripeWebhookEventProcessed).toHaveBeenCalledWith(
      "evt_created",
      "customer.subscription.created",
    );
  });

  it("syncs subscription updates by re-reading the canonical subscription from Stripe", async () => {
    constructEvent.mockReturnValue({
      id: "evt_updated",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_456",
        },
      },
    });

    const response = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: "{}",
      }),
    );

    expect(response.status).toBe(200);
    expect(syncStripeSubscriptionById).toHaveBeenCalledWith("sub_456");
    expect(syncStripeSubscription).not.toHaveBeenCalled();
    expect(markStripeWebhookEventProcessed).toHaveBeenCalledWith(
      "evt_updated",
      "customer.subscription.updated",
    );
  });

  it("syncs ended subscriptions from the webhook payload once the paid time has passed", async () => {
    const deletedSubscription = {
      id: "sub_deleted",
      status: "canceled",
      cancel_at_period_end: true,
    };

    constructEvent.mockReturnValue({
      id: "evt_deleted",
      type: "customer.subscription.deleted",
      data: {
        object: deletedSubscription,
      },
    });

    const response = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: "{}",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      received: true,
    });
    expect(syncStripeSubscription).toHaveBeenCalledWith(deletedSubscription);
    expect(syncStripeSubscriptionById).not.toHaveBeenCalledWith("sub_deleted");
    expect(markStripeWebhookEventProcessed).toHaveBeenCalledWith(
      "evt_deleted",
      "customer.subscription.deleted",
    );
  });

  it("releases the webhook claim when processing fails", async () => {
    constructEvent.mockReturnValue({
      id: "evt_failed",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_123",
          mode: "subscription",
        },
      },
    });
    vi.mocked(syncCheckoutSessionById).mockRejectedValue(new Error("boom"));

    const response = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: "{}",
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "webhook_processing_failed",
      message: "Could not process the Stripe webhook.",
    });
    expect(releaseStripeWebhookEventClaim).toHaveBeenCalledWith("evt_failed");
    expect(markStripeWebhookEventProcessed).not.toHaveBeenCalled();
  });
});
