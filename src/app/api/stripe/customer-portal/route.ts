import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth/session";
import { jsonApiError, jsonInvalidRequest, jsonUnauthorized } from "@/lib/http/json-response";
import { getStripePortalConfigurationId } from "@/lib/billing/config";
import { getStripeServerClient } from "@/lib/billing/stripe-server";
import { MANAGEABLE_SUBSCRIPTION_STATUSES } from "@/lib/billing/subscription-status";

type ProfileRow = {
  stripe_customer_id: string | null;
};

type BillingSubscriptionRow = {
  stripe_subscription_id: string | null;
};

const customerPortalRequestSchema = z.object({
  flow: z.enum(["subscription_update"]).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSessionUser();

    if (!session) {
      return jsonUnauthorized("Sign in to manage billing.");
    }

    const payload = customerPortalRequestSchema.parse(await request.json().catch(() => ({})));
    const { data, error } = await session.supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", session.user.id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    const profile = (data as ProfileRow | null) ?? null;
    if (!profile?.stripe_customer_id) {
      return jsonApiError(
        400,
        "missing_customer",
        "No Stripe customer exists for this account yet.",
      );
    }

    const stripe = getStripeServerClient();
    const origin = new URL(request.url).origin;
    const returnUrl = `${origin}/billing`;
    let flowData:
      | {
          type: "subscription_update";
          after_completion: {
            type: "redirect";
            redirect: {
              return_url: string;
            };
          };
          subscription_update: {
            subscription: string;
          };
        }
      | undefined;

    if (payload.flow === "subscription_update") {
      const { data: subscriptionData, error: subscriptionError } = await session.supabase
        .from("billing_subscriptions")
        .select("stripe_subscription_id")
        .eq("user_id", session.user.id)
        .in("status", [...MANAGEABLE_SUBSCRIPTION_STATUSES])
        .order("current_period_end", { ascending: false, nullsFirst: false })
        .order("updated_at", { ascending: false })
        .limit(1);

      if (subscriptionError) {
        throw new Error(subscriptionError.message);
      }

      const subscription = ((subscriptionData as BillingSubscriptionRow[] | null) ?? [])[0] ?? null;
      if (!subscription?.stripe_subscription_id) {
        return jsonApiError(
          404,
          "missing_subscription",
          "No Stripe subscription was found to update for this account.",
        );
      }

      flowData = {
        type: "subscription_update",
        after_completion: {
          type: "redirect",
          redirect: {
            return_url: returnUrl,
          },
        },
        subscription_update: {
          subscription: subscription.stripe_subscription_id,
        },
      };
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: returnUrl,
      configuration: getStripePortalConfigurationId() ?? undefined,
      flow_data: flowData,
    });

    return NextResponse.json({
      url: portalSession.url,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonInvalidRequest("The billing portal request is invalid.");
    }

    console.error("[api/stripe/customer-portal]", error);
    return jsonApiError(
      500,
      "stripe_portal_failed",
      "Could not open the Stripe billing portal.",
    );
  }
}
