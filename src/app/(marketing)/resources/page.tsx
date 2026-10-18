import type { Metadata } from "next";

import { Breadcrumbs, CardGrid, CtaBand, LinkGrid, PageHero, Section } from "@/components/marketing/primitives";
import { JsonLd } from "@/components/seo/json-ld";
import { POSTS } from "@/lib/blog/posts";
import { postCard } from "@/lib/marketing/links";
import { collectionPageSchema, pageMetadata } from "@/lib/marketing/seo";

const path = "/resources";
const description =
  "The verify.trading learning hub: guides on broker safety and risk, a trading glossary, free calculators and the broker and prop firm records, all in one place.";

export const metadata: Metadata = pageMetadata({ title: "Trading Learning Hub: Guides, Glossary & Calculators", description, path });

export default function ResourcesPage() {
  const latest = [...POSTS].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  return (
    <>
      <JsonLd data={collectionPageSchema({ name: "verify.trading learning hub", description, path })} />
      <Breadcrumbs crumbs={[{ name: "Learning hub", path }]} />
      <PageHero
        eyebrow="Learning hub"
        title="Learn the risk before you take it"
        lede="Independent, plain-English education for retail traders: how to check a broker, how prop firm rules work, how to size a trade and how to keep your head. Free, and never paid for by the firms we write about."
        primary={{ label: "Read the guides", href: "/blog" }}
        secondary={{ label: "Open the glossary", href: "/glossary" }}
        location="resources"
      />
      <Section eyebrow="Overview" title="Three ways to learn">
        <CardGrid
          cols={3}
          numbered
          items={[
            { title: "Check who you are dealing with", body: "Confirm a broker or prop firm on the regulator's register, and read the warning signs of a scam." },
            { title: "Size the risk", body: "Turn a risk percentage and a stop into a position size, and see what a pip or a margin requirement is worth." },
            { title: "Understand the terms", body: "Clear definitions with worked examples for daily loss limits, drawdown, and trading psychology." },
          ]}
        />
      </Section>
      <LinkGrid
        eyebrow="Guides"
        title="Latest guides"
        items={latest.map((p) => postCard(p.slug))}
        band
      />
      <CtaBand
        title="Learn it, then check it"
        body="Run a free check on a broker or prop firm before you deposit."
        primary={{ label: "Check a name", href: "/ask", event: "ask" }}
        secondary={{ label: "Read the FAQ", href: "/faq" }}
        location="resources"
      />
    </>
  );
}
