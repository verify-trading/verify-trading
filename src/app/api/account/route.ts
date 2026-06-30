import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripeServerClient } from "@/lib/billing/stripe-server";
import { jsonApiError, jsonUnauthorized } from "@/lib/http/json-response";
import { logger } from "@/lib/observability/logger";

// Supabase admin client + Stripe SDK need the Node runtime (not edge).
export const runtime = "nodejs";

// Tables that reference auth.users WITHOUT ON DELETE CASCADE — they would block
// auth.admin.deleteUser, so clear them first. Best-effort: a table that isn't
// present in this environment resolves with an error rather than throwing, so it
// can never abort the deletion.
async function clearNonCascadingReferences(admin: SupabaseClient, userId: string) {
  await Promise.allSettled([
    admin.from("commissions").delete().or(`referrer_id.eq.${userId},referred_id.eq.${userId}`),
    admin.from("payout_requests").delete().eq("referrer_id", userId),
    admin.from("referrals").delete().or(`referrer_id.eq.${userId},referred_id.eq.${userId}`),
    admin.from("community_messages").update({ deleted_by: null }).eq("deleted_by", userId),
  ]);
}

// Cancel billing first so a later failure can never leave an active, billing
// subscription behind. Deleting the Stripe customer cancels all its
// subscriptions in one call. Best-effort — never blocks account deletion.
async function cancelStripeForUser(admin: SupabaseClient, userId: string) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return;
  }
  try {
    const { data } = await admin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .maybeSingle();
    const customerId = (data as { stripe_customer_id: string | null } | null)?.stripe_customer_id;
    if (!customerId) {
      return;
    }
    await getStripeServerClient().customers.del(customerId);
  } catch (error) {
    logger.warn("Account deletion: could not cancel Stripe customer (continuing).", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}

/**
 * Permanently deletes the authenticated user's account (Apple Guideline 5.1.1(v)).
 * Works for both web (cookies) and mobile (Authorization: Bearer) callers via
 * getSessionUser. ON DELETE CASCADE removes the user's profile, journal,
 * psychology, chat, community, and billing rows when the auth user is deleted.
 */
export async function DELETE() {
  try {
    const session = await getSessionUser();
    if (!session) {
      return jsonUnauthorized("Sign in to delete your account.");
    }

    const admin = getSupabaseAdminClient();
    if (!admin) {
      return jsonApiError(
        503,
        "account_delete_unavailable",
        "Account deletion is temporarily unavailable. Please try again later.",
      );
    }

    const userId = session.user.id;

    await cancelStripeForUser(admin, userId);
    await clearNonCascadingReferences(admin, userId);

    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      logger.error("Account deletion failed at auth.admin.deleteUser.", { error: error.message });
      return jsonApiError(
        500,
        "account_delete_failed",
        "Could not delete your account right now. Please try again.",
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("Account deletion request failed.", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return jsonApiError(
      500,
      "account_delete_failed",
      "Could not delete your account right now. Please try again.",
    );
  }
}
