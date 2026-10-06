import type { Metadata } from "next";

import { Breadcrumbs, CtaBand, FaqSection, LinkGrid, PageHero } from "@/components/marketing/primitives";
import { PAGE_FAQS } from "@/lib/marketing/faqs";
import { pageMetadata } from "@/lib/marketing/seo";

const path = "/faq";
const description =
  "Frequently asked questions about verify.trading: what it is, what is free, how verdicts work, which markets are covered, and where to find product-specific answers.";

export const metadata: Metadata = pageMetadata({ title: "FAQ: Common Questions About verify.trading", description, path });

// The FAQPage markup on this page covers only these general questions. Product pages carry their own.
const MORE = [
  { href: "/verify", title: "Verify FAQ", body: "Verdict labels, sources and how often records are updated." },
  { href: "/journal", title: "Journal FAQ", body: "Broker connect, CSV import and challenge mode." },
  { href: "/trust", title: "Trust and independence", body: "Editorial process, AI use and conflicts of interest." },
];

export default function FaqPage() {
  return (
    <>
      <Breadcrumbs crumbs={[{ name: "FAQ", path }]} />
      <PageHero
        eyebrow="FAQ"
        title="Common questions, answered"
        lede="The general questions about verify.trading. Each product page has its own detailed FAQ, linked below."
        primary={{ label: "Contact us", href: "/contact" }}
        location="faq"
      />
      <FaqSection items={[...PAGE_FAQS.hub]} title="About verify.trading" band={false} />
      <LinkGrid title="Product-specific questions" eyebrow="More answers" items={MORE} />
      <CtaBand
        title="Still have a question?"
        body="We read every message."
        primary={{ label: "Contact us", href: "/contact" }}
        secondary={{ label: "Learning hub", href: "/resources" }}
        location="faq"
      />
    </>
  );
}
