import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs, CtaBand, PageHero, Section } from "@/components/marketing/primitives";
import { JsonLd } from "@/components/seo/json-ld";
import { NOT_ADVICE_STATEMENT } from "@/lib/marketing/copy";
import { GLOSSARY, glossaryLetters, sortedGlossary } from "@/lib/marketing/glossary";
import { definedTermSetSchema, pageMetadata } from "@/lib/marketing/seo";

const path = "/glossary";
const description =
  "A plain-English trading glossary: pip, lot size, leverage, drawdown, daily loss limit, consistency rule, FSCS, CySEC ICF, red-folder news and more, each with an example.";

export const metadata: Metadata = pageMetadata({ title: "Trading & Prop Firm Glossary (A-Z)", description, path });

export default function GlossaryIndexPage() {
  const sorted = sortedGlossary();
  const letters = glossaryLetters();

  return (
    <>
      <JsonLd data={definedTermSetSchema({ terms: sorted })} />
      <Breadcrumbs crumbs={[{ name: "Glossary", path }]} />
      <PageHero
        eyebrow="Glossary"
        title="The trading glossary, in plain English"
        lede={`${GLOSSARY.length} terms across trading basics, risk, prop firm rules, broker safety and psychology. Every entry starts with a short definition and an example.`}
        location="glossary"
      >
        <nav aria-label="Jump to letter" className="mt-6 flex flex-wrap justify-center gap-1.5">
          {letters.map((l) => (
            <a
              key={l}
              href={`#letter-${l}`}
              className="flex size-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-xs font-semibold text-slate-200 transition hover:bg-white/[0.08] hover:text-white"
            >
              {l}
            </a>
          ))}
        </nav>
      </PageHero>

      <Section eyebrow="A to Z" title="All terms" narrow>
        <div className="space-y-12">
          {letters.map((l) => (
            <div key={l} id={`letter-${l}`} className="scroll-mt-24 border-t border-white/10 pt-6">
              <h3 className="font-mono text-sm font-semibold tracking-widest text-[var(--vt-coral)]">{l}</h3>
              <ul className="mt-4 divide-y divide-white/10">
                {sorted
                  .filter((t) => t.term[0].toUpperCase() === l)
                  .map((t) => (
                    <li key={t.slug} className="py-3.5">
                      <Link
                        href={`/glossary/${t.slug}`}
                        className="group flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
                      >
                        <span className="text-[15px] font-semibold text-white transition-colors group-hover:text-[var(--vt-coral)]">{t.term}</span>
                        <span className="line-clamp-1 text-sm text-slate-400 sm:max-w-md sm:text-right">{t.short}</span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <CtaBand
        title="Check a name before you deposit"
        body="Free checks against regulator records, with the source shown."
        primary={{ label: "Check a name", href: "/ask", event: "ask" }}
        secondary={{ label: "Learning hub", href: "/resources" }}
        location="glossary"
      />
      <p className="mx-auto w-full max-w-6xl px-4 pb-8 text-xs leading-relaxed text-[var(--vt-muted)] sm:px-6">
        Definitions are general education and are reviewed periodically; regulatory limits change, so check the source. {NOT_ADVICE_STATEMENT}
      </p>
    </>
  );
}
