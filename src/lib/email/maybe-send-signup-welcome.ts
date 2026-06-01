import type { OAuthFlow } from "@/lib/auth/oauth-flow";
import { isEmailConfigured } from "@/lib/email/config";
import { logEmailError } from "@/lib/email/log-email-error";
import { sendSignupWelcomeEmail } from "@/lib/email/send-signup-welcome";
import { isEligibleForSignupWelcomeEmail } from "@/lib/email/signup-eligibility";
import { subscribeSignupToKit } from "@/lib/marketing/kit";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type MaybeSendSignupWelcomeEmailInput = {
  userId: string;
  email?: string | null;
  displayName?: string | null;
  oauthFlow?: OAuthFlow | null;
  createdAt?: string | null;
  emailConfirmedAt?: string | null;
  appOrigin: string;
};

type ProfileWelcomeRow = {
  signup_welcome_email_sent_at: string | null;
  display_name: string | null;
};

export async function maybeSendSignupWelcomeEmail({
  userId,
  email,
  displayName,
  oauthFlow,
  createdAt,
  emailConfirmedAt,
  appOrigin,
}: MaybeSendSignupWelcomeEmailInput): Promise<void> {
  const normalizedEmail = email?.trim();
  if (!normalizedEmail) {
    return;
  }

  if (
    !isEligibleForSignupWelcomeEmail({
      oauthFlow,
      createdAt,
      emailConfirmedAt,
    })
  ) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("signup_welcome_email_sent_at, display_name")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    logEmailError("Could not load profile for signup welcome email.", { userId }, error);
    return;
  }

  const profile = data as ProfileWelcomeRow | null;
  await subscribeSignupToKit({
    email: normalizedEmail,
    displayName: displayName ?? profile?.display_name ?? null,
    referrer: appOrigin,
  }).catch((kitError) => {
    logEmailError("Failed to subscribe signup to Kit.", { userId }, kitError);
  });

  if (profile?.signup_welcome_email_sent_at) {
    return;
  }

  if (!isEmailConfigured()) {
    return;
  }

  const claimedAt = new Date().toISOString();
  const { data: claimedProfile, error: claimError } = await supabase
    .from("profiles")
    .update({ signup_welcome_email_sent_at: claimedAt })
    .eq("id", userId)
    .is("signup_welcome_email_sent_at", null)
    .select("signup_welcome_email_sent_at")
    .maybeSingle();

  if (claimError) {
    logEmailError("Failed to claim signup welcome email send.", { userId }, claimError);
    return;
  }

  if (!claimedProfile) {
    return;
  }

  try {
    await sendSignupWelcomeEmail({
      email: normalizedEmail,
      displayName: displayName ?? profile?.display_name ?? null,
      appOrigin,
    });
  } catch (sendError) {
    logEmailError("Failed to send signup welcome email.", { userId }, sendError);
    const { error: releaseError } = await supabase
      .from("profiles")
      .update({ signup_welcome_email_sent_at: null })
      .eq("id", userId)
      .eq("signup_welcome_email_sent_at", claimedAt);

    if (releaseError) {
      logEmailError("Failed to release signup welcome email claim.", { userId }, releaseError);
    }
    return;
  }
}
