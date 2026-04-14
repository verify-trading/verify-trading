import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth/session";
import { jsonApiError, jsonInvalidRequest, jsonUnauthorized } from "@/lib/http/json-response";
import { syncStripeSubscription } from "@/lib/billing/repository";
import { getStripeServerClient } from "@/lib/billing/stripe-server";
import { MANAGEABLE_SUBSCRIPTION_STATUSES } from "@/lib/billing/subscription-status";

const subscriptionActionSchema = z.object({
  action: z.enum(["cancel_at_period_end", "resume"]),
});

type BillingSubscriptionRow = {
  stripe_subscription_id: string;
  status: string | null;
  cancel_at_period_end: boolean | null;
};

export async function POST(request: Request) {
  try {
    const session = await getSessionUser();

    if (!session) {
      return jsonUnauthorized("Sign in to manage your subscription.");
    }

    const payload = subscriptionActionSchema.parse(await request.json().catch(() => null));
    const { data, error } = await session.supabase
      .from("billing_subscriptions")
      .select("stripe_subscription_id, status, cancel_at_period_end")
      .eq("user_id", session.user.id)
      .in("status", [...MANAGEABLE_SUBSCRIPTION_STATUSES])
      .order("current_period_end", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(error.message);
    }

    const subscriptionRow = ((data as BillingSubscriptionRow[] | null) ?? [])[0] ?? null;
    if (!subscriptionRow?.stripe_subscription_id) {
      return jsonApiError(
        404,
        "missing_subscription",
        "No active Stripe subscription was found for this account.",
      );
    }

    const stripe = getStripeServerClient();
    const updatedSubscription =
      payload.action === "cancel_at_period_end"
        ? await stripe.subscriptions.update(subscriptionRow.stripe_subscription_id, {
            cancel_at_period_end: true,
          })
        : await stripe.subscriptions.update(subscriptionRow.stripe_subscription_id, {
            cancel_at_period_end: false,
          });

    const syncResult = await syncStripeSubscription(updatedSubscription);

    return NextResponse.json({
      ok: true,
      status: syncResult.status,
      tier: syncResult.tier,
      message:
        payload.action === "cancel_at_period_end"
          ? "Your subscription will cancel at the end of the current billing period."
          : "Your subscription will continue renewing normally.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonInvalidRequest("The subscription action is invalid.");
    }

    console.error("[api/stripe/subscription]", error);
    return jsonApiError(
      500,
      "stripe_subscription_update_failed",
      "Could not update the Stripe subscription.",
    );
  }
}
