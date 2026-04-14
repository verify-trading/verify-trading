import { LandingPage } from "@/components/landing/landing-page";
import { getPricingPageData } from "@/lib/billing/pricing-page-data";

export default async function Home() {
  const { pricing, billingContext } = await getPricingPageData();
  return <LandingPage pricing={pricing} billingContext={billingContext} />;
}
