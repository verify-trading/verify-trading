import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import type { ReactNode } from "react";

import {
  Breadcrumbs,
  CardGrid,
  CtaBand,
  FaqSection,
  PageHero,
  Section,
  type CardItem,
  type LinkCard,
} from "@/components/marketing/primitives";
import { JsonLd } from "@/components/seo/json-ld";
import { INDEPENDENCE_STATEMENT, NOT_ADVICE_STATEMENT } from "@/lib/marketing/copy";
import type { Faq } from "@/lib/marketing/faqs";
import { webPageSchema } from "@/lib/marketing/seo";

/**
 * B2B business page anatomy:
 * Hero → 3 cards → one short text section (independence and corrections) → FAQ → CTA.
 */
export function BusinessPage(p: {
  path: string;
  name: string;
  description: string;
  eyebrow: string;
  title: ReactNode;
  lede: string;
  compareHref: string;
  compareLabel: string;
  assessed: Array<{ title: string; body: string }>;
  entityNoun: string;
  faqs: Faq[];
  related?: LinkCard[];
}) {
  const location = p.path.slice(1);
  const cards: CardItem[] = p.assessed.slice(0, 3).map((a) => ({
    title: a.title,
    body: a.body,
  }));

  return (
    <>
      <JsonLd data={webPageSchema({ name: p.name, description: p.description, path: p.path })} />
      <Breadcrumbs crumbs={[{ name: p.name, path: p.path }]} />
      <PageHero
        eyebrow={p.eyebrow}
        title={p.title}
        lede={p.lede}
        primary={{ label: "Request a correction", href: "/contact" }}
        secondary={{ label: "Read the methodology", href: "/methodology" }}
        location={location}
      />
      <Section eyebrow="Assessment model" title="A fixed model, applied the same way to everyone">
        <CardGrid items={cards} cols={3} numbered />
        <p className="mt-6 text-sm text-slate-400">
          Full detail is in the{" "}
          <Link href="/methodology" className="text-[var(--vt-blue)] hover:underline">methodology</Link>. You can find your current record in{" "}
          <Link href={p.compareHref} className="text-[var(--vt-blue)] hover:underline">{p.compareLabel}</Link>.
        </p>
      </Section>
      <Section eyebrow="Policy" title="Independence and correction policy" band narrow>
        <div className="space-y-4 text-[15px] leading-7 text-slate-300">
          <p>{INDEPENDENCE_STATEMENT}</p>
          <p>
            A record cannot be bought, improved or removed by its subject. A Caution rests on a documented regulator or court action and is revised only when the underlying record changes. If a record is inaccurate, contact us with a primary source such as an official register entry or notice.
          </p>
          <div className="pt-2">
            <Link href="/contact" className="inline-flex items-center gap-2 text-sm font-medium text-[var(--vt-blue)] hover:underline">
              <Mail className="size-4" aria-hidden /> Contact us about a record <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      </Section>
      <FaqSection items={p.faqs} />
      <CtaBand
        title="Questions about your record?"
        body="We read every message and will point you to the source or the rule behind a verdict."
        primary={{ label: "Contact us", href: "/contact" }}
        secondary={{ label: "Methodology", href: "/methodology" }}
        location={location}
      />
      <p className="mx-auto w-full max-w-6xl px-4 pb-8 text-xs leading-relaxed text-[var(--vt-muted)] sm:px-6">{NOT_ADVICE_STATEMENT}</p>
    </>
  );
}
