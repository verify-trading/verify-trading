import type { Metadata } from "next";

import { HowItWorksCtaBanner, HowItWorksSteps, HowItWorksVideo } from "@/components/marketing/how-it-works";
import { Breadcrumbs, FaqSection, PageHero } from "@/components/marketing/primitives";
import { JsonLd } from "@/components/seo/json-ld";
import { PAGE_FAQS } from "@/lib/marketing/faqs";
import { pageMetadata, webPageSchema } from "@/lib/marketing/seo";

const path = "/how-it-works";
const description =
  "How to verify a trading broker or prop firm in seconds: ask a name, get a sourced verdict from regulator records, and see how the three big trading mistakes are covered.";

export const metadata: Metadata = pageMetadata({ title: "How to Verify a Trading Broker or Prop Firm", description, path });

export default function HowItWorksPage() {
  return (
    <>
      <JsonLd data={webPageSchema({ name: "How verify.trading works", description, path })} />
      <Breadcrumbs crumbs={[{ name: "How it Works", path }]} />
      <PageHero
        eyebrow="How it works"
        title={
          <>
            Smarter Decisions.
            <br />
            <span className="text-[var(--vt-coral)]">Better Trades.</span>
          </>
        }
        lede="Six tools in one app: check who you're trading with, read the market before you act, then review how you traded."
        visual={<HowItWorksVideo />}
        location="how_it_works"
      />

      <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <HowItWorksSteps />
      </section>

      <HowItWorksCtaBanner />

      <FaqSection items={[...PAGE_FAQS.howItWorks]} title="Got questions?" intro="Here are some of the most common questions about verify.trading." />
    </>
  );
}
