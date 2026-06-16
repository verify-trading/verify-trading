"use client";

import type { BillingPlanKey } from "@/lib/billing/config";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

type MetaPixelEventName = "ViewContent" | "InitiateCheckout" | "Purchase";

type MetaPixelPayload = {
  content_name?: string;
  content_category?: string;
  content_ids?: string[];
  content_type?: string;
  currency?: string;
  value?: number;
  status?: string;
};

export function trackMetaPixelEvent(eventName: MetaPixelEventName, payload?: MetaPixelPayload) {
  if (typeof window === "undefined" || typeof window.fbq !== "function") {
    return;
  }

  window.fbq("track", eventName, payload);
}

export function trackMetaViewContent(payload?: MetaPixelPayload) {
  trackMetaPixelEvent("ViewContent", {
    content_name: "Verify Trading Landing Page",
    content_category: "Landing Page",
    ...payload,
  });
}

export function trackMetaInitiateCheckout({
  plan,
  value,
  currency = "GBP",
}: {
  plan?: BillingPlanKey | null;
  value?: number | null;
  currency?: string | null;
}) {
  trackMetaPixelEvent("InitiateCheckout", {
    content_name: plan ? `Verify Trading Pro ${plan}` : "Verify Trading Pro",
    content_category: "Subscription",
    content_ids: plan ? [`pro_${plan}`] : ["pro"],
    content_type: "product",
    ...(currency ? { currency } : {}),
    ...(typeof value === "number" ? { value } : {}),
  });
}

export function trackMetaPurchase({
  plan,
  value,
  currency = "GBP",
  checkoutSessionId,
}: {
  plan?: BillingPlanKey | null;
  value?: number | null;
  currency?: string | null;
  checkoutSessionId?: string | null;
}) {
  trackMetaPixelEvent("Purchase", {
    content_name: plan ? `Verify Trading Pro ${plan}` : "Verify Trading Pro",
    content_category: "Subscription",
    content_ids: plan ? [`pro_${plan}`] : ["pro"],
    content_type: "product",
    ...(currency ? { currency } : {}),
    ...(typeof value === "number" ? { value } : {}),
    ...(checkoutSessionId ? { status: checkoutSessionId } : {}),
  });
}
