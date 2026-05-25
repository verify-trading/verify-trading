import { NextResponse } from "next/server";

import { readUserDisplayName } from "@/lib/auth/read-user-display-name";
import { getSessionUser } from "@/lib/auth/session";
import { maybeSendSignupWelcomeEmail } from "@/lib/email/maybe-send-signup-welcome";
import { jsonUnauthorized } from "@/lib/http/json-response";

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
