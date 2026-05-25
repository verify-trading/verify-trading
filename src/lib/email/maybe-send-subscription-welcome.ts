import {
  formatBillingPlanLabel,
  readBillingPlanKeyFromStripeInterval,
  type BillingPlanKey,
} from "@/lib/billing/config";
import { isEmailConfigured } from "@/lib/email/config";
import { logEmailError } from "@/lib/email/log-email-error";
import { sendSubscriptionWelcomeEmail } from "@/lib/email/send-subscription-welcome";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type MaybeSendSubscriptionWelcomeEmailInput = {
  userId: string;
  stripeSubscriptionId: string;
  interval?: string | null;
  appOrigin: string;
};

type BillingWelcomeRow = {
  welcome_email_sent_at: string | null;
};

type ProfileNameRow = {
  display_name: string | null;
};

export async function maybeSendSubscriptionWelcomeEmail({
  userId,
  stripeSubscriptionId,
  interval,
  appOrigin,
}: MaybeSendSubscriptionWelcomeEmailInput): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return;
  }

  const { data: subscriptionData, error: subscriptionError } = await supabase
    .from("billing_subscriptions")
    .select("welcome_email_sent_at")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle();

  if (subscriptionError) {
    logEmailError(
      "Could not load subscription for welcome email.",
      { stripeSubscriptionId },
      subscriptionError,
    );
    return;
  }

  const subscription = subscriptionData as BillingWelcomeRow | null;
  if (!subscription) {
    return;
  }

  if (subscription?.welcome_email_sent_at) {
    return;
  }

  const planKey: BillingPlanKey = readBillingPlanKeyFromStripeInterval(interval) ?? "monthly";

  const [{ data: profileData, error: profileError }, authUserResult] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    supabase.auth.admin.getUserById(userId),
  ]);

  if (profileError) {
    logEmailError("Could not load profile for subscription welcome email.", { userId }, profileError);
    return;
  }

  if (authUserResult.error) {
    logEmailError(
      "Could not load auth user for subscription welcome email.",
      { userId },
      authUserResult.error,
    );
    return;
  }

  const email = authUserResult.data.user?.email?.trim();
  if (!email) {
    return;
  }

  const profile = profileData as ProfileNameRow | null;
  if (!isEmailConfigured()) {
    return;
  }

  const claimedAt = new Date().toISOString();
  const { data: claimedSubscription, error: claimError } = await supabase
    .from("billing_subscriptions")
    .update({ welcome_email_sent_at: claimedAt })
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .is("welcome_email_sent_at", null)
    .select("welcome_email_sent_at")
    .maybeSingle();

  if (claimError) {
    logEmailError(
      "Failed to claim subscription welcome email send.",
      { stripeSubscriptionId },
      claimError,
    );
    return;
  }

  if (!claimedSubscription) {
    return;
  }

  try {
    await sendSubscriptionWelcomeEmail({
      email,
      displayName: profile?.display_name ?? null,
      planKey,
      appOrigin,
    });
  } catch (sendError) {
    logEmailError(
      "Failed to send subscription welcome email.",
      { userId, stripeSubscriptionId, plan: formatBillingPlanLabel(planKey) },
      sendError,
    );
    const { error: releaseError } = await supabase
      .from("billing_subscriptions")
      .update({ welcome_email_sent_at: null })
      .eq("stripe_subscription_id", stripeSubscriptionId)
      .eq("welcome_email_sent_at", claimedAt);

    if (releaseError) {
      logEmailError(
        "Failed to release subscription welcome email claim.",
        { stripeSubscriptionId },
        releaseError,
      );
    }
    return;
  }
}
