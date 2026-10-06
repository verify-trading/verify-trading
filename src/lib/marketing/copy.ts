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
    q: "Is there a free plan?",
    a: `Yes. Free includes ${FREE_DAILY_ASK_LIMIT} Ask chats a day, broker and prop firm checks, live market prices and the risk calculators. No card needed.`,
  },
  {
    q: "What does Pro add?",
    a: `${PRO_DAILY_ASK_LIMIT} Ask chats a day, the daily Intelligence brief, the economic calendar with event alerts, Journal with Challenge Mode, Mind coaching and the members-only community.`,
  },
  {
    q: "Can I switch between weekly, monthly and annual?",
    a: "Yes. Pick a different billing period on this page or from billing, and Stripe handles the change. You keep Pro throughout.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from billing and you keep Pro until the end of the period you've paid for. Entity checks stay free either way.",
  },
  {
    q: "Do paid plans change a verdict?",
    a: "Never. A status is computed from regulator records and can't be bought. Pro unlocks tools, not better scores.",
  },
  {
    q: "Is this financial advice?",
    a: "No. verify.trading publishes regulator-sourced records, risk maths and market context. We never tell you what to trade or where to deposit. The decision is always yours.",
  },
];

export type ProductLink = { href: string; name: string; blurb: string; tier: "Free" | "Pro" };

export const PRODUCT_LINKS: Record<string, ProductLink> = {
  ask: { href: "/ask", name: "Ask", blurb: "Ask about a broker, a trade or the markets and get a cited answer.", tier: "Free" },
  verify: { href: "/verify", name: "Verify", blurb: "Check brokers, prop firms and educators against regulator records.", tier: "Free" },
  markets: { href: "/markets", name: "Markets", blurb: "Live prices and session context across gold, FX, indices and crypto.", tier: "Free" },
  intelligence: { href: "/intelligence", name: "Intelligence", blurb: "A daily pre-session brief with bias and key levels.", tier: "Pro" },
  calendar: { href: "/economic-calendar", name: "Economic Calendar", blurb: "Seven days of events with impact levels, filtered by country.", tier: "Pro" },
  journal: { href: "/journal", name: "Journal", blurb: "Log sessions, tag mood and breaches, and get a weekly insight.", tier: "Pro" },
  mind: { href: "/mind", name: "Mind", blurb: "A trading-psychology assessment and voice calls with a Companion.", tier: "Pro" },
};
