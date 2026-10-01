import { FREE_DAILY_ASK_LIMIT, PRO_DAILY_ASK_LIMIT } from "@/lib/rate-limit/usage";

/** The independence statement already published on the site, reused verbatim. */
export const INDEPENDENCE_STATEMENT =
  "We take no affiliate commissions from brokers, prop firms or educators, and rated entities cannot be our affiliates. Verdicts are computed from regulator records and are not for sale.";

export const NOT_ADVICE_STATEMENT =
  "verify.trading provides records and analysis, not investment advice; trading involves significant risk of loss. Absence of a regulatory action is not an endorsement, and absence from a regulator's list is not proof of authorisation.";

export type FaqItem = { q: string; a: string };

/** Pricing-page FAQ (restored from the old homepage, plus two facts from the methodology). */
export const PRICING_FAQS: FaqItem[] = [
  {
    q: "Is this financial advice?",
    a: "No. verify.trading publishes records and analysis: regulator-sourced entity records, risk maths against rules you set, and market context. We never recommend trades or tell you where to deposit. The decision is always yours.",
  },
  {
    q: "What makes this different from ChatGPT?",
    a: "Structured routing. Entity checks answer only from our verified registry with citations; market data comes from professional feeds; risk maths runs on deterministic engines. Where we have no record, we say so, and you can request a check.",
  },
  {
    q: "How does an entity earn a “Caution”?",
    a: "Only with a documented regulator or court action, such as an FCA warning, an FTC settlement or a confirmed closure, and the official citation is shown on the record. No citation, no caution. The rule is enforced in our system, not just our policy.",
  },
  {
    q: "Do paid features change a verdict?",
    a: "Never. A status or band is computed from the records and can't be bought. Paid plans unlock tools, but they don't move a single verdict.",
  },
  {
    q: "How many Ask chats do I get?",
    a: `Free accounts get ${FREE_DAILY_ASK_LIMIT} Ask chats a day and Pro gets ${PRO_DAILY_ASK_LIMIT}. Entity checks stay free either way.`,
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from billing and you keep access through the end of the paid period. Entity checks stay free either way.",
  },
];

export type ProductLink = { href: string; name: string; blurb: string; tier: "Free" | "Pro" };

export const PRODUCT_LINKS: Record<string, ProductLink> = {
  ask: { href: "/ask", name: "Ask", blurb: "Ask about a broker, a trade or the markets and get a cited answer.", tier: "Free" },
  verify: { href: "/verify", name: "Verify", blurb: "Check brokers, prop firms and educators against regulator records.", tier: "Free" },
  markets: { href: "/markets", name: "Markets", blurb: "Live prices and session context across gold, FX, indices and crypto.", tier: "Pro" },
  intelligence: { href: "/intelligence", name: "Intelligence", blurb: "A daily pre-session brief with bias and key levels.", tier: "Pro" },
  calendar: { href: "/economic-calendar", name: "Economic Calendar", blurb: "Seven days of events with impact levels, filtered by country.", tier: "Pro" },
  journal: { href: "/journal", name: "Journal", blurb: "Log sessions, tag mood and breaches, and get a weekly insight.", tier: "Pro" },
  mind: { href: "/mind", name: "Mind", blurb: "A trading-psychology assessment and voice calls with a Companion.", tier: "Pro" },
};
