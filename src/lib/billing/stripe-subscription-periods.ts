import type Stripe from "stripe";

/** Stripe API versions used by SDK v22+ expose period bounds on subscription items, not the subscription root. */
type LegacySubscription = Stripe.Subscription & {
  current_period_start?: number | null;
  current_period_end?: number | null;
};

export function readSubscriptionPeriodStartUnix(subscription: Stripe.Subscription): number | null {
  const fromItem = subscription.items?.data?.[0]?.current_period_start;
  if (typeof fromItem === "number") {
    return fromItem;
  }

  const legacy = (subscription as LegacySubscription).current_period_start;
  return typeof legacy === "number" ? legacy : null;
}

export function readSubscriptionPeriodEndUnix(subscription: Stripe.Subscription): number | null {
  const fromItem = subscription.items?.data?.[0]?.current_period_end;
  if (typeof fromItem === "number") {
    return fromItem;
  }

  const legacy = (subscription as LegacySubscription).current_period_end;
  return typeof legacy === "number" ? legacy : null;
}
