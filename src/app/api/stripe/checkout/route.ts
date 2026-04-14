import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth/session";
import { jsonApiError, jsonInvalidRequest, jsonUnauthorized } from "@/lib/http/json-response";
import { getCheckoutBillingOffer } from "@/lib/billing/config";
import {
  claimBillingCheckoutSession,
  ensureStripeCustomerForUser,
  getBillingCheckoutSession,
  storeBillingCheckoutSession,
} from "@/lib/billing/repository";
import { getStripeServerClient } from "@/lib/billing/stripe-server";
import { MANAGEABLE_SUBSCRIPTION_STATUSES } from "@/lib/billing/subscription-status";

type ProfileRow = {
  display_name: string | null;
};

const checkoutRequestSchema = z.object({
  plan: z.enum(["monthly", "annual"]).default("monthly"),
});

export async function POST(request: Request) {
  try {
    const session = await getSessionUser();

    if (!session) {
      return jsonUnauthorized("Sign in to start checkout.");
    }

    const payload = checkoutRequestSchema.parse(await request.json().catch(() => ({})));

    const [subscriptionResult, profileResult] = await Promise.all([
      session.supabase
        .from("billing_subscriptions")
        .select("stripe_subscription_id")
        .eq("user_id", session.user.id)
        .in("status", [...MANAGEABLE_SUBSCRIPTION_STATUSES])
        .order("current_period_end", { ascending: false, nullsFirst: false })
        .order("updated_at", { ascending: false })
        .limit(1),
      session.supabase
        .from("profiles")
        .select("display_name")
        .eq("id", session.user.id)
        .maybeSingle(),
    ]);

    if (subscriptionResult.error) {
      throw new Error(subscriptionResult.error.message);
    }

    if (profileResult.error) {
      throw new Error(profileResult.error.message);
    }

    const activeSubscriptions = (subscriptionResult.data as { stripe_subscription_id: string }[] | null) ?? [];
    if (activeSubscriptions.length > 0) {
      return jsonApiError(
        409,
        "subscription_exists",
        "You already have a subscription. Open the billing portal to manage it.",
      );
    }

    const checkoutClaim = await claimBillingCheckoutSession({
      userId: session.user.id,
      plan: payload.plan,
    });

    if (checkoutClaim.checkoutUrl) {
      return NextResponse.json({
        url: checkoutClaim.checkoutUrl,
      });
    }

    const offer = getCheckoutBillingOffer(payload.plan);
    const customerId = await ensureStripeCustomerForUser({
      userId: session.user.id,
      email: session.user.email,
      displayName: (profileResult.data as ProfileRow | null)?.display_name ?? null,
    });

    const stripe = getStripeServerClient();
    const origin = new URL(request.url).origin;
    const metadata = {
      supabaseUserId: session.user.id,
      planKey: "pro",
      billingPlan: offer.planKey,
      offerVariant: offer.variant,
    };

    if (checkoutClaim.replacedCheckoutSessionId) {
      await stripe.checkout.sessions.expire(checkoutClaim.replacedCheckoutSessionId).catch(() => undefined);
    }

    const checkoutSession = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        customer: customerId,
        client_reference_id: session.user.id,
        billing_address_collection: "auto",
        line_items: [
          {
            price: offer.checkoutPriceId,
            quantity: 1,
          },
        ],
        discounts: offer.checkoutCouponId ? [{ coupon: offer.checkoutCouponId }] : undefined,
        success_url: `${origin}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/billing?checkout=cancelled`,
        metadata,
        subscription_data: {
          metadata,
        },
      },
      {
        idempotencyKey: `billing-checkout:${checkoutClaim.checkoutToken}`,
      },
    );

    if (!checkoutSession.url) {
      throw new Error("Stripe did not return a checkout URL.");
    }

    const stored = await storeBillingCheckoutSession({
      userId: session.user.id,
      checkoutToken: checkoutClaim.checkoutToken,
      stripeCheckoutSessionId: checkoutSession.id,
      checkoutUrl: checkoutSession.url,
      expiresAt:
        typeof checkoutSession.expires_at === "number"
          ? new Date(checkoutSession.expires_at * 1000).toISOString()
          : null,
    });

    if (!stored) {
      await stripe.checkout.sessions.expire(checkoutSession.id).catch(() => undefined);
      const currentCheckout = await getBillingCheckoutSession(session.user.id);
      if (currentCheckout?.checkoutUrl) {
        return NextResponse.json({
          url: currentCheckout.checkoutUrl,
        });
      }

      throw new Error("Checkout ownership changed while creating the Stripe session.");
    }

    return NextResponse.json({
      url: checkoutSession.url,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonInvalidRequest("The checkout request is invalid.");
    }

    console.error("[api/stripe/checkout]", error);
    return jsonApiError(
      500,
      "stripe_checkout_failed",
      "Could not start Stripe checkout.",
    );
  }
}
