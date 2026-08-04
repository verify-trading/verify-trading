import type Stripe from "stripe";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth/session";
import { jsonApiError, jsonInvalidRequest, jsonUnauthorized } from "@/lib/http/json-response";
import { getBillingPlanAmountGbp, getCheckoutBillingOffer } from "@/lib/billing/config";
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

const TRIAL_PERIOD_DAYS = 7;

const checkoutRequestSchema = z.object({
  plan: z.enum(["weekly", "monthly", "annual"]).default("monthly"),
  rewardfulReferral: z.string().optional(),
  source: z.enum(["web", "mobile"]).default("web"),
  /** Promo links (/billing?plan=weekly&trial=1) start with a free week. */
  trial: z.boolean().default(false),
});

/** One trial per customer: someone who cancels and clicks the promo link again pays from day one. */
async function isTrialEligible(stripe: Stripe, customerId: string): Promise<boolean> {
  const previous = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 1,
  });

  return previous.data.length === 0;
}

function checkoutReturnUrls(origin: string, source: "web" | "mobile") {
  if (source === "mobile") {
    return {
      successUrl: "verifytrading://billing/checkout?checkout=success&session_id={CHECKOUT_SESSION_ID}",
      cancelUrl: "verifytrading://billing/checkout?checkout=cancelled",
    };
  }

  return {
    successUrl: `${origin}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${origin}/billing?checkout=cancelled`,
  };
}

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

    if (checkoutClaim.checkoutUrl && payload.source === "web" && !payload.trial) {
      const reusedOffer = getCheckoutBillingOffer(payload.plan);
      return NextResponse.json({
        url: checkoutClaim.checkoutUrl,
        checkout: {
          plan: reusedOffer.planKey,
          currency: "GBP",
          value: getBillingPlanAmountGbp(reusedOffer.planKey),
        },
      });
    }

    const offer = getCheckoutBillingOffer(payload.plan);
    const customerId = await ensureStripeCustomerForUser({
      userId: session.user.id,
      email: session.user.email,
      displayName: (profileResult.data as ProfileRow | null)?.display_name ?? null,
    });

    const stripe = getStripeServerClient();
    const trialPeriodDays =
      payload.trial && (await isTrialEligible(stripe, customerId)) ? TRIAL_PERIOD_DAYS : null;
    const origin = new URL(request.url).origin;
    const returnUrls = checkoutReturnUrls(origin, payload.source);
    const metadata = {
      supabaseUserId: session.user.id,
      planKey: "pro",
      billingPlan: offer.planKey,
      ...(payload.rewardfulReferral && { rewardful_referral: payload.rewardfulReferral }),
    };

    const staleCheckoutSessionId =
      checkoutClaim.replacedCheckoutSessionId ??
      (payload.source === "mobile" || payload.trial ? checkoutClaim.stripeCheckoutSessionId : null);

    if (staleCheckoutSessionId) {
      await stripe.checkout.sessions.expire(staleCheckoutSessionId).catch(() => undefined);
    }

    const checkoutSession = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        customer: customerId,
        client_reference_id: payload.rewardfulReferral || session.user.id,
        billing_address_collection: "auto",

        line_items: [
          {
            price: offer.checkoutPriceId,
            quantity: 1,
          },
        ],
        success_url: returnUrls.successUrl,
        cancel_url: returnUrls.cancelUrl,
        metadata,
        subscription_data: {
          metadata,
          // Checkout still collects the card up front, then bills the plan when the trial ends.
          ...(trialPeriodDays && { trial_period_days: trialPeriodDays }),
        },
      },
      {
        // The expired session's id is part of the key: a reused claim keeps its token, so without
        // it a forced recreate replays Stripe's cached response and hands back the session we
        // just expired. A genuine duplicate request has the same stale id, so it still dedupes.
        idempotencyKey: `billing-checkout:${checkoutClaim.checkoutToken}${payload.trial ? ":trial" : ""}${
          staleCheckoutSessionId ? `:${staleCheckoutSessionId}` : ""
        }`,
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
        const currentPlan = currentCheckout.plan ?? offer.planKey;
        return NextResponse.json({
          url: currentCheckout.checkoutUrl,
          checkout: {
            plan: currentPlan,
            currency: "GBP",
            value: getBillingPlanAmountGbp(currentPlan),
          },
        });
      }

      throw new Error("Checkout ownership changed while creating the Stripe session.");
    }

    return NextResponse.json({
      url: checkoutSession.url,
      checkout: {
        plan: offer.planKey,
        currency: "GBP",
        value: getBillingPlanAmountGbp(offer.planKey),
      },
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
