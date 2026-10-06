import type { Metadata } from "next";

import { Faq, Section } from "@/components/marketing/primitives";
import { PricingPlansSection } from "@/components/pricing/pricing-plans";
import { JsonLd } from "@/components/seo/json-ld";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/site/site-footer";
import { getPricingPageData } from "@/lib/billing/pricing-page-data";
import { PRICING_FAQS } from "@/lib/marketing/copy";
import { pageMetadata } from "@/lib/marketing/seo";
import { faqPageSchema } from "@/lib/seo/schema";

export const metadata: Metadata = pageMetadata({
  title: "Pricing",
  description:
    "Compare Free and Pro plans for verify.trading. Entity checks are free; Pro adds a higher Ask limit, Markets, the economic calendar, Journal and Mind.",
  path: "/pricing",
});

export default async function PricingPage() {
  const { pricing, billingContext } = await getPricingPageData();

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(242,109,109,0.12),transparent_50%),var(--vt-navy)] text-white">
      <PricingPlansSection pricing={pricing} billingContext={billingContext} compactHeader showBackHome />
      <JsonLd data={faqPageSchema(PRICING_FAQS)} />
      <Section eyebrow="FAQ" title="Common questions" narrow>
        <Faq items={PRICING_FAQS} />
      </Section>
      <section className="mx-auto w-full max-w-3xl px-4 pb-14 sm:px-6">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-[var(--vt-blue)]/40 bg-[linear-gradient(110deg,rgba(76,110,245,0.18),rgba(139,92,246,0.14))] p-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="text-xl font-semibold text-white sm:text-2xl">Verify before you trade.</p>
            <p className="mt-1 text-sm text-slate-300">Smarter checks. Better decisions.</p>
          </div>
          <Button asChild size="pill">
            <a href="#plans">Get Pro →</a>
          </Button>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
