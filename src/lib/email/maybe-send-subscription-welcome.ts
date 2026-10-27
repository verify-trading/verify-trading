import { logEmailError } from "@/lib/email/log-email-error";
import { POLICY } from "@/lib/email/lifecycle/config";
import { firstNameFrom } from "@/lib/email/lifecycle/pick";
import { sendLifecycleEmail } from "@/lib/email/lifecycle/send";
import { wait } from "@/lib/http/fetch-with-retry";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type MaybeSendSubscriptionWelcomeEmailInput = {
  userId: string;
  stripeSubscriptionId: string;
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
  if (!subscription || subscription.welcome_email_sent_at) {
    return;
  }

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
  // email_sends' unique (user_id, "c5:<sub>") claim is the real dedupe; welcome_email_sent_at only
  // short-circuits subscriptions that already got a welcome (including ones from before email_sends).
  const result = await sendLifecycleEmail({
    userId,
    to: email,
    emailId: "c5",
    dedupeKey: `c5:${stripeSubscriptionId}`,
    kind: "transactional",
    variant: null,
    vars: { firstName: firstNameFrom(profile?.display_name ?? null) },
  });

  // "duplicate" now means a completed send. An active lease returns "skipped", so a failed
  // subscription stamp can be repaired without mistaking an in-flight send for a delivery.
  if (result !== "sent" && result !== "duplicate") {
    logEmailError("Failed to send subscription welcome email.", { userId, stripeSubscriptionId }, result);
    return;
  }

  const { error: stampError } = await supabase
    .from("billing_subscriptions")
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .eq("stripe_subscription_id", stripeSubscriptionId);

  if (stampError) {
    logEmailError(
      "Failed to record subscription welcome email send.",
      { stripeSubscriptionId },
      stampError,
    );
  }
}

/** Billing rows survive webhook failures, including failures before an email could be claimed. */
export async function retrySubscriptionWelcomeEmails(limit: number): Promise<number> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return 0;
  const { data, error } = await supabase.rpc("lifecycle_pending_subscription_welcomes", {
    p_since: POLICY.startDate,
    p_limit: limit,
  });
  if (error) throw error;
  const rows = (data ?? []) as Array<{ user_id: string; stripe_subscription_id: string }>;
  for (const [index, row] of rows.entries()) {
    if (index > 0) await wait(POLICY.sendGapMs);
    // A transient failure for one subscription must not prevent retries for the others.
    await maybeSendSubscriptionWelcomeEmail({
      userId: row.user_id,
      stripeSubscriptionId: row.stripe_subscription_id,
    }).catch((error) => {
      logEmailError("Subscription welcome retry failed.", { stripeSubscriptionId: row.stripe_subscription_id }, error);
    });
  }
  return rows.length;
}
