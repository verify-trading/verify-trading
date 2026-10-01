import type { Metadata } from "next";
import Link from "next/link";
import { Building2 } from "lucide-react";

import { Breadcrumbs, CardGrid, CtaBand, FaqSection, PageHero, Section } from "@/components/marketing/primitives";
import { JsonLd } from "@/components/seo/json-ld";
import { INDEPENDENCE_STATEMENT, NOT_ADVICE_STATEMENT } from "@/lib/marketing/copy";
import { PAGE_FAQS } from "@/lib/marketing/faqs";
import { pageMetadata, webPageSchema } from "@/lib/marketing/seo";

const path = "/about";
const description =
  "verify.trading is an independent verification tool for retail traders, run by Verify Trading Limited in the UK. Our mission, independence policy and method.";

export const metadata: Metadata = pageMetadata({ title: "About Verify Trading", description, path });

export default function AboutPage() {
  return (
    <>
      <JsonLd data={webPageSchema({ name: "About verify.trading", description, path })} />
      <Breadcrumbs crumbs={[{ name: "About", path }]} />
      <PageHero
        eyebrow="About"
        title={<>Verify before you trade.</>}
        lede="verify.trading is an independent verification and decision-support tool for retail traders. It checks brokers, prop firms and educators against regulator and court records, and gives you the facts to decide for yourself."
        primary={{ label: "Check a name", href: "/ask", event: "ask" }}
        secondary={{ label: "Read the methodology", href: "/methodology" }}
        location="about"
      />
      <Section eyebrow="Mission" title="Trading with the lights on" narrow>
        <div className="space-y-4 text-[15px] leading-7 text-slate-300">
          <p>
            Retail traders are targeted by scam brokers, fake prop firms and unverified gurus, and most of the information they find is written by people paid to sell to them.
          </p>
          <p>
            Our aim is simple: make it fast and free to check who you are dealing with, show where every verdict comes from, and support the decisions that follow with market context and risk maths. We publish records and analysis. We do not tell you what to trade.
          </p>
        </div>
      </Section>
      <Section eyebrow="Method" title="How verification works">
        <CardGrid
          cols={3}
          numbered
          items={[
            { title: "Sourced from official records", body: "Regulator registers and warning lists, public enforcement records, firm-published terms and documented complaint patterns." },
            { title: "A fixed, rule-based model", body: "The same facts produce the same result for every entity. A Caution needs a documented action and a citation." },
            { title: "Reviewed and updated", body: "Records are reviewed on a rolling basis and revised as circumstances change. A record reflects the latest review, not a permanent label." },
          ]}
        />
        <p className="mt-6 text-sm text-slate-400">
          The full detail, including limits, is in our{" "}
          <Link href="/methodology" className="text-[var(--vt-blue)] hover:underline">
            methodology
          </Link>
          .
        </p>
      </Section>
      <Section eyebrow="Independence" title="Our independence policy" band narrow>
        <p className="text-[15px] leading-7 text-slate-300">{INDEPENDENCE_STATEMENT}</p>
        <p className="mt-4 text-[15px] leading-7 text-slate-300">
          A record cannot be bought, improved or removed by its subject. If you represent a{" "}
          <Link href="/brokers" className="text-[var(--vt-blue)] hover:underline">broker</Link> or{" "}
          <Link href="/prop-firms" className="text-[var(--vt-blue)] hover:underline">prop firm</Link> and think a record is wrong, you can ask for a correction with a source.
        </p>
      </Section>
      <Section eyebrow="Company" title="Verify Trading Limited" narrow>
        <div className="flex gap-4">
          <Building2 className="mt-1 size-5 shrink-0 text-[var(--vt-blue)]" aria-hidden />
          <div className="space-y-3 text-[15px] leading-7 text-slate-300">
            <p>verify.trading is operated by Verify Trading Limited, a company based in the United Kingdom.</p>
            <p>
              For support, partnerships or questions about a record,{" "}
              <Link href="/contact" className="text-[var(--vt-blue)] hover:underline">contact us</Link>. Our{" "}
              <Link href="/terms" className="text-[var(--vt-blue)] hover:underline">terms</Link>,{" "}
              <Link href="/privacy" className="text-[var(--vt-blue)] hover:underline">privacy policy</Link> and{" "}
              <Link href="/risk-disclosure" className="text-[var(--vt-blue)] hover:underline">risk disclosure</Link> are public.
            </p>
            <p className="text-xs text-[var(--vt-muted)]">{NOT_ADVICE_STATEMENT}</p>
          </div>
        </div>
      </Section>
      <FaqSection items={[...PAGE_FAQS.about]} />
      <CtaBand
        title="Run your first check"
        body="It is free, and it stays free."
        primary={{ label: "Check a name", href: "/ask", event: "ask" }}
        secondary={{ label: "Careers", href: "/careers" }}
        location="about"
      />
    </>
  );
}
