import type { Metadata } from "next";

import {
  Breadcrumbs,
  CardGrid,
  CtaBand,
  FaqSection,
  PageHero,
  Section,
  Steps,
} from "@/components/marketing/primitives";
import { JsonLd } from "@/components/seo/json-ld";
import { NOT_ADVICE_STATEMENT } from "@/lib/marketing/copy";
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
        title={<>From a name to a sourced answer, <span className="text-[var(--vt-coral)]">in seconds.</span></>}
        lede="Type a broker, prop firm, educator, trade idea or market into Ask. verify.trading routes it to the right source, shows its working, and leaves the decision with you."
        primary={{ label: "Check a name", href: "/ask", event: "ask" }}
        secondary={{ label: "Read the methodology", href: "/methodology" }}
        location="how_it_works"
      />

      <Section eyebrow="The process" title="A check, end to end">
        <Steps
          items={[
            {
              title: "You ask",
              body: "Ask about an entity (“Is this broker regulated?”), a trade (“Position size for 1% risk?”) or a market (“Gold levels before London open?”).",
            },
            {
              title: "Routed to official sources",
              body: "Entity checks query our verified registry with citations. Market context comes from professional feeds. Risk maths runs on deterministic engines.",
            },
            {
              title: "Verdict with citations",
              body: "Receive a clear band, regulator details and primary citations. Missing records are stated as missing, never guessed.",
            },
          ]}
        />
      </Section>

      <Section
        eyebrow="Three pitfalls"
        title="Most traders do not lose from bad strategy"
        intro="They lose from avoidable process failures before and during the trade:"
        band
      >
        <CardGrid
          cols={3}
          numbered
          items={[
            {
              title: "Trusting the wrong entities",
              body: "Scam brokers, fake prop firms and unverified gurus drain accounts before the first trade is placed.",
            },
            {
              title: "Entering trades too early",
              body: "Trading without confirmation, ignoring session tone, or entering right before high-impact economic releases.",
            },
            {
              title: "Risking too much per position",
              body: "Over-leverage turns one normal loss into a margin call, and one bad week into a blown account.",
            },
          ]}
        />
      </Section>

      <FaqSection items={[...PAGE_FAQS.howItWorks]} />

      <CtaBand
        title="Welcome to trading with the lights on."
        body="Run your first check now. It is free, and it stays free."
        primary={{ label: "Check a name", href: "/ask", event: "ask" }}
        secondary={{ label: "See the plans", href: "/pricing", event: "pricing" }}
        location="how_it_works"
      />

      <p className="mx-auto w-full max-w-6xl px-4 pb-8 text-xs leading-relaxed text-[var(--vt-muted)] sm:px-6">
        {NOT_ADVICE_STATEMENT}
      </p>
    </>
  );
}
