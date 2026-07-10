import { NextResponse } from "next/server";

import { readUserDisplayName } from "@/lib/auth/read-user-display-name";
import { maybeSendSignupWelcomeEmail } from "@/lib/email/maybe-send-signup-welcome";
import { jsonApiError, jsonInvalidRequest, jsonUnauthorized } from "@/lib/http/json-response";
import { logger } from "@/lib/observability/logger";
import { getSiteUrl } from "@/lib/site-config";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Supabase Database Webhook target (see supabase/migration_22_welcome_email_on_confirm.sql).
 *
 * Fires the moment `auth.users.email_confirmed_at` transitions NULL -> NOT NULL.
 * This is the reliable, event-driven trigger for the signup welcome email: it
 * does NOT depend on the browser completing the /auth/callback PKCE exchange,
 * which silently dropped ~8% of welcomes (confirmation opened on a different
 * device, expired/reused link, etc.).
 *
 * Google / OAuth users are confirmed at row INSERT (no NULL -> NOT NULL update),
 * so the trigger does not fire for them; they keep the /auth/callback path.
 *
 * Auth: shared secret in the `Authorization: Bearer` header, mirroring the
 * markets cron. The send itself remains idempotent via the
 * `profiles.signup_welcome_email_sent_at` claim, so duplicate webhook deliveries
 * (pg_net can retry) never send twice.
 */
export async function POST(request: Request) {
  const secret = process.env.WELCOME_EMAIL_HOOK_SECRET;
  if (!secret) {
    logger.error("email-confirmed hook: WELCOME_EMAIL_HOOK_SECRET not configured");
    return jsonApiError(500, "not_configured", "Welcome email hook secret is not configured.");
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    logger.warn("email-confirmed hook: unauthorized request");
    return jsonUnauthorized("Invalid webhook secret.");
  }

  let userId: string | undefined;
  try {
    const body = (await request.json()) as {
      userId?: string;
      record?: { id?: string };
    };
    // Accept our explicit body ({ userId }); also tolerate a raw Supabase webhook
    // payload ({ record: { id } }) in case the trigger is reconfigured.
    userId = body?.userId ?? body?.record?.id ?? undefined;
  } catch {
    // handled by the missing-userId guard below
  }

  if (!userId) {
    return jsonInvalidRequest("Missing userId.");
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    logger.error("email-confirmed hook: admin client unavailable");
    return jsonApiError(500, "not_configured", "Supabase admin client is unavailable.");
  }

  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data?.user) {
    // 200 so pg_net does not retry a permanently-missing user.
    logger.warn("email-confirmed hook: user not found", { userId });
    return NextResponse.json({ ok: true, skipped: "user-not-found" });
  }

  const user = data.user;
  if (!user.email_confirmed_at) {
    return NextResponse.json({ ok: true, skipped: "not-confirmed" });
  }

  await maybeSendSignupWelcomeEmail({
    userId: user.id,
    email: user.email,
    displayName: readUserDisplayName(user.user_metadata),
    createdAt: user.created_at,
    emailConfirmedAt: user.email_confirmed_at,
    appOrigin: getSiteUrl(),
    trustedConfirmation: true,
  }).catch((sendError) => {
    logger.warn("email-confirmed hook: welcome send failed", {
      userId,
      error: sendError instanceof Error ? sendError.message : String(sendError),
    });
  });

  return NextResponse.json({ ok: true });
}
