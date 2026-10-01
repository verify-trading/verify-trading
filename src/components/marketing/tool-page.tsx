import type { ReactNode } from "react";

import {
  Breadcrumbs,
  Byline,
  CtaBand,
  FaqSection,
  Section,
} from "@/components/marketing/primitives";
import { SectionEyebrow } from "@/components/landing/section-primitives";
import { JsonLd } from "@/components/seo/json-ld";
import { NOT_ADVICE_STATEMENT } from "@/lib/marketing/copy";
import type { Faq } from "@/lib/marketing/faqs";
import { toolSchema } from "@/lib/marketing/seo";

export const TOOLS_REVIEWED = "2026-09-29";

/**
 * Calculator landing page:
 * The calculator first, above the fold, in one clean card.
 * Then a short explainer and FAQ.
 */
export function ToolPage(p: {
  path: string;
  name: string;
  description: string;
  h1: ReactNode;
  lede: string;
  calculator: ReactNode;
  formulaTitle: string;
  formula: string;
  workedExample: string[];
  faqs: Faq[];
}) {
  return (
    <>
      <JsonLd data={toolSchema({ name: p.name, description: p.description, path: p.path })} />
      <Breadcrumbs crumbs={[{ name: "Calculators", path: "/resources" }, { name: p.name, path: p.path }]} />

      <section className="relative overflow-hidden border-b border-white/[0.06] bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(76,110,245,0.12),transparent_60%),var(--vt-navy)] pt-10 pb-14 sm:pt-14 sm:pb-16">
        <div className="mx-auto w-full max-w-4xl px-4 text-center sm:px-6">
          <SectionEyebrow>Free calculator</SectionEyebrow>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-[2.6rem] lg:leading-[1.1]">
            {p.h1}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-7 text-slate-300">
            {p.lede}
          </p>
          <div className="mt-4"><Byline updated={TOOLS_REVIEWED} /></div>
        </div>

        {/* Calculator immediately above the fold */}
        <div className="mx-auto mt-8 w-full max-w-4xl px-4 sm:px-6">
          {p.calculator}
        </div>
      </section>

      {/* Short explainer: Formula & Worked Example */}
      <Section eyebrow="The maths" title={p.formulaTitle} band narrow>
        <div className="space-y-8">
          <div className="border-t border-white/10 pt-6">
            <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[var(--vt-coral)]">Formula</p>
            <p className="mt-3 font-mono text-lg font-semibold text-white">{p.formula}</p>
          </div>
          <div className="border-t border-white/10 pt-6">
            <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[var(--vt-coral)]">Worked example</p>
            <ol className="mt-4 space-y-2.5 text-[15px] leading-7 text-slate-300">
              {p.workedExample.map((line) => <li key={line}>{line}</li>)}
            </ol>
          </div>
        </div>
      </Section>

      <FaqSection items={p.faqs} />
      <CtaBand
        title="Size it, then check who you are trading with"
        body="Free checks on brokers and prop firms, with the source shown."
        primary={{ label: "Check a name", href: "/ask", event: "ask" }}
        secondary={{ label: "Learning hub", href: "/resources" }}
        location="tool"
      />
      <p className="mx-auto w-full max-w-6xl px-4 pb-8 text-xs leading-relaxed text-[var(--vt-muted)] sm:px-6">
        Calculators are for education and planning and are not investment advice. {NOT_ADVICE_STATEMENT}
      </p>
    </>
  );
}
