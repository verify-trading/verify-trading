import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth/session";
import { jsonApiError, jsonInvalidRequest, jsonUnauthorized } from "@/lib/http/json-response";
import { syncCheckoutSessionById } from "@/lib/billing/repository";

const syncCheckoutSchema = z.object({
  checkoutSessionId: z.string().trim().min(1),
});

export async function POST(request: Request) {
  try {
    const session = await getSessionUser();

    if (!session) {
      return jsonUnauthorized("Sign in to sync billing.");
    }

    const payload = syncCheckoutSchema.parse(await request.json());
    const result = await syncCheckoutSessionById(payload.checkoutSessionId, session.user.id);

    return NextResponse.json({
      ok: true,
      tier: result.tier,
      status: result.status,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonInvalidRequest("The checkout sync payload is invalid.");
    }

    console.error("[api/stripe/sync-checkout]", error);
    return jsonApiError(
      500,
      "stripe_sync_failed",
      "Could not sync the Stripe checkout session.",
    );
  }
}
