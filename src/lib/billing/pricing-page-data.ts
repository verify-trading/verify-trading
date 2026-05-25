import { getSessionUser } from "@/lib/auth/session";
import {
  getPublicBillingPricing,
  readBillingPlanKeyFromStripeInterval,
  type BillingPlanKey,
} from "@/lib/billing/config";
import { MANAGEABLE_SUBSCRIPTION_STATUSES } from "@/lib/billing/subscription-status";

export type PricingPageBillingContext = {
  isSignedIn: boolean;
  hasManageableSubscription: boolean;
  currentPlanKey: BillingPlanKey | null;
};

type PricingSubscriptionRow = {
  interval: string | null;
};

export async function getPricingPageData() {
  const pricing = getPublicBillingPricing();
  const session = await getSessionUser();

  if (!session) {
    return {
      pricing,
      billingContext: {
        isSignedIn: false,
        hasManageableSubscription: false,
        currentPlanKey: null,
      } satisfies PricingPageBillingContext,
    };
  }

  const subscriptionResult = await session.supabase
    .from("billing_subscriptions")
    .select("interval")
    .eq("user_id", session.user.id)
    .in("status", [...MANAGEABLE_SUBSCRIPTION_STATUSES])
    .order("current_period_end", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(1);

  if (subscriptionResult.error) {
    throw new Error(subscriptionResult.error.message);
  }

  const subscription = ((subscriptionResult.data as PricingSubscriptionRow[] | null) ?? [])[0] ?? null;

  return {
    pricing,
    billingContext: {
      isSignedIn: true,
      hasManageableSubscription: Boolean(subscription),
      currentPlanKey: readBillingPlanKeyFromStripeInterval(subscription?.interval ?? null),
    } satisfies PricingPageBillingContext,
  };
}
