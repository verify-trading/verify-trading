import type { Metadata } from "next";
import { Calculator, MessagesSquare, ShieldCheck } from "lucide-react";

import { AudiencePage } from "@/components/marketing/audience-page";
import { PAGE_FAQS } from "@/lib/marketing/faqs";
import { pageMetadata } from "@/lib/marketing/seo";

const path = "/retail-traders";
const description =
  "Tools for retail forex and CFD traders: check brokers against regulator records, size every position with free calculators, and get market context before you risk money.";

export const metadata: Metadata = pageMetadata({ title: "Trading Tools for Retail Traders", description, path });

export default function RetailTradersPage() {
  return (
    <AudiencePage
      path={path}
      name="Retail Traders"
      description={description}
      eyebrow="For retail traders"
      title={<>Trade with the lights on, <span className="text-[var(--vt-coral)]">not on trust.</span></>}
      lede="Most retail traders do not lose to a bad strategy. They lose to a bad broker, an entry taken too early, or a position that was too big. verify.trading puts a check in front of each one."
      primary={{ label: "Check a name", href: "/ask", event: "ask" }}
      secondary={{ label: "Use the free calculators", href: "/tools" }}
      helpTitle="Essential tools before risking capital"
      help={[
        {
          icon: ShieldCheck,
          theme: "green",
          title: "Verify the broker",
          body: "Check a broker or educator against regulator records and warning lists before depositing. Free, with primary sources shown.",
          href: "/verify",
        },
        {
          icon: Calculator,
          theme: "amber",
          title: "Size the position",
          body: "Turn account balance, stop distance, and risk percentage into standard lots with deterministic, repeatable math.",
          href: "/tools/position-size-calculator",
        },
        {
          icon: MessagesSquare,
          theme: "blue",
          title: "Pre-session context",
          body: "Ask about upcoming releases, session tone, or currency pairs with structured responses linked directly to live feeds.",
          href: "/ask",
        },
      ]}
      workflowTitle="A pre-trade routine in four steps"
      workflow={[
        { title: "Check the broker", body: "Confirm the legal entity and licence on the regulator's register, and check the warning list." },
        { title: "Know the day", body: "Look at the economic calendar and the session tone for scheduled news that alters volatility." },
        { title: "Size the trade", body: "Set the stop where the idea is proven wrong, then calculate the lot size from the amount you are willing to lose." },
        { title: "Record it", body: "Log the trade outcome and your discipline state in your journal to spot patterns over time." },
      ]}
      faqs={[...PAGE_FAQS.retailTraders]}
      ctaTitle="Run your first check now"
      ctaBody="It is free, and it stays free."
    />
  );
}
