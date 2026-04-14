import type Stripe from "stripe";

import type { BillingPlanKey } from "@/lib/billing/config";
import {
  readSubscriptionPeriodEndUnix,
  readSubscriptionPeriodStartUnix,
} from "@/lib/billing/stripe-subscription-periods";
import {
  billingStatusGrantsProAccess,
  PRO_ACCESS_SUBSCRIPTION_STATUSES,
} from "@/lib/billing/subscription-status";
import { getStripeServerClient } from "@/lib/billing/stripe-server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type BillingProfileRow = {
  id: string;
  display_name: string | null;
  stripe_customer_id: string | null;
};

type StripeWebhookEventRow = {
  processed_at: string | null;
};

type BillingSubscriptionStatusRow = {
  status: string | null;
};

type BillingCheckoutClaimRow = {
  checkout_token: string;
  stripe_checkout_session_id: string | null;
  checkout_url: string | null;
  expires_at: string | null;
  reused: boolean;
  replaced_checkout_session_id: string | null;
};

type BillingCheckoutSessionRow = {
  checkout_token: string;
  stripe_checkout_session_id: string | null;
  checkout_url: string | null;
  expires_at: string | null;
  completed_at: string | null;
  plan: BillingPlanKey;
};

function requireSupabaseAdminClient() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new Error("Missing Supabase admin configuration.");
  }
  return supabase;
}

function unixSecondsToIso(value: number | null | undefined): string | null {
  if (typeof value !== "number") {
    return null;
  }

  return new Date(value * 1000).toISOString();
}

function readStripeCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): string | null {
  if (!customer) {
    return null;
  }

  return typeof customer === "string" ? customer : customer.id;
}

async function getBillingProfile(userId: string): Promise<BillingProfileRow | null> {
  const supabase = requireSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, stripe_customer_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as BillingProfileRow | null) ?? null;
}

async function updateProfileBillingFields(
  userId: string,
  patch: {
    stripe_customer_id?: string | null;
    tier?: "free" | "pro";
  },
) {
  const supabase = requireSupabaseAdminClient();
  const { error } = await supabase.from("profiles").update(patch).eq("id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

async function lookupUserIdByStripeCustomerId(customerId: string): Promise<string | null> {
  const supabase = requireSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return typeof data?.id === "string" ? data.id : null;
}

async function refreshProfileBillingState(userId: string, stripeCustomerId: string) {
  const supabase = requireSupabaseAdminClient();
  const { data, error } = await supabase
    .from("billing_subscriptions")
    .select("status")
    .eq("user_id", userId)
    .in("status", [...PRO_ACCESS_SUBSCRIPTION_STATUSES]);

  if (error) {
    throw new Error(error.message);
  }

  const tier = ((data as BillingSubscriptionStatusRow[] | null) ?? []).some((row) =>
    billingStatusGrantsProAccess(row.status),
  )
    ? "pro"
    : "free";

  await updateProfileBillingFields(userId, {
    stripe_customer_id: stripeCustomerId,
    tier,
  });

  return tier;
}

export async function ensureStripeCustomerForUser({
  userId,
  email,
  displayName,
}: {
  userId: string;
  email: string | null | undefined;
  displayName: string | null | undefined;
}): Promise<string> {
  const stripe = getStripeServerClient();
  const profile = await getBillingProfile(userId);

  if (!profile) {
    throw new Error("Could not load the billing profile for this user.");
  }

  const name = displayName?.trim() || profile.display_name?.trim() || undefined;
  const normalizedEmail = email?.trim() || undefined;
  const existingCustomerId = profile.stripe_customer_id?.trim();

  if (existingCustomerId) {
    await stripe.customers.update(existingCustomerId, {
      email: normalizedEmail,
      name,
      metadata: {
        supabaseUserId: userId,
      },
    });

    return existingCustomerId;
  }

  const customer = await stripe.customers.create({
    email: normalizedEmail,
    name,
    metadata: {
      supabaseUserId: userId,
    },
  });

  await updateProfileBillingFields(userId, {
    stripe_customer_id: customer.id,
  });

  return customer.id;
}

export async function syncStripeSubscription(subscription: Stripe.Subscription) {
  const supabase = requireSupabaseAdminClient();
  const customerId = readStripeCustomerId(subscription.customer);

  if (!customerId) {
    throw new Error("Stripe subscription is missing a customer id.");
  }

  const metadataUserId = subscription.metadata.supabaseUserId?.trim();
  const userId = metadataUserId || (await lookupUserIdByStripeCustomerId(customerId));

  if (!userId) {
    throw new Error("Could not map the Stripe subscription to a Supabase user.");
  }

  const price = subscription.items.data[0]?.price ?? null;
  const productId =
    typeof price?.product === "string" ? price.product : price?.product?.id ?? null;

  const { error } = await supabase.from("billing_subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: price?.id ?? null,
      stripe_product_id: productId,
      status: subscription.status,
      current_period_start: unixSecondsToIso(
        readSubscriptionPeriodStartUnix(subscription) ?? subscription.billing_cycle_anchor,
      ),
      current_period_end: unixSecondsToIso(
        readSubscriptionPeriodEndUnix(subscription) ?? subscription.trial_end,
      ),
      cancel_at_period_end: subscription.cancel_at_period_end,
      cancel_at: unixSecondsToIso(subscription.cancel_at),
      canceled_at: unixSecondsToIso(subscription.canceled_at),
      ended_at: unixSecondsToIso(subscription.ended_at),
      currency: price?.currency ?? subscription.currency ?? null,
      unit_amount: price?.unit_amount ?? null,
      interval: price?.recurring?.interval ?? null,
      interval_count: price?.recurring?.interval_count ?? null,
      metadata: subscription.metadata ?? {},
    },
    { onConflict: "stripe_subscription_id" },
  );

  if (error) {
    throw new Error(error.message);
  }

  const tier = await refreshProfileBillingState(userId, customerId);

  return {
    userId,
    customerId,
    status: subscription.status,
    tier,
  };
}

export async function syncCheckoutSessionById(checkoutSessionId: string, expectedUserId?: string) {
  const stripe = getStripeServerClient();
  const session = await stripe.checkout.sessions.retrieve(checkoutSessionId, {
    expand: ["subscription"],
  });

  if (session.mode !== "subscription") {
    throw new Error("Checkout session is not a subscription session.");
  }

  const customerId = readStripeCustomerId(session.customer);
  if (!customerId) {
    throw new Error("Checkout session is missing a customer id.");
  }

  const metadataUserId = session.metadata?.supabaseUserId?.trim() || null;
  const userId = metadataUserId || expectedUserId || (await lookupUserIdByStripeCustomerId(customerId));

  if (!userId) {
    throw new Error("Could not map the checkout session to a Supabase user.");
  }

  if (expectedUserId && userId !== expectedUserId) {
    throw new Error("Checkout session does not belong to the current user.");
  }

  await updateProfileBillingFields(userId, {
    stripe_customer_id: customerId,
  });

  const subscription =
    typeof session.subscription === "string"
      ? await stripe.subscriptions.retrieve(session.subscription)
      : session.subscription;

  if (!subscription) {
    throw new Error("Checkout session is missing a subscription id.");
  }

  const syncResult = await syncStripeSubscription(subscription);
  await markBillingCheckoutSessionCompleted({
    userId,
    checkoutSessionId: session.id,
  });
  return syncResult;
}

export async function syncStripeSubscriptionById(subscriptionId: string) {
  const stripe = getStripeServerClient();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  return syncStripeSubscription(subscription);
}

export async function claimBillingCheckoutSession({
  userId,
  plan,
  holdSeconds = 30 * 60,
}: {
  userId: string;
  plan: BillingPlanKey;
  holdSeconds?: number;
}) {
  const supabase = requireSupabaseAdminClient();
  const checkoutToken = crypto.randomUUID();
  const { data, error } = await supabase.rpc("claim_billing_checkout_session", {
    p_user_id: userId,
    p_plan: plan,
    p_checkout_token: checkoutToken,
    p_hold_seconds: holdSeconds,
  });

  if (error) {
    throw new Error(error.message);
  }

  const row = Array.isArray(data) ? data[0] : data;
  const claim = (row as BillingCheckoutClaimRow | null) ?? null;
  if (!claim?.checkout_token) {
    throw new Error("Could not claim a billing checkout session.");
  }

  return {
    checkoutToken: claim.checkout_token,
    stripeCheckoutSessionId: claim.stripe_checkout_session_id,
    checkoutUrl: claim.checkout_url,
    expiresAt: claim.expires_at,
    reused: claim.reused,
    replacedCheckoutSessionId: claim.replaced_checkout_session_id,
  };
}

export async function getBillingCheckoutSession(userId: string) {
  const supabase = requireSupabaseAdminClient();
  const { data, error } = await supabase
    .from("billing_checkout_sessions")
    .select("checkout_token, stripe_checkout_session_id, checkout_url, expires_at, completed_at, plan")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const row = (data as BillingCheckoutSessionRow | null) ?? null;
  return row
    ? {
        checkoutToken: row.checkout_token,
        stripeCheckoutSessionId: row.stripe_checkout_session_id,
        checkoutUrl: row.checkout_url,
        expiresAt: row.expires_at,
        completedAt: row.completed_at,
        plan: row.plan,
      }
    : null;
}

export async function storeBillingCheckoutSession({
  userId,
  checkoutToken,
  stripeCheckoutSessionId,
  checkoutUrl,
  expiresAt,
}: {
  userId: string;
  checkoutToken: string;
  stripeCheckoutSessionId: string;
  checkoutUrl: string;
  expiresAt: string | null;
}) {
  const supabase = requireSupabaseAdminClient();
  const { data, error } = await supabase
    .from("billing_checkout_sessions")
    .update({
      stripe_checkout_session_id: stripeCheckoutSessionId,
      checkout_url: checkoutUrl,
      expires_at: expiresAt,
    })
    .eq("user_id", userId)
    .eq("checkout_token", checkoutToken)
    .select("user_id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function markBillingCheckoutSessionCompleted({
  userId,
  checkoutSessionId,
}: {
  userId: string;
  checkoutSessionId: string;
}) {
  const supabase = requireSupabaseAdminClient();
  const { error } = await supabase
    .from("billing_checkout_sessions")
    .update({
      completed_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("stripe_checkout_session_id", checkoutSessionId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function hasProcessedStripeWebhookEvent(eventId: string): Promise<boolean> {
  const supabase = requireSupabaseAdminClient();
  const { data, error } = await supabase
    .from("stripe_webhook_events")
    .select("processed_at")
    .eq("id", eventId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean((data as StripeWebhookEventRow | null)?.processed_at);
}

export async function claimStripeWebhookEvent(eventId: string, type: string): Promise<boolean> {
  const supabase = requireSupabaseAdminClient();
  const { data, error } = await supabase.rpc("claim_stripe_webhook_event", {
    p_id: eventId,
    p_type: type,
  });

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function releaseStripeWebhookEventClaim(eventId: string) {
  const supabase = requireSupabaseAdminClient();
  const { error } = await supabase.rpc("release_stripe_webhook_event_claim", {
    p_id: eventId,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function markStripeWebhookEventProcessed(eventId: string, type: string) {
  const supabase = requireSupabaseAdminClient();
  const { error } = await supabase.from("stripe_webhook_events").upsert(
    {
      id: eventId,
      type,
      processing_started_at: null,
      processed_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    throw new Error(error.message);
  }
}
