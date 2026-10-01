import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import {
  Breadcrumbs,
  CardGrid,
  CtaBand,
  FaqSection,
  PageHero,
  Section,
  Steps,
  type CardItem,
  type Cta,
  type IconTheme,
} from "@/components/marketing/primitives";
import { JsonLd } from "@/components/seo/json-ld";
import { NOT_ADVICE_STATEMENT } from "@/lib/marketing/copy";
import type { Faq } from "@/lib/marketing/faqs";
import { webPageSchema } from "@/lib/marketing/seo";

export type HelpItem = { icon: LucideIcon; theme: IconTheme; title: string; body: string; href: string; bullets?: string[] };

/**
 * Audience page anatomy:
 * Hero → 3 cards → one short text section → FAQ → CTA.
 */
export function AudiencePage(p: {
  path: string;
  name: string;
  description: string;
  eyebrow: string;
  title: ReactNode;
  lede: string;
  primary: Cta;
  secondary?: Cta;
  cards?: CardItem[];
  problemsTitle?: string;
  problems?: Array<{ title: string; body: string }>;
  helpTitle?: string;
  help?: HelpItem[];
  workflowTitle?: string;
  workflow?: Array<{ title: string; body: string }>;
  faqs: Faq[];
  ctaTitle: string;
  ctaBody: string;
}) {
  const location = p.path.slice(1);

  // Pick 3 cards: prioritize explicit cards, help items, or problems
  const cards: CardItem[] = p.cards
    ? p.cards.slice(0, 3)
    : p.help && p.help.length >= 3
      ? p.help.slice(0, 3).map((h) => ({ icon: h.icon, theme: h.theme, title: h.title, body: h.body }))
      : (p.problems ?? []).slice(0, 3).map((pr) => ({ title: pr.title, body: pr.body }));

  const workflowText = p.workflow
    ? p.workflow.slice(0, 4).map((w, i) => `${i + 1}. ${w.title}: ${w.body}`).join(" ")
    : null;

  return (
    <>
      <JsonLd data={webPageSchema({ name: p.name, description: p.description, path: p.path })} />
      <Breadcrumbs crumbs={[{ name: p.name, path: p.path }]} />
      <PageHero eyebrow={p.eyebrow} title={p.title} lede={p.lede} primary={p.primary} secondary={p.secondary} location={location} />

      <Section eyebrow="Key capabilities" title={p.helpTitle ?? p.problemsTitle ?? "What helps you trade safer"}>
        <CardGrid items={cards} cols={3} numbered />
      </Section>

      {p.workflow && p.workflow.length > 0 ? (
        <Section eyebrow="Process" title={p.workflowTitle ?? "A routine that works"} band>
          <Steps items={p.workflow.slice(0, 4)} />
        </Section>
      ) : workflowText ? (
        <Section eyebrow="Process" title={p.workflowTitle ?? "A routine that works"} band narrow>
          <p className="text-[15px] leading-7 text-slate-300">{workflowText}</p>
        </Section>
      ) : null}

      <FaqSection items={p.faqs} band={false} />
      <CtaBand title={p.ctaTitle} body={p.ctaBody} primary={p.primary} secondary={p.secondary} location={location} />
      <p className="mx-auto w-full max-w-6xl px-4 pb-8 text-xs leading-relaxed text-[var(--vt-muted)] sm:px-6">{NOT_ADVICE_STATEMENT}</p>
    </>
  );
}
