import type { Metadata } from "next";

import { Breadcrumbs, CardGrid, CtaBand, PageHero, Section, Steps } from "@/components/marketing/primitives";
import { JsonLd } from "@/components/seo/json-ld";
import { pageMetadata, webPageSchema } from "@/lib/marketing/seo";

const path = "/careers";
const description =
  "Careers at Verify Trading Limited. No open roles right now, but we are keen to hear from traders, engineers and researchers who care about independent verification.";

export const metadata: Metadata = pageMetadata({ title: "Careers at verify.trading", description, path });

export default function CareersPage() {
  return (
    <>
      <JsonLd data={webPageSchema({ name: "Careers at verify.trading", description, path })} />
      <Breadcrumbs crumbs={[{ name: "Careers", path }]} />
      <PageHero
        eyebrow="Careers"
        title="No open roles right now"
        lede="We're always keen to hear from traders and engineers who care about independent verification and plain-English tools for retail traders. Get in touch and tell us what you would work on."
        primary={{ label: "Get in touch", href: "/contact" }}
        secondary={{ label: "About us", href: "/about" }}
        location="careers"
      />
      <Section eyebrow="What we care about" title="The work is only worth doing if it is trusted">
        <CardGrid
          cols={3}
          numbered
          items={[
            { title: "Show the source", body: "Every verdict and every claim points to a record someone can check." },
            { title: "Independence first", body: "We take no commissions from the firms we rate, and that shapes every decision." },
            { title: "Built for retail traders", body: "Plain English, honest limits, and tools that reduce risk rather than encourage more of it." },
          ]}
        />
      </Section>
      <Section eyebrow="Getting in touch" title="How to reach us" band>
        <Steps
          items={[
            { title: "Write a short note", body: "Tell us what you do and what you would build or investigate. A few lines is enough." },
            { title: "Send it via the contact page", body: "We read every message. Mention any relevant work we can look at." },
            { title: "We keep it on file", body: "When a role opens that fits, we will come back to you." },
          ]}
        />
      </Section>
      <CtaBand
        title="Want to work on this with us?"
        body="Send a short note about what you do and what you would build."
        primary={{ label: "Contact us", href: "/contact" }}
        secondary={{ label: "About us", href: "/about" }}
        location="careers"
      />
    </>
  );
}
