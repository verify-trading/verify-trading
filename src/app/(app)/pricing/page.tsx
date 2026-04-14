import type { Metadata } from "next";

import { PricingPlansSection } from "@/components/pricing/pricing-plans";
import { getPricingPageData } from "@/lib/billing/pricing-page-data";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Compare Free and Pro plans for verify.trading — Ask, Markets, and tools.",
};

export default async function PricingPage() {
  const { pricing, billingContext } = await getPricingPageData();

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(242,109,109,0.12),transparent_50%),var(--vt-navy)] text-white">
      <PricingPlansSection pricing={pricing} billingContext={billingContext} compactHeader showBackHome />
    </div>
  );
}
