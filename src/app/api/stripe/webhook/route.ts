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
import { billingStatusGrantsProAccess } from "@/lib/billing/subscription-status";
import { getStripeServerClient } from "@/lib/billing/stripe-server";
import { maybeSendSubscriptionWelcomeEmail } from "@/lib/email/maybe-send-subscription-welcome";
import { tagPaidMemberInKit } from "@/lib/marketing/kit";
import { logger } from "@/lib/observability/logger";

export const runtime = "nodejs";

function readStripeCustomerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!customer) {
    return null;
  }

  return typeof customer === "string" ? customer : customer.id;
}

function isDeletedStripeCustomer(customer: Stripe.Customer | Stripe.DeletedCustomer): customer is Stripe.DeletedCustomer {
  return "deleted" in customer && customer.deleted === true;
}

async function tagPaidMemberFromSubscription(
  stripe: Stripe,
  subscription: Stripe.Subscription,
): Promise<void> {
  const customerId = readStripeCustomerId(subscription.customer);
  if (!customerId) {
    return;
  }

  const customer = await stripe.customers.retrieve(customerId);
  if (isDeletedStripeCustomer(customer) || !customer.email) {
    return;
  }

  await tagPaidMemberInKit({
    email: customer.email,
    displayName: customer.name,
  });
}

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

      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        const syncResult = await syncStripeSubscriptionById(subscription.id);
        if (billingStatusGrantsProAccess(syncResult.status)) {
          const interval = subscription.items.data[0]?.price?.recurring?.interval ?? null;
          const origin = new URL(request.url).origin;
          await tagPaidMemberFromSubscription(stripe, subscription).catch((kitError) => {
            logger.warn("Failed to tag paid member in Kit.", {
              userId: syncResult.userId,
              stripeSubscriptionId: subscription.id,
              error: kitError instanceof Error ? kitError.message : String(kitError),
            });
          });
          await maybeSendSubscriptionWelcomeEmail({
            userId: syncResult.userId,
            stripeSubscriptionId: subscription.id,
            interval,
            appOrigin: origin,
          }).catch(() => undefined);
        }
        break;
      }

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
