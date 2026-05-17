import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth/session";
import { ensureStripeCustomerForUser } from "@/lib/billing/repository";
import { jsonApiError, jsonInvalidRequest, jsonUnauthorized } from "@/lib/http/json-response";

const linkRequestSchema = z.object({
  referralId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const session = await getSessionUser();

    if (!session) {
      return jsonUnauthorized("Sign in to link your referral.");
    }

    const payload = linkRequestSchema.parse(await request.json().catch(() => ({})));

    const customerId = await ensureStripeCustomerForUser({
      userId: session.user.id,
      email: session.user.email,
      displayName: null,
      referralId: payload.referralId,
    });

    return NextResponse.json({
      ok: true,
      stripeCustomerId: customerId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonInvalidRequest("The referral request is invalid.");
    }

    console.error("[api/affiliates/link-stripe-customer]", error);
    return jsonApiError(
      500,
      "link_stripe_customer_failed",
      "Could not link the referral to a Stripe customer.",
    );
  }
}
