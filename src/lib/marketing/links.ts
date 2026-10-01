import { POSTS } from "@/lib/blog/posts";
import type { LinkCard } from "@/components/marketing/primitives";
import { getTerm } from "@/lib/marketing/glossary";

/** One place for internal-link cards, so every page's "related" list stays consistent. */
export const LINKS = {
  howItWorks: { href: "/how-it-works", title: "How it works", body: "What happens between typing a name and reading a sourced verdict.", tag: "Guide" },
  verify: { href: "/verify", title: "Verify", body: "Check brokers, prop firms and educators against regulator records.", tag: "Free" },
  ask: { href: "/ask", title: "Ask", body: "Ask about a broker, a trade or the markets and get a cited answer.", tag: "Free" },
  markets: { href: "/markets", title: "Markets", body: "Live prices and session context across gold, FX, indices and crypto.", tag: "Pro" },
  intelligence: { href: "/intelligence", title: "Intelligence", body: "A daily pre-session brief with a bias and key level per asset.", tag: "Pro" },
  calendar: { href: "/economic-calendar", title: "Economic calendar", body: "Seven days of events with impact levels, filtered by country.", tag: "Pro" },
  journal: { href: "/journal", title: "Trading journal", body: "Log sessions, tag mood and rule breaches, and get a weekly insight.", tag: "Pro" },
  mind: { href: "/mind", title: "Mind", body: "A 30-question trading psychology assessment and a voice Companion.", tag: "Pro" },
  retail: { href: "/retail-traders", title: "For retail traders", body: "The checks that answer the three mistakes that end accounts.", tag: "Audience" },
  propTraders: { href: "/prop-firm-traders", title: "For prop firm traders", body: "Verify the firm, plan around news, and track challenge rules.", tag: "Audience" },
  compareBrokers: { href: "/compare/brokers", title: "Compare brokers", body: "Search broker verdicts by name, regulator and status.", tag: "Free" },
  comparePropFirms: { href: "/compare/prop-firms", title: "Compare prop firms", body: "Search prop firm verdicts and operating status.", tag: "Free" },
  regulators: { href: "/regulators", title: "Regulators", body: "Which regulators supervise the brokers we assess, and how strong each is.", tag: "Free" },
  methodology: { href: "/methodology", title: "Methodology", body: "How records are sourced and how a verdict is computed.", tag: "Trust" },
  trust: { href: "/trust", title: "Trust and independence", body: "Our editorial standards, independence policy and how AI is used.", tag: "Trust" },
  glossary: { href: "/glossary", title: "Trading glossary", body: "Plain-English definitions of trading and prop firm terms.", tag: "Learn" },
  blog: { href: "/blog", title: "Blog", body: "Guides on broker safety, prop firm rules, risk and psychology.", tag: "Learn" },
  resources: { href: "/resources", title: "Learning hub", body: "Guides, glossary, calculators and comparisons in one place.", tag: "Learn" },
  faq: { href: "/faq", title: "FAQ", body: "Answers to common questions about verify.trading.", tag: "Help" },
  guide: { href: "/guide", title: "Trading guide", body: "Verifying brokers and prop firms, and understanding trading risk.", tag: "Learn" },
  tools: { href: "/tools", title: "All calculators", body: "Lot size, risk/reward, pip value, margin, profit/loss and compounding.", tag: "Free" },
  positionSize: { href: "/tools/position-size-calculator", title: "Position size calculator", body: "Turn a risk percentage and a stop into a lot size.", tag: "Free" },
  riskReward: { href: "/tools/risk-reward-calculator", title: "Risk to reward calculator", body: "Ratio and break-even win rate for any entry, stop and target.", tag: "Free" },
  pipValue: { href: "/tools/pip-value-calculator", title: "Pip value calculator", body: "What one pip is worth for your pair and lot size.", tag: "Free" },
  margin: { href: "/tools/margin-calculator", title: "Margin calculator", body: "Margin required for a position at your leverage.", tag: "Free" },
  pricing: { href: "/pricing", title: "Pricing", body: "Free and Pro plans compared.", tag: "Plans" },
  about: { href: "/about", title: "About", body: "Who runs verify.trading and why it is independent.", tag: "Company" },
} satisfies Record<string, LinkCard>;

export type LinkKey = keyof typeof LINKS;

export const links = (...keys: LinkKey[]): LinkCard[] => keys.map((k) => LINKS[k]);

export function postCard(slug: string): LinkCard {
  const p = POSTS.find((x) => x.slug === slug);
  if (!p) throw new Error(`Unknown post: ${slug}`);
  return { href: `/blog/${p.slug}`, title: p.title, body: p.description, tag: p.category };
}

export function termCard(slug: string): LinkCard {
  const t = getTerm(slug);
  if (!t) throw new Error(`Unknown term: ${slug}`);
  return { href: `/glossary/${t.slug}`, title: t.term, body: t.short, tag: "Glossary" };
}
