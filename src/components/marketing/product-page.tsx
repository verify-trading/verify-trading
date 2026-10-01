import type { ReactNode } from "react";

import {
  Breadcrumbs,
  CardGrid,
  CtaBand,
  FaqSection,
  FreeVsPro,
  PageHero,
  Section,
  Steps,
  type CardItem,
  type Cta,
} from "@/components/marketing/primitives";
import { JsonLd } from "@/components/seo/json-ld";
import { NOT_ADVICE_STATEMENT } from "@/lib/marketing/copy";
import type { Faq } from "@/lib/marketing/faqs";
import { freeSoftwareSchema, webPageSchema } from "@/lib/marketing/seo";
import { PRO_PLAN_FEATURES } from "@/lib/marketing/pro-plan-features";

export type ProductPageProps = {
  path: string;
  name: string;
  description: string;
  tier: "Free" | "Pro";
  eyebrow: string;
  title: ReactNode;
  lede: string;
  primary: Cta;
  secondary?: Cta;
  visual: ReactNode;
  featuresTitle?: string;
  featuresIntro?: string;
  features: CardItem[];
  howTitle?: string;
  how: Array<{ title: string; body: string }>;
  /** Live data preview (calendar, brief), rendered between how-it-works and Free vs Pro. */
  extra?: ReactNode;
  /** What a free account gets for this product (specific to the page). */
  free: string[];
  planNote?: string;
  faqs: Faq[];
  ctaTitle: string;
  ctaBody: string;
  footnote?: string;
};

/**
 * Product page anatomy:
 * Hero (with phone mock) → 3 feature cards → How it works (3 steps) →
 * [live preview section if provided] → Free vs Pro → FAQ (≤6) → CTA.
 */
export function ProductPage(p: ProductPageProps) {
  const schema = { name: p.name, description: p.description, path: p.path };
  const location = p.path.slice(1);

  const featureCards: CardItem[] = p.features.slice(0, 3).map((f) => ({
    title: f.title,
    body: f.body,
    icon: f.icon,
    theme: f.theme,
  }));

  const howSteps = p.how.slice(0, 3);

  return (
    <>
      <JsonLd data={p.tier === "Free" ? freeSoftwareSchema(schema) : webPageSchema(schema)} />
      <Breadcrumbs crumbs={[{ name: p.name, path: p.path }]} />
      <PageHero
        eyebrow={p.eyebrow}
        title={p.title}
        lede={p.lede}
        primary={p.primary}
        secondary={p.secondary}
        visual={p.visual}
        location={location}
      />
      <Section eyebrow="What it does" title={p.featuresTitle ?? `Why traders use ${p.name}`} intro={p.featuresIntro}>
        <CardGrid items={featureCards} cols={3} numbered />
      </Section>
      <Section eyebrow="How it works" title={p.howTitle ?? `How ${p.name} works`} band>
        <Steps items={howSteps} />
      </Section>
      {p.extra}
      <Section eyebrow="Free vs Pro" title={p.tier === "Free" ? "Free to use, with more in Pro" : "Included with Pro"}>
        <FreeVsPro free={p.free} pro={PRO_PLAN_FEATURES} note={p.planNote} />
      </Section>
      <FaqSection items={p.faqs} />
      <CtaBand title={p.ctaTitle} body={p.ctaBody} primary={p.primary} secondary={p.secondary} location={location} />
      <p className="mx-auto w-full max-w-6xl px-4 pb-8 text-xs leading-relaxed text-[var(--vt-muted)] sm:px-6">
        {p.footnote ? `${p.footnote} ` : null}
        {NOT_ADVICE_STATEMENT}
      </p>
    </>
  );
}
