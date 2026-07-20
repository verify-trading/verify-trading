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
- [Trading Tools](${base}/tools): Free calculators — lot size, risk/reward, pip value, margin, profit/loss, and compound growth.
- [Pricing](${base}/pricing): Free entity checks and trade analysis; Pro raises Ask to 20 chats/day and adds morning market briefings and the economic calendar.
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
