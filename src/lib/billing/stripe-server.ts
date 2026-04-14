import Stripe from "stripe";

import { getStripeSecretKey } from "@/lib/billing/config";

let stripeClient: Stripe | null = null;

export function getStripeServerClient(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(getStripeSecretKey(), {
      apiVersion: "2026-03-25.dahlia",
    });
  }

  return stripeClient;
}
