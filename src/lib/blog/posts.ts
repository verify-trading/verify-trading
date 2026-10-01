/**
 * File-based blog. Posts are plain typed objects rendered by TSX (no markdown library).
 * Keep them general, evergreen and verifiable: no claims about specific named firms.
 * Client review is required before these go live (see the hand-off notes).
 */
export type Block =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "callout"; text: string };

export type BlogPost = {
  slug: string;
  title: string;
  /** 140-160 characters: used as meta description and card summary. */
  description: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  category: string;
  body: Block[];
  /** Related on-site links shown after the post. */
  related: Array<{ href: string; label: string }>;
  /** Related post slugs (shown as cards). */
  relatedPosts?: string[];
  /** Glossary term slugs this post explains (shown as chips). */
  terms?: string[];
  /** ISO date of the last real review. Defaults to `date`. */
  updated?: string;
};

const WORDS_PER_MINUTE = 200;

export function readingTimeMinutes(post: Pick<BlogPost, "body">): number {
  const text = post.body
    .flatMap((b) => (b.type === "ul" || b.type === "ol" ? b.items : [b.text]))
    .join(" ");
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

import { EXTRA, TAKEAWAYS } from "@/lib/blog/posts-extra";
import { MORE_POSTS } from "@/lib/blog/posts-more";

const BASE_POSTS: BlogPost[] = [
  {
    slug: "how-to-check-if-a-broker-is-fca-regulated",
    title: "How to check if a broker is FCA regulated",
    description:
      "A step-by-step guide to checking a broker on the FCA Register: find the firm reference number, confirm permissions, spot clone firms and read the warning list.",
    date: "2026-09-29",
    category: "Broker safety",
    relatedPosts: ["how-to-tell-a-scam-broker-from-a-real-one", "fscs-cysec-and-client-money-protection-explained"],
    terms: ["fca-register", "fscs", "clone-firm", "warning-list"],
    related: [
      { href: "/verify", label: "Verify a broker" },
      { href: "/compare/brokers", label: "Compare brokers" },
      { href: "/methodology", label: "How we verify" },
    ],
    body: [
      { type: "p", text: "Before you deposit with a broker that says it is regulated in the UK, check it yourself. It takes a few minutes, the Financial Conduct Authority (FCA) register is free and public, and it is the one source that a broker cannot edit." },
      { type: "h2", text: "Step by step" },
      {
        type: "ol",
        items: [
          "Find the firm reference number (FRN). Regulated firms normally show it in the website footer, the terms and conditions or the client agreement. If you cannot find one anywhere, treat that as a warning sign.",
          "Search the FCA Register at register.fca.org.uk. Type in the FRN rather than the brand name, because brand names can be copied and trading names differ from the legal entity.",
          "Check the status. You want to see that the firm is authorised and not, for example, cancelled or in the process of being wound down.",
          "Check the permissions. Authorisation is for specific activities. Confirm the firm is permitted to do what you are asking it to do, such as arranging deals or dealing as principal in the products you plan to trade.",
          "Match the details. The registered address, website and phone number on the register should match the ones you were given. A clone firm often uses a real FRN with different contact details.",
          "Check the FCA Warning List. The FCA publishes a list of firms and websites it has warned about, including clones of authorised firms. Search the brand and the web address.",
        ],
      },
      { type: "h2", text: "Why the exact legal entity matters" },
      { type: "p", text: "Many brokers operate several entities in different countries. The entity that holds your account decides which regulator applies and what protections you get. UK retail clients should be onboarded by the UK-authorised entity. If a broker moves you to an offshore entity, the FCA rules and the Financial Services Compensation Scheme (FSCS) may not apply to your account." },
      { type: "h2", text: "What FCA authorisation does and does not tell you" },
      {
        type: "ul",
        items: [
          "It shows the firm is authorised and supervised for the activities listed. It is not a guarantee that the firm will never fail or treat a client badly.",
          "For eligible claims against an authorised firm that fails, the FSCS can pay compensation up to a limit. Check the FSCS website for the current limit and what is covered.",
          "FCA rules for retail CFD trading include leverage limits and negative balance protection. A broker advertising much higher leverage to a UK retail client is a reason to ask which entity is actually serving you.",
        ],
      },
      { type: "callout", text: "Absence from a regulator's list is not proof of authorisation, and presence on the register is not an endorsement. Use the register as one input alongside the broker's terms and the warning list." },
      { type: "h2", text: "Other regulators" },
      { type: "p", text: "Brokers outside the UK are regulated by other authorities, and the strength of oversight varies a lot between jurisdictions. The same approach applies: find the licence number on the broker's site, then confirm it on that regulator's own public register, not on a link the broker supplies." },
    ],
  },
  {
    slug: "prop-firm-challenge-rules-that-catch-traders-out",
    title: "Prop firm challenge rules that catch traders out",
    description:
      "Daily drawdown, trailing drawdown, news trading limits and consistency rules explained, with a worked example and a checklist to run before you buy a challenge.",
    date: "2026-09-29",
    category: "Prop firms",
    relatedPosts: ["what-is-drawdown-and-how-to-manage-it", "how-to-keep-a-trading-journal"],
    terms: ["daily-loss-limit", "trailing-drawdown", "consistency-rule", "news-trading-rule"],
    related: [
      { href: "/prop-firm-traders", label: "For prop firm traders" },
      { href: "/economic-calendar", label: "Economic calendar" },
      { href: "/compare/prop-firms", label: "Compare prop firms" },
    ],
    body: [
      { type: "p", text: "Most prop firm challenges are not failed by bad analysis. They are failed by a rule the trader did not fully understand. The rules differ between firms and change over time, so this guide explains the common types and what to check. Always read the firm's own current rules, because those are what will be applied to your account." },
      { type: "h2", text: "Daily drawdown" },
      { type: "p", text: "A daily drawdown limit caps how much you can lose in one day. The details decide how dangerous it is. Check whether it is measured from the starting balance or from that day's opening balance or equity, whether floating (open) losses count, and what time the day resets and in which time zone." },
      { type: "p", text: "Worked example: on a 100,000 account with a 5% daily limit, the limit is 5,000. If you have already lost 3,000 on closed trades and hold a position that is 2,000 in floating loss, you are at the limit even though that trade may still recover." },
      { type: "h2", text: "Maximum drawdown: static or trailing" },
      { type: "p", text: "A static maximum drawdown is measured from your starting balance and does not move. A trailing drawdown follows your highest balance or equity, so the buffer shrinks as you make profit, and in some models it stops trailing at a set level. Traders often assume static and find out it was trailing after a good run." },
      { type: "h2", text: "News trading restrictions" },
      { type: "p", text: "Some firms restrict opening, closing or holding trades around high-impact economic releases, for a window before and after the event. The window, the events that count and the penalty vary. A breach can void a profit or the account, so plan around the calendar and check the exact wording." },
      { type: "h2", text: "Consistency rules" },
      { type: "p", text: "A consistency rule limits how much of your total profit can come from a single day or trade, for example requiring that no one day exceeds a set percentage of overall profit. It targets one lucky day. If you scale up sharply after a win, you can hit it without noticing." },
      { type: "h2", text: "Other rules worth checking" },
      {
        type: "ul",
        items: [
          "Minimum trading days and the time limit to reach the profit target.",
          "Maximum lot size, leverage and position limits.",
          "Whether holding trades over the weekend or overnight is allowed.",
          "Restrictions on expert advisors, copy trading, hedging and trading across accounts.",
          "How and when payouts are calculated, and any conditions attached.",
        ],
      },
      { type: "h2", text: "A pre-purchase checklist" },
      {
        type: "ol",
        items: [
          "Read the rules page in full and save a dated copy or screenshot.",
          "Write each limit as a number in your own account currency.",
          "Size positions so a stop-out on any single trade is a small fraction of the daily limit.",
          "Check the economic calendar each morning and mark any event the firm restricts.",
          "If a rule is unclear, ask the firm in writing before you pay.",
          "Check the firm itself before you buy: is there a documented record on it?",
        ],
      },
      { type: "callout", text: "A challenge fee is a real cost. Treat the rules as the strategy: a plan that fits inside the limits matters more than a clever entry." },
    ],
  },
  {
    slug: "position-sizing-how-much-to-risk-per-trade",
    title: "Position sizing: how much to risk per trade",
    description:
      "How to size a trade from your balance, risk percentage and stop distance, with a worked forex example and why recovering a loss is harder than making one.",
    date: "2026-09-29",
    category: "Risk management",
    relatedPosts: ["risk-reward-and-win-rate-what-the-maths-says", "what-is-drawdown-and-how-to-manage-it"],
    terms: ["position-sizing", "lot-size", "pip", "stop-loss"],
    related: [
      { href: "/tools", label: "Risk calculators" },
      { href: "/retail-traders", label: "For retail traders" },
      { href: "/guide", label: "Learning hub" },
    ],
    body: [
      { type: "p", text: "Position sizing decides how much a single trade can hurt you. It is the part of trading you fully control, and it is where most accounts are won or lost. The idea is simple: decide how much you are willing to lose on the trade first, then work out the size that fits." },
      { type: "h2", text: "The formula" },
      { type: "p", text: "Position size = amount you are willing to risk divided by the loss per unit if your stop is hit. The amount at risk is your account balance multiplied by your risk percentage. The loss per unit is the distance from entry to stop, multiplied by the value of that distance for one unit." },
      { type: "h2", text: "A worked forex example" },
      {
        type: "ul",
        items: [
          "Account balance: 10,000 USD. Risk per trade: 1%. That is 100 USD at risk.",
          "Pair: EUR/USD. Entry to stop-loss distance: 25 pips.",
          "For a USD account on EUR/USD, one pip on one standard lot (100,000 units) is worth about 10 USD.",
          "Loss per lot if stopped out: 25 pips x 10 USD = 250 USD.",
          "Position size: 100 / 250 = 0.40 lots.",
        ],
      },
      { type: "p", text: "If you widen your stop to 50 pips, the size halves to 0.20 lots. The stop is set by the market structure, and the size adapts to it, not the other way round." },
      { type: "h2", text: "Why small losses matter so much" },
      { type: "p", text: "Losses need larger gains to recover, and the gap grows quickly:" },
      {
        type: "ul",
        items: [
          "A 10% loss needs about an 11.1% gain to get back to even.",
          "A 20% loss needs a 25% gain.",
          "A 50% loss needs a 100% gain.",
        ],
      },
      { type: "h2", text: "Choosing a risk percentage" },
      { type: "p", text: "There is no universal number. Many traders keep the risk on a single trade to a small single-digit percentage or less of their account, and lower still when they are new or trading a prop firm account with a strict drawdown limit. The right figure depends on your strategy's win rate, your drawdown tolerance and any rules you must follow. This is general education, not a recommendation." },
      { type: "h2", text: "Common mistakes" },
      {
        type: "ul",
        items: [
          "Sizing up after a win or to win back a loss, which makes the next loss bigger.",
          "Setting the stop after choosing the size, so the stop ends up too tight or too wide.",
          "Forgetting that several open trades in correlated pairs add up to one larger risk.",
          "Ignoring spreads, slippage and fees, which make the real loss larger than planned.",
        ],
      },
      { type: "callout", text: "Use a calculator to check your maths every time. Our free risk calculators cover lot size, pip value, margin and risk/reward." },
    ],
  },
];

/** Splice the extra depth in before the post's last section so its closing section stays last. */
function withExtra(post: BlogPost): BlogPost {
  const extra = EXTRA[post.slug];
  const takeaways: Block[] = TAKEAWAYS[post.slug] ? [{ type: "h2", text: "Key takeaways" }, { type: "ul", items: TAKEAWAYS[post.slug] }] : [];
  if (!extra) return { ...post, body: [...post.body, ...takeaways] };
  const at = post.body.map((b) => b.type).lastIndexOf("h2");
  return { ...post, body: [...post.body.slice(0, at), ...extra, ...post.body.slice(at), ...takeaways] };
}

export const POSTS: BlogPost[] = [...BASE_POSTS, ...MORE_POSTS].map(withExtra);

export const getPost = (slug: string) => POSTS.find((p) => p.slug === slug);
