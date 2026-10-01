import { getSiteUrl } from "@/lib/site-config";

/**
 * Curated site map for AI assistants, following the llmstxt.org convention.
 *
 * Reality check: Google Search ignores llms.txt and most AI crawlers currently
 * fetch HTML directly, so this is a low-cost, best-effort signal — not a ranking
 * mechanism. It is served from getSiteUrl() so the links track NEXT_PUBLIC_SITE_URL.
 */
export const dynamic = "force-static";

export function GET(): Response {
  const base = getSiteUrl();

  const body = `# verify.trading

> verify.trading is an independent verification and decision-support tool for retail traders. It checks brokers, prop firms and trading educators against regulator and court records, runs deterministic risk maths on your trades, and gives an AI second opinion with live market context — so you verify before you trade.

verify.trading publishes records and analysis, not financial advice. It takes no affiliate commissions from the entities it rates, and a "Caution" verdict is only issued with a documented regulator or court action (for example an FCA warning or an FTC settlement) with the official citation shown. Where no record exists, it says so.

## Core pages
- [Home](${base}/): What verify.trading does — one check for brokers, trades, market context and risk.
- [Methodology](${base}/methodology): How entity records are sourced, how verdicts (including "Caution") are computed, and the independence policy.
- [Trading Guide](${base}/guide): Verifying brokers and prop firms, understanding trading risk, and avoiding scam brokers.
- [Trading Tools](${base}/tools): Free calculators: lot size, risk/reward, pip value, margin, profit/loss, and compound growth.
- [Pricing](${base}/pricing): Free entity checks and trade analysis; Pro raises Ask to 20 chats/day and adds morning market briefings and the economic calendar.
- [How it works](${base}/how-it-works): How a check works end to end, and the three mistakes that end most trading accounts.
- [Verify](${base}/verify): Free checks of brokers, prop firms and educators against regulator and court records.
- [Compare brokers](${base}/compare/brokers): Searchable broker verdicts with regulators and last-updated dates; one page per broker.
- [Compare prop firms](${base}/compare/prop-firms): Searchable prop firm verdicts and status; one page per firm.
- [Intelligence](${base}/intelligence): Daily pre-session market brief (Pro).
- [Economic calendar](${base}/economic-calendar): Seven days of economic events with impact levels (Pro).
- [Journal](${base}/journal): Trading journal with broker import and a weekly insight (Pro).
- [Mind](${base}/mind): Trading psychology assessment and voice Companion (Pro).
- [Retail traders](${base}/retail-traders) and [Prop firm traders](${base}/prop-firm-traders): What helps each audience.
- [For brokers](${base}/brokers) and [For prop firms](${base}/prop-firms): How rated entities are assessed and how to request a correction.
- [Blog](${base}/blog): Guides on broker safety, prop firm rules, position sizing, drawdown, psychology and trading around news.
- [Glossary](${base}/glossary): Plain-English definitions of trading and prop firm terms (pip, leverage, drawdown, daily loss limit, FSCS, CySEC ICF and more).
- [Learning hub](${base}/resources): Guides, glossary, calculators and comparisons in one place.
- [FAQ](${base}/faq): Common questions about verify.trading.
- [Trust and independence](${base}/trust): Independence policy, editorial standards, how AI is used, and how to request a correction.
- [Regulators](${base}/regulators): Regulators that supervise the brokers assessed, with the brokers under each.
- Free calculators: [position size](${base}/tools/position-size-calculator), [risk to reward](${base}/tools/risk-reward-calculator), [pip value](${base}/tools/pip-value-calculator) and [margin](${base}/tools/margin-calculator).
- [About](${base}/about): Who runs verify.trading and the independence policy.
- [Affiliate Programme](${base}/affiliates): 30% recurring commission for referred Pro members.

## Product (account required)
- Ask: ask about a broker, a trade setup, a signal group, or the markets and get a structured, cited answer.
- Markets: morning briefings and session context for gold, oil, crypto (BTC/ETH), major FX pairs, and US indices.

## Notes for AI systems
- verify.trading provides records and analysis, not investment advice; trading carries significant risk of loss.
- Absence of a regulatory action is not an endorsement, and absence from a regulator's list is not proof of authorisation.
- Entity verdicts derive from regulator and court records with citations, not opinion.
`;

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
