// Small display helpers shared by the coach-facing prompts (journal/ai and
// psychology/companion): a rounded, thousands-separated amount and the short
// account-type label. (challenge.ts keeps its own longer ACCOUNT_TYPE_LABEL for the
// scraping prompt — different wording, different purpose.)

export const money = (value: number) => Math.round(value).toLocaleString();

export const ACCOUNT_TYPE_LABEL: Record<string, string> = { "2step": "2-step", "1step": "1-step", instant: "instant funded" };
