/**
 * Shared source of truth for the homepage FAQ. Consumed by the visual FAQ
 * accordion (`components/landing/faq-section.tsx`) and by the FAQPage JSON-LD
 * schema (`lib/seo/schema.ts`) so the two never drift apart.
 */
export type FaqItem = { q: string; a: string };

export const HOMEPAGE_FAQS: FaqItem[] = [
  {
    q: "Is this financial advice?",
    a: "No. verify.trading publishes records and analysis — regulator-sourced entity records, risk maths against rules you set, and market context. We never recommend trades or tell you where to deposit. The decision is always yours.",
  },
  {
    q: "What makes this different from ChatGPT?",
    a: "Structured routing. Entity checks answer only from our verified registry with citations; market data comes from professional feeds; risk maths runs on deterministic engines. Where we have no record, we say so — and you can request a check.",
  },
  {
    q: "How does an entity earn a “Caution”?",
    a: "Only with a documented regulator or court action — an FCA warning, an FTC settlement, a confirmed closure — and the official citation is shown on the record. No citation, no caution. The rule is enforced in our system, not just our policy.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from billing and you keep access through the end of the paid period. Entity checks stay free either way.",
  },
];
