import type Stripe from "stripe";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth/session";
import {
  getBillingPlanAmountGbp,
  getCheckoutBillingOffer,
} from "@/lib/billing/config";
import {
  getBillingPromoOffer,
  PROMO_OFFER_COOKIE_NAME,
  TUBMAN_OFFER_KEY,
} from "@/lib/billing/promo-offers";
import {
  claimBillingCheckoutSession,
  ensureStripeCustomerForUser,
  getBillingCheckoutSession,
  storeBillingCheckoutSession,
  stripeErrorMeta,
} from "@/lib/billing/repository";
import { getStripeServerClient } from "@/lib/billing/stripe-server";
import { MANAGEABLE_SUBSCRIPTION_STATUSES } from "@/lib/billing/subscription-status";
import {
  jsonApiError,
  jsonInvalidRequest,
  jsonUnauthorized,
} from "@/lib/http/json-response";
import { logger } from "@/lib/observability/logger";

type ProfileRow = {
  display_name: string | null;
};

const TRIAL_PERIOD_DAYS = 7;

const checkoutRequestSchema = z.object({
  plan: z.enum(["weekly", "monthly", "annual"]).default("monthly"),
  rewardfulReferral: z.string().optional(),
  source: z.enum(["web", "mobile"]).default("web"),
  /** Existing promo links start with a free week. */
  trial: z.boolean().default(false),
  /** Tubman referral offer starts Pro Monthly with 14 days free. */
  offer: z.literal(TUBMAN_OFFER_KEY).optional(),
});

/**
 * One trial per customer: someone who cancels and clicks a promotional
 * link again must not receive another free trial.
 *
 * `incomplete` and `incomplete_expired` do not count. These represent
 * checkout attempts where the initial subscription never properly began.
 */
const NEVER_STARTED: Stripe.Subscription.Status[] = [
  "incomplete",
  "incomplete_expired",
];

async function isTrialEligible(
  stripe: Stripe,
  customerId: string,
): Promise<boolean> {
  for await (const subscription of stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
  })) {
    if (!NEVER_STARTED.includes(subscription.status)) {
      return false;
    }
  }

  return true;
}

function checkoutReturnUrls(
  origin: string,
  source: "web" | "mobile",
) {
  if (source === "mobile") {
    return {
      successUrl:
        "verifytrading://billing/checkout?checkout=success&session_id={CHECKOUT_SESSION_ID}",
      cancelUrl:
        "verifytrading://billing/checkout?checkout=cancelled",
    };
  }

  return {
    successUrl:
      `${origin}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${origin}/billing?checkout=cancelled`,
  };
}

export async function POST(request: Request) {
  const context: Record<string, unknown> = {};

  try {
    const session = await getSessionUser();

    if (!session) {
      return jsonUnauthorized("Sign in to start checkout.");
    }

    context.userId = session.user.id;

    const payload = checkoutRequestSchema.parse(
      await request.json().catch(() => ({})),
    );

    context.plan = payload.plan;
    context.trial = payload.trial;
    context.offer = payload.offer;
    context.source = payload.source;

    const promoOffer = getBillingPromoOffer(
      payload.offer ?? null,
    );

    if (promoOffer) {
      const cookieStore = await cookies();

      if (
        cookieStore.get(PROMO_OFFER_COOKIE_NAME)?.value !==
        promoOffer.key
      ) {
        return jsonApiError(
          403,
          "promo_offer_not_verified",
          "Open the original referral link again to activate this offer.",
        );
      }

      if (payload.plan !== promoOffer.plan) {
        return jsonInvalidRequest(
          "This promotional offer is available for Pro Monthly only.",
        );
      }
    }

    const requestedTrial =
      payload.trial || Boolean(promoOffer);

    const [subscriptionResult, profileResult] =
      await Promise.all([
        session.supabase
          .from("billing_subscriptions")
          .select("stripe_subscription_id")
          .eq("user_id", session.user.id)
          .in("status", [
            ...MANAGEABLE_SUBSCRIPTION_STATUSES,
          ])
          .order("current_period_end", {
            ascending: false,
            nullsFirst: false,
          })
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

    const activeSubscriptions =
      (
        subscriptionResult.data as {
          stripe_subscription_id: string;
        }[] | null
      ) ?? [];

    if (activeSubscriptions.length > 0) {
      return jsonApiError(
        409,
        "subscription_exists",
        "You already have a subscription. Open the billing portal to manage it.",
      );
    }

    const checkoutClaim =
      await claimBillingCheckoutSession({
        userId: session.user.id,
        plan: payload.plan,
      });

    if (
      checkoutClaim.checkoutUrl &&
      payload.source === "web" &&
      !requestedTrial
    ) {
      const reusedOffer = getCheckoutBillingOffer(
        payload.plan,
      );

      return NextResponse.json({
        url: checkoutClaim.checkoutUrl,
        checkout: {
          plan: reusedOffer.planKey,
          currency: "GBP",
          value: getBillingPlanAmountGbp(
            reusedOffer.planKey,
          ),
        },
      });
    }

    const offer = getCheckoutBillingOffer(payload.plan);

    const customerId = await ensureStripeCustomerForUser({
      userId: session.user.id,
      email: session.user.email,
      displayName:
        (profileResult.data as ProfileRow | null)
          ?.display_name ?? null,
    });

    context.stripeCustomerId = customerId;
    context.checkoutToken = checkoutClaim.checkoutToken;

    const stripe = getStripeServerClient();

    const trialEligible = requestedTrial
      ? await isTrialEligible(stripe, customerId)
      : false;

    if (promoOffer && !trialEligible) {
      return jsonApiError(
        409,
        "promo_trial_already_used",
        "This Stripe customer has already used a free trial. Choose a standard subscription instead.",
      );
    }

    const trialPeriodDays = trialEligible
      ? (
          promoOffer?.trialPeriodDays ??
          TRIAL_PERIOD_DAYS
        )
      : null;

    const origin = new URL(request.url).origin;
    const returnUrls = checkoutReturnUrls(
      origin,
      payload.source,
    );

    const metadata = {
      supabaseUserId: session.user.id,
      planKey: "pro",
      billingPlan: offer.planKey,
      ...(payload.rewardfulReferral && {
        rewardful_referral:
          payload.rewardfulReferral,
      }),
      ...(promoOffer && {
        promotionOffer: promoOffer.key,
        promotionTrialDays: String(
          promoOffer.trialPeriodDays,
        ),
      }),
    };

    const staleCheckoutSessionId =
      checkoutClaim.replacedCheckoutSessionId ??
      (
        payload.source === "mobile" ||
        requestedTrial
          ? checkoutClaim.stripeCheckoutSessionId
          : null
      );

    if (staleCheckoutSessionId) {
      await stripe.checkout.sessions
        .expire(staleCheckoutSessionId)
        .catch((error: unknown) =>
          logger.warn(
            "Stale checkout session left live; expiry failed.",
            {
              ...context,
              staleCheckoutSessionId,
              ...stripeErrorMeta(error),
            },
          ),
        );
    }

    const checkoutSession =
      await stripe.checkout.sessions.create(
        {
          mode: "subscription",
          customer: customerId,
          client_reference_id:
            payload.rewardfulReferral ||
            session.user.id,
          billing_address_collection: "auto",
          payment_method_collection: "always",
          allow_promotion_codes: true,
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
            ...(trialPeriodDays && {
              trial_period_days: trialPeriodDays,
            }),
          },
        },
        {
          idempotencyKey:
            `billing-checkout:${checkoutClaim.checkoutToken}` +
            (
              promoOffer
                ? `:offer:${promoOffer.key}`
                : payload.trial
                  ? ":trial"
                  : ""
            ) +
            (
              staleCheckoutSessionId
                ? `:${staleCheckoutSessionId}`
                : ""
            ),
        },
      );

    if (!checkoutSession.url) {
      throw new Error(
        "Stripe did not return a checkout URL.",
      );
    }

    const stored = await storeBillingCheckoutSession({
      userId: session.user.id,
      checkoutToken: checkoutClaim.checkoutToken,
      stripeCheckoutSessionId: checkoutSession.id,
      checkoutUrl: trialPeriodDays
        ? null
        : checkoutSession.url,
      expiresAt:
        typeof checkoutSession.expires_at === "number"
          ? new Date(
              checkoutSession.expires_at * 1000,
            ).toISOString()
          : null,
    });

    if (!stored) {
      await stripe.checkout.sessions
        .expire(checkoutSession.id)
        .catch(() => undefined);

      const currentCheckout =
        await getBillingCheckoutSession(
          session.user.id,
        );

      if (currentCheckout?.checkoutUrl) {
        const currentPlan =
          currentCheckout.plan ?? offer.planKey;

        return NextResponse.json({
          url: currentCheckout.checkoutUrl,
          checkout: {
            plan: currentPlan,
            currency: "GBP",
            value:
              getBillingPlanAmountGbp(currentPlan),
          },
        });
      }

      throw new Error(
        "Checkout ownership changed while creating the Stripe session.",
      );
    }

    return NextResponse.json({
      url: checkoutSession.url,
      checkout: {
        plan: offer.planKey,
        currency: "GBP",
        value: getBillingPlanAmountGbp(
          offer.planKey,
        ),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonInvalidRequest(
        "The checkout request is invalid.",
      );
    }

    logger.error("Stripe checkout failed.", {
      ...context,
      ...stripeErrorMeta(error),
      error:
        error instanceof Error
          ? error.message
          : String(error),
    });

    return jsonApiError(
      500,
      "stripe_checkout_failed",
      "Could not start Stripe checkout.",
    );
  }
}
