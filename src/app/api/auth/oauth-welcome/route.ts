import { NextResponse } from "next/server";

import { readUserDisplayName } from "@/lib/auth/read-user-display-name";
import { getSessionUser } from "@/lib/auth/session";
import { maybeSendSignupWelcomeEmail } from "@/lib/email/maybe-send-signup-welcome";
import { jsonUnauthorized } from "@/lib/http/json-response";

/**
 * Welcome email for native-app OAuth sign-ins (Google/Apple). Mobile OAuth never
 * hits the web /auth/callback route that fires the welcome for browser OAuth, and
 * the DB email-confirmed trigger only covers email/password signups (OAuth users
 * are confirmed at INSERT). This authenticated endpoint closes that gap: it reads
 * the caller's Supabase JWT (Bearer token) via getSessionUser and reuses the same
 * idempotent helper, so the `signup_welcome_email_sent_at` claim still prevents
 * doubles and only genuinely new users receive the email.
 */
export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session) {
    return jsonUnauthorized("Sign in to continue.");
  }

  const origin = new URL(request.url).origin;

  await maybeSendSignupWelcomeEmail({
    userId: session.user.id,
    email: session.user.email,
    displayName: readUserDisplayName(session.user.user_metadata),
    createdAt: session.user.created_at,
    emailConfirmedAt: session.user.email_confirmed_at,
    appOrigin: origin,
  }).catch(() => undefined);

  return NextResponse.json({ ok: true });
}
