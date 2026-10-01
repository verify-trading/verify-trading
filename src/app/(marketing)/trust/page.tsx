import type { Metadata } from "next";

import { Breadcrumbs, CardGrid, CtaBand, FaqSection, PageHero, Section, Steps } from "@/components/marketing/primitives";
import { JsonLd } from "@/components/seo/json-ld";
import { INDEPENDENCE_STATEMENT, NOT_ADVICE_STATEMENT } from "@/lib/marketing/copy";
import { PAGE_FAQS } from "@/lib/marketing/faqs";
import { pageMetadata, webPageSchema } from "@/lib/marketing/seo";

const path = "/trust";
const description =
  "How verify.trading stays independent: no affiliate commissions or paid placements, an evidence-only verdict model, how AI is used, review dates and how to request a correction.";

export const metadata: Metadata = pageMetadata({ title: "Trust & Independence: How We Work", description, path });

export default function TrustPage() {
  return (
    <>
      <JsonLd data={webPageSchema({ name: "Trust and independence at verify.trading", description, path })} />
      <Breadcrumbs crumbs={[{ name: "Trust and independence", path }]} />
      <PageHero
        eyebrow="Trust and independence"
        title={<>Why you can check our <span className="text-[var(--vt-coral)]">working.</span></>}
        lede="We rate brokers, prop firms and educators, so the way we work has to be open to inspection. This page sets out our independence policy, how a verdict is made, where AI is used and how to challenge us."
        primary={{ label: "Read the methodology", href: "/methodology" }}
        secondary={{ label: "Request a correction", href: "/contact" }}
        location="trust"
      />
      <Section eyebrow="Independence" title="Not for sale, by design" narrow>
        <p className="text-[15px] leading-7 text-slate-300">{INDEPENDENCE_STATEMENT}</p>
        <p className="mt-4 text-[15px] leading-7 text-slate-300">
          We earn from Pro subscriptions, paid by traders. There are no paid listings, no sponsored rankings and no commissions from the firms we rate.
        </p>
      </Section>
      <Section eyebrow="Standards" title="Our commitments" band>
        <CardGrid
          cols={3}
          numbered
          items={[
            { title: "No conflicts", body: "No affiliate commissions from rated entities, and rated entities cannot be our affiliates." },
            { title: "One model for everyone", body: "The same facts produce the same result for every entity. A Caution needs a documented regulator or court action and its citation." },
            { title: "Sources shown", body: "Every verdict points to the record behind it, so you can open the register and check it yourself." },
          ]}
        />
      </Section>
      <Section eyebrow="How a verdict is made" title="From public record to plain label">
        <Steps
          items={[
            { title: "Collect", body: "Regulator registers, warning lists, public enforcement records and firm-published terms." },
            { title: "Apply a fixed model", body: "The same rules run for every entity. A negative finding always needs an official source." },
            { title: "Show the source", body: "The verdict is shown with the regulator details and the citation behind it." },
            { title: "Review and update", body: "Records are reviewed on a rolling basis and each shows its latest review." },
          ]}
        />
      </Section>
      <Section eyebrow="Limits" title="What our records cannot tell you" band narrow>
        <p className="text-[15px] leading-7 text-slate-300">
          Records reflect public sources at the time of the last review. They are not an endorsement and not a guarantee of future conduct. Absence of a regulatory action is not proof a firm is safe, and absence from a regulator&apos;s list is not proof of authorisation. Read a firm&apos;s own terms and confirm its licence on the regulator&apos;s register before you deposit.
        </p>
      </Section>
      <FaqSection items={[...PAGE_FAQS.trust]} band={false} />
      <CtaBand title="Spotted an error?" body="Send us the page and a primary source." primary={{ label: "Contact us", href: "/contact" }} secondary={{ label: "About us", href: "/about" }} location="trust" />
      <p className="mx-auto w-full max-w-6xl px-4 pb-8 text-xs leading-relaxed text-[var(--vt-muted)] sm:px-6">{NOT_ADVICE_STATEMENT}</p>
    </>
  );
}
