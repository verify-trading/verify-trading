import type { TopicBranch } from "@/lib/email/lifecycle/types";

export function firstNameFrom(displayName: string | null): string {
  return displayName?.trim().split(/\s+/)[0] || "there";
}

const CURRENCY = "eur|gbp|usd|jpy|aud|nzd|cad|chf|xau|xag|btc|eth";

// Checked in order, first match wins. Spaces in a phrase match any whitespace.
const TOPIC_KEYWORDS: Array<[TopicBranch, string[]]> = [
  ["propfirm", ["prop firm", "ftmo", "challenge", "funded", "evaluation", "payout"]],
  [
    "broker",
    ["broker", "regulated", "regulation", "fca", "licence", "license", "scam", "legit", "safe", "withdraw", "deposit"],
  ],
  ["risk", ["risk", "lot size", "position size", "sizing", "stop loss", "leverage", "margin", "drawdown"]],
  [
    "psychology",
    ["revenge", "tilt", "emotion", "emotions", "fomo", "discipline", "psychology", "losing streak", "overtrading"],
  ],
  [
    "market",
    [
      "gold", "xau", "eur", "gbp", "usd", "jpy", "nas", "us30", "btc", "oil", "news", "cpi", "nfp", "fed", "forex",
      "market", "markets",
      // Pairs written as one word or with a slash: eurusd, xauusd, eur/usd.
      `(?:${CURRENCY})/?(?:${CURRENCY})`,
    ],
  ],
];

// Whole words only, so "unsafe" isn't "safe" and "fedex" isn't "fed". A trailing "s" is
// allowed so plurals like "brokers" and "payouts" still match.
const TOPIC_PATTERNS = TOPIC_KEYWORDS.map(
  ([topic, keywords]) =>
    [topic, new RegExp(`\\b(?:${keywords.map((k) => k.replace(/ /g, "\\s+")).join("|")})s?\\b`, "i")] as const,
);

export function classifyTopic(text: string | null): TopicBranch {
  if (!text) return "other";
  return TOPIC_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] ?? "other";
}
