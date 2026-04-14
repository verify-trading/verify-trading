import type Stripe from "stripe";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { getStripeWebhookSecret } from "@/lib/billing/config";
import {
  claimStripeWebhookEvent,
  markStripeWebhookEventProcessed,
  releaseStripeWebhookEventClaim,
  syncCheckoutSessionById,
  syncStripeSubscription,
  syncStripeSubscriptionById,
} from "@/lib/billing/repository";
import { getStripeServerClient } from "@/lib/billing/stripe-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      {
        error: "missing_signature",
        message: "Missing Stripe signature header.",
      },
      { status: 400 },
    );
  }

  const payload = await request.text();
  const stripe = getStripeServerClient();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, getStripeWebhookSecret());
  } catch {
    return NextResponse.json(
      {
        error: "invalid_signature",
        message: "Invalid Stripe webhook signature.",
      },
      { status: 400 },
    );
  }

  try {
    if (!(await claimStripeWebhookEvent(event.id, event.type))) {
      return NextResponse.json({
        received: true,
        duplicate: true,
      });
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription") {
          await syncCheckoutSessionById(session.id);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await syncStripeSubscriptionById(subscription.id);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await syncStripeSubscription(subscription);
        break;
      }

      default:
        break;
    }

    await markStripeWebhookEventProcessed(event.id, event.type);

    return NextResponse.json({
      received: true,
    });
  } catch (error) {
    console.error("[api/stripe/webhook]", error);
    await releaseStripeWebhookEventClaim(event.id).catch(() => undefined);
    return NextResponse.json(
      {
        error: "webhook_processing_failed",
        message: "Could not process the Stripe webhook.",
      },
      { status: 500 },
    );
  }
}
