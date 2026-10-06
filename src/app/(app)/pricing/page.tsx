import type { Metadata } from "next";

import { CtaBand, FaqSection } from "@/components/marketing/primitives";
import { PricingFeatures, PricingPlansSection } from "@/components/pricing/pricing-plans";
import { SiteFooter } from "@/components/site/site-footer";
import { getPricingPageData } from "@/lib/billing/pricing-page-data";
import { PRICING_FAQS } from "@/lib/marketing/copy";
import { pageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  title: "Pricing",
  description:
    "Compare Free and Pro plans for verify.trading. Entity checks are free; Pro adds a higher Ask limit, Intelligence, the economic calendar, Journal and Mind.",
  path: "/pricing",
});

export default async function PricingPage() {
  const { pricing, billingContext } = await getPricingPageData();

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(139,92,246,0.16),transparent_60%)] text-white">
      <PricingPlansSection pricing={pricing} billingContext={billingContext} />
      <PricingFeatures />
      <FaqSection items={PRICING_FAQS} title="Common questions" intro="Plans, billing and what Pro changes." />
      <CtaBand
        title="Verify before you trade."
        body="Start free in under a minute. Upgrade when you want the full toolkit."
        primary={{ label: "Create free account", href: "/signup", event: "signup" }}
        secondary={{ label: "See plans", href: "#plans" }}
        location="pricing"
      />
      <SiteFooter />
    </div>
  );
}
