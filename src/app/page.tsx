import type { Metadata } from "next";

import { LandingPage } from "@/components/landing/landing-page";
import { getPricingPageData } from "@/lib/billing/pricing-page-data";

export const metadata: Metadata = {
  title: "verify.trading | AI trading second opinion",
  description:
    "Verify brokers, trading ideas, market context, and risk before you place the trade.",
};

export default async function Home() {
  const { pricing, billingContext } = await getPricingPageData();
  return <LandingPage pricing={pricing} billingContext={billingContext} />;
}
