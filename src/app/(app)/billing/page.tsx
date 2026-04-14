import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BillingPageView } from "@/components/billing/billing-page-view";
import { getSessionUser } from "@/lib/auth/session";
import {
  canManageSubscription,
  MANAGEABLE_SUBSCRIPTION_STATUSES,
} from "@/lib/billing/subscription-status";
import { loadAskUsageState } from "@/lib/rate-limit/load-ask-usage";
import type { FreeAskUsageSummary } from "@/lib/rate-limit/usage";

export const metadata: Metadata = {
  title: "Billing",
  description: "Manage your verify.trading subscription and Stripe billing status.",
};

type BillingPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

type ProfileRow = {
  display_name: string | null;
  tier: string | null;
};

type BillingSubscriptionRow = {
  status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  cancel_at: string | null;
  currency: string | null;
  unit_amount: number | null;
  interval: string | null;
  interval_count: number | null;
};

function readSearchParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | null {
  const value = params[key];
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function formatBillingDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
  }).format(date);
}

function formatRecurringAmount(subscription: BillingSubscriptionRow | null): string | null {
  if (!subscription?.currency || typeof subscription.unit_amount !== "number" || !subscription.interval) {
    return null;
  }

  const amount = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: subscription.currency.toUpperCase(),
  }).format(subscription.unit_amount / 100);

  if ((subscription.interval_count ?? 1) > 1) {
    return `${amount} every ${subscription.interval_count} ${subscription.interval}s`;
  }

  return `${amount}/${subscription.interval}`;
}

function isSubscriptionScheduledToCancel(subscription: BillingSubscriptionRow | null): boolean {
  if (!subscription) {
    return false;
  }

  if (subscription.cancel_at_period_end) {
    return true;
  }

  if (!subscription.cancel_at) {
    return false;
  }

  const cancelAt = new Date(subscription.cancel_at);
  if (Number.isNaN(cancelAt.valueOf())) {
    return false;
  }

  return cancelAt.getTime() > Date.now();
}

function getCurrentPlanLabel(
  profile: ProfileRow | null,
  subscription: BillingSubscriptionRow | null,
): string {
  if (profile?.tier !== "pro") {
    return "Free";
  }

  if (subscription?.interval === "year") {
    return "Pro Annual";
  }

  if (subscription?.interval === "month") {
    return "Pro Monthly";
  }

  return "Pro";
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams?: BillingPageSearchParams;
}) {
  const session = await getSessionUser();

  if (!session) {
    redirect(`/login?next=${encodeURIComponent("/billing")}`);
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const checkoutState = readSearchParam(resolvedSearchParams, "checkout");
  const checkoutSessionId = readSearchParam(resolvedSearchParams, "session_id");

  const [profileResult, subscriptionResult] = await Promise.all([
    session.supabase.from("profiles").select("display_name, tier").eq("id", session.user.id).maybeSingle(),
    session.supabase
      .from("billing_subscriptions")
      .select("status, current_period_end, cancel_at_period_end, cancel_at, currency, unit_amount, interval, interval_count")
      .eq("user_id", session.user.id)
      .in("status", [...MANAGEABLE_SUBSCRIPTION_STATUSES])
      .order("current_period_end", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false })
      .limit(1),
  ]);

  if (profileResult.error) {
    throw new Error(profileResult.error.message);
  }

  if (subscriptionResult.error) {
    throw new Error(subscriptionResult.error.message);
  }

  const profile = (profileResult.data as ProfileRow | null) ?? null;
  const subscription = ((subscriptionResult.data as BillingSubscriptionRow[] | null) ?? [])[0] ?? null;
  const canOpenPortal = canManageSubscription(subscription?.status);

  let freeAskUsage: FreeAskUsageSummary | null = null;
  if (!canOpenPortal && profile?.tier !== "pro") {
    const usageState = await loadAskUsageState(session.supabase, session.user.id);
    freeAskUsage = usageState.usage;
  }
  const isCanceling = isSubscriptionScheduledToCancel(subscription);
  const renewalDate = formatBillingDate(subscription?.current_period_end ?? null);
  const recurringAmount = formatRecurringAmount(subscription);
  const customerName =
    profile?.display_name?.trim() || session.user.email?.split("@")[0] || "there";
  const currentPlanLabel = getCurrentPlanLabel(profile, subscription);

  return (
    <BillingPageView
      subscription={subscription}
      customerName={customerName}
      currentPlanLabel={currentPlanLabel}
      canOpenPortal={canOpenPortal}
      isCanceling={isCanceling}
      renewalDate={renewalDate}
      recurringAmount={recurringAmount}
      freeAskUsage={freeAskUsage}
      checkoutState={checkoutState}
      checkoutSessionId={checkoutSessionId}
    />
  );
}
