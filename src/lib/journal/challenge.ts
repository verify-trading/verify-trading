import { generateObject } from "ai";
import { z } from "zod";

import { getAskSimpleModel } from "@/lib/ask/service/provider";
import { fetchPublicUrl } from "@/lib/http/safe-fetch";
import { FIRM_RULES_SEED } from "./firmRulesCache";

export const challengeConfigSchema = z.object({
  firmUrl: z.url(),
  accountSize: z.number().finite().positive().max(100_000_000),
  accountType: z.enum(["2step", "1step", "instant"]),
});

const challengeRulesSchema = z.object({
  firm_name: z.string().min(1),
  daily_loss_limit: z.string().min(1),
  max_drawdown: z.string().min(1),
  profit_target: z.string().min(1),
  min_trading_days: z.number().nullable(),
  max_trading_days: z.number().nullable(),
  weekend_holding: z.boolean(),
  news_trading_allowed: z.boolean(),
  other_rules: z.array(z.string()),
});

export type ChallengeRules = z.infer<typeof challengeRulesSchema>;
export type AccountType = z.infer<typeof challengeConfigSchema>["accountType"];

export type ChallengeConfigRow = {
  id: string;
  firm_name: string;
  firm_url: string;
  account_size: number | string;
  account_type: AccountType;
  rules: ChallengeRules;
  created_at: string;
  updated_at: string;
};

// When this challenge began, so the app can scope profit-target progress to P&L earned
// AFTER the challenge started (rather than pre-filling the target bar with prior history).
// Stored inside the rules jsonb to avoid a schema migration; null for configs saved before
// this field existed (the app grandfathers those to all-time behaviour).
export function challengeStartedAt(rules: ChallengeRules): string | null {
  const value = (rules as { started_at?: unknown }).started_at;
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function toChallengeConfig(row: ChallengeConfigRow) {
  return {
    id: row.id,
    firmName: row.firm_name,
    firmUrl: row.firm_url,
    accountSize: Number(row.account_size),
    accountType: row.account_type,
    rules: row.rules,
    startedAt: challengeStartedAt(row.rules),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// --- Scraping ---------------------------------------------------------------
// Prop-firm homepages are marketing shells; the actual numbers (profit target,
// drawdown, trading-day limits) live one click deep on a "challenge terms",
// "trading objectives", "pricing" or "FAQ" page — and most of those sites are
// JS-rendered, so the homepage HTML alone yields nothing. That's why a plain
// homepage scrape returned "N/A" for every firm except FTMO (whose rules the
// model happened to know). So: fetch the homepage, follow the most rule-dense
// internal links, and feed the model the aggregate.

const PAGE_TIMEOUT_MS = 6500;
const MAX_RULE_PAGES = 4; // internal pages fetched beyond the homepage
const PER_PAGE_CHARS = 11_000; // cap per sub-page fed to the model
const HOME_CHARS = 6_000; // homepage is nav-heavy — keep only a slice
const TOTAL_CHARS = 32_000; // overall budget for the model prompt
const MIN_PAGE_CHARS = 200; // ignore near-empty (blocked / SPA) responses

// Firecrawl: a headless-browser fallback for the few firms the plain fetch can't reach
// (bot-walls like Vercel/Cloudflare checkpoints, or geo-blocks). Only used when the free
// fetch comes back blocked/empty AND FIRECRAWL_API_KEY is set, so the paid API is rarely
// touched. No key → the scraper behaves exactly as before.
const FIRECRAWL_ENDPOINT = "https://api.firecrawl.dev/v1/scrape";
const FIRECRAWL_MAX_PAGES = 3; // sub-pages fetched via Firecrawl (kept low — each is a paid render)
const FIRECRAWL_TIMEOUT_MS = 25_000;

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

// Phrases that signal a page actually states challenge rules — used both to rank
// which links to follow and to order the fetched pages by usefulness.
const RULE_HINTS = [
  "profit target",
  "daily loss",
  "drawdown",
  "max loss",
  "maximum loss",
  "trading days",
  "minimum trading",
  "consistency",
  "payout",
  "profit split",
  "evaluation",
  "challenge",
  "phase 1",
  "phase 2",
  "step 1",
  "step 2",
];

function ruleScore(text: string): number {
  const lower = text.toLowerCase();
  return RULE_HINTS.reduce((count, hint) => (lower.includes(hint) ? count + 1 : count), 0);
}

// Synonyms for the plan the trader actually chose, so we prefer that plan's page
// (e.g. The5ers calls its 2-step plan "High Stakes", its 1-step "Hyper Growth").
const ACCOUNT_TYPE_HINTS: Record<AccountType, RegExp> = {
  "2step": /2[\s-]?step|two[\s-]?step|high[\s-]?stakes|phase[\s-]?2|step[\s-]?2|evaluation/i,
  "1step": /1[\s-]?step|one[\s-]?step|hyper[\s-]?growth|single[\s-]?step/i,
  instant: /instant|direct[\s-]?fund|funded[\s-]?account|express/i,
};

const LINK_KEYWORDS = /rule|challeng|pricing|objective|how[\s-]?it[\s-]?works|evaluation|program|term|plan|step|account|fund|faq/i;
const LINK_EXCLUDE = /login|sign[\s-]?in|sign[\s-]?up|register|checkout|\/cart|career|contact|privacy|cookie|affiliate|\.pdf(\?|$)|mailto:|tel:/i;

function normalizeUrl(href: string): string {
  return href.replace(/[?#].*$/, "").replace(/\/+$/, "").toLowerCase();
}

// Rank the homepage's internal links by how likely they are to contain the rules
// for the trader's chosen plan. Exported for unit testing.
export function pickRuleLinks(html: string, base: URL, accountType: AccountType, limit = MAX_RULE_PAGES): string[] {
  const baseDomain = base.hostname.split(".").slice(-2).join(".");
  const typeHint = ACCOUNT_TYPE_HINTS[accountType];
  const seen = new Set<string>([normalizeUrl(base.href)]);
  const candidates: Array<{ url: string; weight: number }> = [];

  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let resolved: URL;
    try {
      resolved = new URL(match[1], base);
    } catch {
      continue;
    }
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") continue;
    const sameSite =
      resolved.hostname === base.hostname ||
      resolved.hostname === baseDomain ||
      resolved.hostname.endsWith(`.${baseDomain}`);
    if (!sameSite) continue;

    const anchor = stripHtml(match[2]).toLowerCase();
    const hay = `${resolved.pathname} ${anchor}`;
    if (LINK_EXCLUDE.test(hay)) continue;
    if (!LINK_KEYWORDS.test(hay)) continue;

    const key = normalizeUrl(resolved.href);
    if (seen.has(key)) continue;
    seen.add(key);

    let weight = 1;
    if (typeHint.test(hay)) weight += 3; // the trader's own plan wins ties
    if (/rule|objective|term|challeng|pricing/i.test(hay)) weight += 1;
    candidates.push({ url: resolved.href, weight });
  }

  return candidates
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit)
    .map((candidate) => candidate.url);
}

type FirmPage = { url: string; text: string; score: number };

async function fetchPageText(url: string): Promise<FirmPage | null> {
  try {
    const response = await fetchPublicUrl(url, { timeoutMs: PAGE_TIMEOUT_MS, maxRedirects: 5 });
    const text = stripHtml(await response.text());
    if (text.length < MIN_PAGE_CHARS) return null;
    return { url: response.url || url, text, score: ruleScore(text) };
  } catch {
    return null; // a sub-page that blocks or times out shouldn't sink the whole scrape
  }
}

// Signs the plain fetch was turned away (bot-wall / geo-block) or handed us an empty
// JS shell — the cases a headless browser is needed for.
function looksBlocked(status: number, text: string): boolean {
  return (
    status === 429 ||
    status === 403 ||
    status >= 500 ||
    text.length < 800 ||
    /security checkpoint|verifying your browser|just a moment|attention required|enable javascript|cf-browser-verification|are you a robot/i.test(text)
  );
}

type FirecrawlPage = { url: string; html?: string; markdown?: string };

// One Firecrawl scrape. `discoverLinks` keeps the full page (nav included) so we can
// still rank rule links; otherwise we ask for just the main content as clean markdown.
// A US proxy + stealth-capable auto mode clears most checkpoints and country blocks.
async function firecrawlScrape(url: string, discoverLinks: boolean): Promise<FirecrawlPage | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return null;
  try {
    const response = await fetch(FIRECRAWL_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        url,
        formats: discoverLinks ? ["html"] : ["markdown"],
        onlyMainContent: !discoverLinks,
        proxy: "auto",
        location: { country: "US" },
        waitFor: 1500,
        timeout: FIRECRAWL_TIMEOUT_MS,
      }),
      signal: AbortSignal.timeout(FIRECRAWL_TIMEOUT_MS + 5000),
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { success?: boolean; data?: { html?: string; markdown?: string; metadata?: { sourceURL?: string; url?: string } } };
    if (!json.success || !json.data) return null;
    return { url: json.data.metadata?.sourceURL || json.data.metadata?.url || url, html: json.data.html, markdown: json.data.markdown };
  } catch {
    return null; // Firecrawl unreachable / rate-limited → let the caller fall back to plain pages
  }
}

// Firecrawl equivalent of gatherFirmPages: render the homepage, rank the same rule links,
// render the top few. Returns null if Firecrawl couldn't get anything useful.
async function firecrawlGather(firmUrl: string, accountType: AccountType): Promise<FirmPage[] | null> {
  const home = await firecrawlScrape(firmUrl, true);
  if (!home?.html) return null;
  const base = new URL(home.url || firmUrl);
  const homeText = stripHtml(home.html);

  const links = pickRuleLinks(home.html, base, accountType, FIRECRAWL_MAX_PAGES);
  const subPages = (await Promise.all(links.map((link) => firecrawlScrape(link, false))))
    .map((page) => (page?.markdown ? { url: page.url, text: page.markdown, score: ruleScore(page.markdown) } : null))
    .filter((page): page is FirmPage => page !== null && page.text.length >= MIN_PAGE_CHARS);

  const pages = [{ url: base.href, text: homeText, score: ruleScore(homeText) }, ...subPages];
  // Only claim success if we actually recovered rule-bearing content.
  return pages.some((page) => page.score > 0) ? pages : null;
}

// Homepage + the best internal rule pages. The homepage fetch is allowed to throw
// (UnsafeUrlError / network) so the API route can surface "couldn't reach that URL";
// sub-page failures are swallowed. When the plain fetch is blocked/empty, retry the
// whole firm through Firecrawl's headless browser (if configured).
async function gatherFirmPages(firmUrl: string, accountType: AccountType): Promise<FirmPage[]> {
  const homeResponse = await fetchPublicUrl(firmUrl, { timeoutMs: PAGE_TIMEOUT_MS, maxRedirects: 5 });
  const homeHtml = await homeResponse.text();
  const base = new URL(homeResponse.url || firmUrl);
  const homeText = stripHtml(homeHtml);

  if (looksBlocked(homeResponse.status, homeText)) {
    const viaFirecrawl = await firecrawlGather(firmUrl, accountType);
    if (viaFirecrawl) return viaFirecrawl;
  }

  const links = pickRuleLinks(homeHtml, base, accountType);
  const subPages = (await Promise.all(links.map(fetchPageText))).filter((page): page is FirmPage => page !== null);

  return [{ url: base.href, text: homeText, score: ruleScore(homeText) }, ...subPages];
}

// Assemble the model corpus: rule-dense pages first, the nav-heavy homepage kept
// short and last, everything capped within an overall budget. Exported for testing.
export function buildCorpus(pages: FirmPage[]): string {
  const [home, ...rest] = pages;
  const ordered = [...rest.sort((a, b) => b.score - a.score), home].filter(Boolean);
  let budget = TOTAL_CHARS;
  const chunks: string[] = [];
  for (const page of ordered) {
    if (budget <= 0) break;
    const cap = page === home ? HOME_CHARS : PER_PAGE_CHARS;
    const slice = page.text.slice(0, Math.min(cap, budget));
    if (!slice) continue;
    chunks.push(`SOURCE: ${page.url}\n${slice}`);
    budget -= slice.length;
  }
  return chunks.join("\n\n---\n\n");
}

const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  "2step": "2-step evaluation (two phases before funding)",
  "1step": "1-step evaluation (single phase before funding)",
  instant: "instant / direct funded (no evaluation phase)",
};

function domainOf(rawUrl: string): string | null {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

// A size-dependent rule field ("profit_target"/"daily_loss_limit"/"max_drawdown") is safe
// to serve at ANY account size only when it's expressed as a percentage — the client
// converts "5%" against the user's own size. A dollar figure (or anything that isn't a
// percentage, e.g. "$500" or "N/A") is tied to the size it was captured at, so the
// requested size must match. Exported for unit testing.
export function isSizeIndependent(field: string): boolean {
  return /%/.test(field);
}

// True only when every one of the three size-dependent core fields is percentage-based.
// A MIXED set (e.g. profit_target "10%" + daily_loss_limit "$500") returns false, so a
// dollar field is never served against a size it wasn't captured at.
function coreRulesSizeIndependent(rules: ChallengeRules): boolean {
  return [rules.profit_target, rules.daily_loss_limit, rules.max_drawdown].every(isSizeIndependent);
}

// Instant cache hit for the top firms — no fetch, no model call. Serve the seed only when
// EVERY size-dependent field is percentage-based OR the requested size matches the seed's;
// otherwise a mixed dollar/percentage set could hand out dollar rules at the wrong size.
// Miss → null → live scrape.
export function seedRulesFor(input: z.infer<typeof challengeConfigSchema>): ChallengeRules | null {
  const domain = domainOf(input.firmUrl);
  if (!domain) return null;
  const entry = FIRM_RULES_SEED.find((seed) => seed.domain === domain && seed.accountType === input.accountType);
  if (!entry) return null;
  if (entry.accountSize !== input.accountSize && !coreRulesSizeIndependent(entry.rules)) return null;
  return entry.rules;
}

// Efficiency guard for the challenge-config POST: when the trader already has a stored
// config for the SAME firm domain and account type, and its three core fields are all
// percentage-based (hence size-independent — the app converts client-side), reuse the
// stored rules instead of re-running the scrape+LLM just because accountSize changed.
export function reuseStoredRules(
  prior: { firm_url: string; account_type: AccountType; rules: ChallengeRules } | null,
  input: z.infer<typeof challengeConfigSchema>,
): ChallengeRules | null {
  if (!prior) return null;
  const priorDomain = domainOf(prior.firm_url);
  if (!priorDomain || priorDomain !== domainOf(input.firmUrl)) return null;
  if (prior.account_type !== input.accountType) return null;
  if (!coreRulesSizeIndependent(prior.rules)) return null;
  return prior.rules;
}

export async function extractChallengeRules(input: z.infer<typeof challengeConfigSchema>) {
  const seeded = seedRulesFor(input);
  if (seeded) return seeded;

  const pages = await gatherFirmPages(input.firmUrl, input.accountType);
  const corpus = buildCorpus(pages);

  const result = await generateObject({
    model: getAskSimpleModel(),
    schema: challengeRulesSchema,
    prompt: `Extract the trading rules for a proprietary-trading-firm challenge from the firm's own website text below.

The trader chose the ${ACCOUNT_TYPE_LABEL[input.accountType]} with an account size of ${input.accountSize.toLocaleString()} (in whatever currency the site quotes). When a page lists several plans or sizes, extract the rules for THIS plan and size; if a rule is shared across all plans, use it.

Copy the firm's actual figures faithfully — never invent a number that isn't in the text:
- firm_name: the firm's brand name.
- daily_loss_limit: the maximum daily loss, exactly as stated (e.g. "5%" or "$5,000"). Prefer a percentage when both are shown.
- max_drawdown: the maximum overall loss / total drawdown (e.g. "10%" or "$10,000").
- profit_target: the profit needed to pass the chosen plan (e.g. "8%", "10%", "$8,000"). For a multi-step plan use the FIRST phase's target. Instant/direct plans often have none.
- min_trading_days: minimum required trading days as a number, or null if there is no minimum / it isn't stated.
- max_trading_days: the time limit in trading days as a number, or null if unlimited / not stated.
- weekend_holding: true if holding positions over the weekend is ALLOWED, false if it's prohibited.
- news_trading_allowed: true if trading during news events is ALLOWED, false if restricted or prohibited.
- other_rules: up to 6 short strings for other notable rules (consistency rule, max lot/position size, profit split/payout, inactivity, EA or copy-trading policy, drawdown type). Empty array if none stand out.

Search every SOURCE section before giving up on a field. Only use "N/A" for a string field when the value is genuinely absent from all the text.

--- WEBSITE TEXT ---
${corpus}`,
  });

  return result.object;
}
