import { anthropic } from "@ai-sdk/anthropic";
import { tool } from "ai";
import { z } from "zod";

import {
  type BrokerCard,
  type BriefingCard,
  type GuruCard,
  type AskCard,
  type AskUiMeta,
} from "@/lib/ask/contracts";
import {
  calculateMarginRequirement,
  calculateMarginRequirementInputSchema,
  calculatePipValue,
  calculatePipValueInputSchema,
  calculatePositionSizeCard,
  calculatePositionSizeInputSchema,
  calculateProfitLoss,
  calculateProfitLossInputSchema,
  calculateRiskReward,
  calculateRiskRewardInputSchema,
  normalizeForexPair,
} from "@/lib/ask/calculators";
import { getFcaStatus } from "@/lib/ask/fca";
import {
  findEntityCandidates,
  listVerifiedEntities,
  lookupVerifiedEntity,
  type EntityCandidate,
  type LookupVerifiedEntityResult,
} from "@/lib/ask/entities";
import {
  getMarketQuote,
  getMarketSeries,
  getMarketSeriesInputSchema,
  type MarketDataOptions,
} from "@/lib/ask/market";
import { formatMarketPrice } from "@/lib/ask/market-format";
import { fetchNewsEverything } from "@/lib/ask/newsdata";
import { parseSubmittedAskCardJson } from "@/lib/ask/service/card-output";
import type { AskServiceDependencies } from "@/lib/ask/service/types";
import { generateProjectionCard, generateProjectionInputSchema } from "@/lib/ask/projections";
import { generateGrowthPlanCard, generateGrowthPlanInputSchema } from "@/lib/ask/plans";
import { buildMarketSetupCard, getMarketSetupInputSchema } from "@/lib/ask/setups";
import type { EconomicCalendarSnapshot, EconomicEventItem } from "@/lib/markets/economic-calendar";
import { ECONOMIC_CALENDAR_CACHE_KEY } from "@/lib/markets/rapidapi-economic-calendar";
import { readCacheRow } from "@/lib/markets/twelve-data-adapter";

const verifyEntityInputSchema = z.object({
  name: z.string().min(1).describe("Broker, prop firm, guru, or brand name to verify."),
});

const listVerifiedEntitiesInputSchema = z.object({
  type: z
    .enum(["broker", "propfirm", "guru"])
    .describe("Which kind of reviewed entity to list."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(15)
    .optional()
    .describe("How many to return, highest trust first (default 8)."),
});

/** Anthropic requires a plain object JSON Schema; z.discriminatedUnion breaks tool registration. */
const submitAskCardInputSchema = z.object({
  card_json: z
    .string()
    .min(1)
    .describe(
      'One UI card as a JSON string. Include "type": broker | briefing | calc | guru | insight | plan | chart | setup | projection and all required fields for that type.',
    ),
  followups: z
    .array(z.string())
    .max(3)
    .optional()
    .describe(
      "2-3 short next questions the user is likely to tap, written in the user's own voice (first person), specific to this answer, each under 8 words. Omit only when no natural next question exists.",
    ),
});

const searchNewsInputSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe(
      "Search keywords for headlines (e.g. Iran oil sanctions, FOMC, ECB). Combine location + topic for geopolitics.",
    ),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe(
      "Only if the user stated a calendar start date. Omit otherwise. Must not be in the future.",
    ),
  language: z
    .string()
    .length(2)
    .optional()
    .describe("Two-letter language code, default en."),
});

const economicCalendarInputSchema = z.object({
  scope: z
    .enum(["today", "tomorrow", "week", "upcoming", "all"])
    .default("upcoming")
    .describe(
      "Calendar window to inspect. Use today for today's releases, upcoming for the next unreleased events, week for the cached weekly window.",
    ),
  impact: z
    .enum(["all", "high", "medium", "low"])
    .default("all")
    .describe("Filter by expected market impact. Use high for major events such as CPI, NFP, central-bank decisions, and rate decisions."),
  currency: z
    .string()
    .min(1)
    .max(8)
    .optional()
    .describe("Optional currency code such as USD, GBP, EUR, JPY, CAD, AUD, NZD, or CNY."),
  country: z
    .string()
    .min(2)
    .max(3)
    .optional()
    .describe("Optional country code such as US, GB, DE, JP, CA, AU, NZ, or CN."),
  query: z
    .string()
    .min(1)
    .optional()
    .describe("Optional event search term, e.g. CPI, NFP, Fed, unemployment, PMI, GDP, retail sales."),
  limit: z.number().int().min(1).max(12).default(8).describe("Maximum events to return."),
});

const MAX_NEWS_TOOL_ARTICLES = 4;
const MAX_NEWS_DESCRIPTION_CHARS = 160;
const MAX_CALENDAR_TOOL_EVENTS = 12;

function buildInsightCard(headline: string, body: string, verdict: string): AskCard {
  return {
    type: "insight",
    headline,
    body,
    verdict,
  };
}

function truncateNewsDescription(value: string | null | undefined) {
  const normalized = value?.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }
  if (normalized.length <= MAX_NEWS_DESCRIPTION_CHARS) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_NEWS_DESCRIPTION_CHARS - 1).trimEnd()}…`;
}

async function getCachedEconomicCalendarSnapshot() {
  const cached = await readCacheRow<EconomicCalendarSnapshot>(ECONOMIC_CALENDAR_CACHE_KEY);
  return cached?.payload ?? null;
}

function getDateKeyUtc(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date: Date, days: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

function normalizeCalendarSearch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function eventMatchesQuery(item: EconomicEventItem, query: string | undefined) {
  if (!query) {
    return true;
  }

  const normalizedQuery = normalizeCalendarSearch(query);
  if (!normalizedQuery) {
    return true;
  }

  const aliases: Record<string, string[]> = {
    cpi: ["cpi", "consumer price index", "inflation"],
    nfp: ["nfp", "nonfarm payroll", "non farm payroll", "payroll"],
    fed: ["fed", "fomc", "federal reserve", "rate decision"],
    boe: ["boe", "bank of england", "rate decision"],
    ecb: ["ecb", "european central bank", "rate decision"],
    pmi: ["pmi", "purchasing managers"],
    gdp: ["gdp", "gross domestic product"],
  };
  const expandedTerms = aliases[normalizedQuery] ?? [normalizedQuery];
  const haystack = normalizeCalendarSearch(
    [item.event, item.currency, item.country, item.period ?? "", item.source ?? ""].join(" "),
  );

  return expandedTerms.some((term) => haystack.includes(term));
}

function eventMatchesScope(item: EconomicEventItem, scope: z.infer<typeof economicCalendarInputSchema>["scope"], now: Date) {
  if (scope === "all" || scope === "week") {
    return true;
  }

  const eventDate = item.timeUtc.slice(0, 10);
  if (scope === "today") {
    return eventDate === getDateKeyUtc(now);
  }
  if (scope === "tomorrow") {
    return eventDate === getDateKeyUtc(addUtcDays(now, 1));
  }

  const eventMs = new Date(item.timeUtc).getTime();
  return Number.isFinite(eventMs) && eventMs >= now.getTime();
}

function formatTimeUntil(timeUtc: string, now: Date) {
  const eventMs = new Date(timeUtc).getTime();
  if (!Number.isFinite(eventMs)) {
    return null;
  }
  const diffMs = eventMs - now.getTime();
  if (diffMs <= 0) {
    return "released";
  }
  const totalMinutes = Math.max(0, Math.floor(diffMs / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) {
    return `${minutes}m`;
  }
  return `${hours}h ${minutes}m`;
}

function serializeCalendarEvent(item: EconomicEventItem, now: Date) {
  return {
    event: item.event,
    timeUtc: item.timeUtc,
    timeLabel: item.timeLabel,
    timeUntil: formatTimeUntil(item.timeUtc, now),
    country: item.country,
    currency: item.currency,
    impact: item.impact,
    actual: item.actual ?? null,
    forecast: item.forecast ?? null,
    previous: item.previous ?? null,
    status: item.actual ? "released" : "scheduled",
    period: item.period ?? null,
    source: item.source ?? null,
  };
}

function findNextHighImpactEvent(items: EconomicEventItem[], now: Date) {
  const nowMs = now.getTime();
  let nextEvent: EconomicEventItem | null = null;
  let nextMs = Number.POSITIVE_INFINITY;
  for (const item of items) {
    if (item.impact !== "high") {
      continue;
    }
    const eventMs = new Date(item.timeUtc).getTime();
    if (Number.isFinite(eventMs) && eventMs >= nowMs && eventMs < nextMs) {
      nextEvent = item;
      nextMs = eventMs;
    }
  }
  return nextEvent;
}

function buildEconomicCalendarToolResult(
  snapshot: EconomicCalendarSnapshot | null,
  input: z.infer<typeof economicCalendarInputSchema>,
) {
  const now = new Date();
  if (!snapshot?.items?.length) {
    return {
      updatedAt: snapshot?.updatedAt ?? null,
      now: now.toISOString(),
      from: snapshot?.from ?? null,
      to: snapshot?.to ?? null,
      filters: input,
      nextHighImpactEvent: null,
      events: [],
      totalMatched: 0,
      note: "Economic calendar cache is empty. Ask the trader to refresh the Markets calendar after the cron warms the cache.",
    };
  }

  const impact = input.impact ?? "all";
  const currency = input.currency?.trim().toUpperCase();
  const country = input.country?.trim().toUpperCase();
  const scope = input.scope ?? "upcoming";
  const limit = Math.min(input.limit ?? 8, MAX_CALENDAR_TOOL_EVENTS);
  const sorted = snapshot.items.toSorted((a, b) => a.timeUtc.localeCompare(b.timeUtc));
  const nextHighImpactEvent = findNextHighImpactEvent(sorted, now);
  const events = sorted.filter((item) => {
    if (!eventMatchesScope(item, scope, now)) {
      return false;
    }
    if (impact !== "all" && item.impact !== impact) {
      return false;
    }
    if (currency && item.currency.toUpperCase() !== currency) {
      return false;
    }
    if (country && item.country.toUpperCase() !== country) {
      return false;
    }
    return eventMatchesQuery(item, input.query);
  });

  return {
    updatedAt: snapshot.updatedAt,
    now: now.toISOString(),
    from: snapshot.from ?? null,
    to: snapshot.to ?? null,
    filters: {
      scope,
      impact,
      currency: currency ?? null,
      country: country ?? null,
      query: input.query ?? null,
      limit,
    },
    nextHighImpactEvent: nextHighImpactEvent ? serializeCalendarEvent(nextHighImpactEvent, now) : null,
    events: events.slice(0, limit).map((item) => serializeCalendarEvent(item, now)),
    totalMatched: events.length,
    note:
      events.length > 0
        ? "Use forecast, previous, actual, impact, and timing to explain trade risk. Do not invent missing actual values."
        : "No matching events found in the cached calendar window.",
  };
}

function buildBrokerCard(
  lookup: LookupVerifiedEntityResult,
  fcaStatus: Awaited<ReturnType<typeof getFcaStatus>>,
): BrokerCard | null {
  const hint = lookup.brokerCardHint;
  const entity = lookup.entity;
  if (!hint || !entity) {
    return null;
  }

  let status = hint.status;
  let fca = hint.fca;

  // For a firm we already class as avoid, a live FCA name-search usually hits a
  // same-name or clone entity, so don't let it upgrade FCA standing or surface
  // its note.
  const dbDistrusted = entity.status === "avoid" || entity.band === "Avoid";

  if (fcaStatus.authorised === false) {
    fca = "No";
    if (status === "LEGITIMATE") {
      status = "WARNING";
    }
  } else if (fcaStatus.authorised === true && !dbDistrusted) {
    fca = "Yes";
  }

  if (fcaStatus.warning === true) {
    status = "WARNING";
  }

  // Founder note wins, then the live FCA text, then our reviewed note.
  const fcaText = dbDistrusted ? null : fcaStatus.note ?? fcaStatus.statusText;
  const verdict = hint.founderNote || fcaText || entity.notes;

  return {
    type: "broker",
    name: hint.name,
    score: hint.score,
    status,
    fca,
    complaints: hint.complaints,
    verdict,
    color: hint.color,
  };
}

function buildPropFirmCard(lookup: LookupVerifiedEntityResult): BrokerCard | null {
  const hint = lookup.propFirmCardHint;
  const entity = lookup.entity;
  if (!hint || !entity) {
    return null;
  }

  // This card is type "broker", so the pipeline always re-synthesizes the verdict
  // from the structured facts (score, band, Trustpilot — all in propFirmUiMeta).
  // So we pass curated text or a terse fact, never hand-written prose; the model
  // writes the natural line and keeps the numbers.
  const verdict = hint.closed
    ? hint.founderNote || entity.notes || "Closed down — avoid depositing."
    : hint.notRated
      ? "Not enough public data to rate yet."
      : hint.founderNote || entity.notes || "Reviewed prop firm.";

  return {
    type: "broker",
    name: hint.name,
    score: hint.score,
    status: hint.status,
    fca: "No",
    complaints: hint.complaints,
    verdict,
    color: hint.color,
  };
}

function propFirmUiMeta(lookup: LookupVerifiedEntityResult): AskUiMeta {
  const hint = lookup.propFirmCardHint;
  const trustpilot = hint?.trustpilot ?? null;
  return {
    verificationKind: "propfirm",
    verificationSourceLabel: "Reviewed record",
    // Optional fields left undefined are omitted on serialize.
    propFirm: {
      band: hint?.band ?? undefined,
      notRated: hint?.notRated ? true : undefined,
      trustpilotRating: trustpilot?.rating,
      trustpilotCount: trustpilot?.count ?? undefined,
      trustpilotDate: trustpilot?.date ?? undefined,
    },
  };
}

function buildGuruCard(lookup: LookupVerifiedEntityResult): GuruCard | null {
  const hint = lookup.guruCardHint;
  const entity = lookup.entity;
  if (!hint || !entity) {
    return null;
  }

  // bio_summary is the public-facing body, gated on research completeness and a
  // confirmed identity (no longer on a separate founder-review flag). Internal
  // founder notes are never loaded into the entity, so they cannot reach the card.
  return {
    type: "guru",
    name: hint.name,
    tier: hint.tier,
    trackRecord: hint.trackRecord,
    citationUrl: hint.tier === "Caution" ? hint.citationUrl : null,
    verdict: entity.bioSummary || entity.notes || "No documented regulatory action found.",
  };
}

function extractHostnameLabel(hostname: string) {
  const labels = hostname.toLowerCase().split(".").flatMap((label) => {
    const trimmed = label.trim();
    return trimmed ? [trimmed] : [];
  });

  if (labels.length === 0) {
    return null;
  }

  const filtered = labels.filter((label) => !["www", "m", "app"].includes(label));
  if (filtered.length === 0) {
    return null;
  }

  if (
    filtered.length >= 3 &&
    filtered.at(-1)?.length === 2 &&
    ["co", "com", "org", "net"].includes(filtered.at(-2) ?? "")
  ) {
    return filtered.at(-3) ?? null;
  }

  return filtered.length >= 2 ? (filtered.at(-2) ?? null) : filtered[0];
}

function humanizeEntityName(value: string) {
  const withSpaces = value
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([a-z])(?=(funded|markets|market|trading|capital|forex|funding|broker|group)\b)/gi, "$1 ")
    .trim();

  return withSpaces
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeVerificationName(name: string) {
  const trimmed = name.trim();
  const urlMatch = trimmed.match(/https?:\/\/[^\s]+|www\.[^\s]+/i);

  if (!urlMatch) {
    return {
      lookupName: trimmed,
      displayName: trimmed,
      fromUrl: false,
    };
  }

  try {
    const candidate = urlMatch[0].startsWith("http") ? urlMatch[0] : `https://${urlMatch[0]}`;
    const url = new URL(candidate);
    const hostnameLabel = extractHostnameLabel(url.hostname);

    if (!hostnameLabel) {
      return {
        lookupName: trimmed,
        displayName: trimmed,
        fromUrl: true,
      };
    }

    const displayName = humanizeEntityName(hostnameLabel);

    return {
      lookupName: hostnameLabel,
      displayName,
      fromUrl: true,
    };
  } catch {
    return {
      lookupName: trimmed,
      displayName: trimmed,
      fromUrl: true,
    };
  }
}

function formatChange(value: number) {
  return `${value >= 0 ? "+" : "-"}${Math.abs(value).toFixed(2)}%`;
}

function buildBriefingCard(
  quote: Awaited<ReturnType<typeof getMarketQuote>>,
  series: Awaited<ReturnType<typeof getMarketSeries>>,
): { card: BriefingCard; uiMeta: AskUiMeta } {
  const rangeLow = series.support;
  const rangeHigh = series.resistance;
  const rangeRatio =
    rangeHigh > rangeLow ? (rangeHigh - rangeLow) / Math.max(Math.abs(quote.price), 1) : 0;
  const isAboveRangeHigh = quote.price > rangeHigh;
  const isBelowRangeLow = quote.price < rangeLow;
  const verdict =
    rangeRatio < 0.0015
      ? `${quote.asset} is compressed inside the recent range. Wait for a clean break before choosing a side.`
      : isAboveRangeHigh
        ? `${quote.asset} is trading above the recent range high. Watch for acceptance above the breakout or a slip back inside the range.`
      : isBelowRangeLow
        ? `${quote.asset} is trading below the recent range low. Watch for follow-through lower or a quick reclaim back into the range.`
      : quote.direction === "up"
        ? `${quote.asset} is pushing toward the recent range high. Watch for continuation if that breaks.`
        : `${quote.asset} is leaning back toward the recent range low. Watch for follow-through if that gives way.`;

  const card: BriefingCard = {
    type: "briefing",
    asset: quote.asset,
    price: formatMarketPrice(quote.price, quote),
    change: formatChange(quote.changePercent),
    direction: quote.direction,
    level1: formatMarketPrice(rangeHigh, series),
    level2: formatMarketPrice(rangeLow, series),
    event: null,
    verdict,
  };

  return {
    card,
    uiMeta: {
      marketSeries: series.closeValues,
      marketLevelScopeLabel: "Recent range",
    },
  };
}

function withCard(card: AskCard, uiMeta?: AskUiMeta) {
  return uiMeta ? { card, uiMeta } : { card };
}

type VerificationToolResponse =
  | ReturnType<typeof withCard>
  | {
      fcaData: {
        queriedName: string;
        frn: string | null;
        statusText: string | null;
        authorised: boolean | null;
        warning: boolean | null;
        note: string | null;
        source: string;
      };
    }
  | { coverage: CoverageEvidence };

/**
 * No confident record for the queried name. We hand the model the facts — the
 * closest LABELLED candidates and their standing — and it writes the reply
 * (ask for the exact name, or "did you mean X?"). It must never treat a
 * candidate as a confirmed verdict; that is enforced in the prompt.
 */
interface CoverageEvidence {
  queriedName: string;
  fromUrl: boolean;
  /** Closest brands on file, each a suggestion only — never the queried name. */
  candidates: Array<{
    name: string;
    /** "lookalike" = shares a distinctive word; "similar" = close spelling. */
    match: EntityCandidate["label"];
    type: string;
    /** Why it's notable, e.g. "regulator warning on file", "rated Avoid". */
    standing: string;
  }>;
}

function candidateStanding(candidate: EntityCandidate): string {
  if (candidate.entity.guruTier === "Caution") return "regulator warning on file";
  if (candidate.entity.status === "avoid") return "rated Avoid";
  if (candidate.entity.status === "warning") return "flagged";
  return "reviewed record on file";
}

async function coverageEvidence(
  queriedName: string,
  fromUrl: boolean,
): Promise<{ coverage: CoverageEvidence }> {
  const candidates = await findEntityCandidates(queriedName);
  return {
    coverage: {
      queriedName,
      fromUrl,
      candidates: candidates.map((candidate) => ({
        name: candidate.entity.name,
        match: candidate.label,
        type: candidate.entity.type,
        standing: candidateStanding(candidate),
      })),
    },
  };
}

const askLiveMarketOptions = { live: true } as const satisfies MarketDataOptions;

async function enrichPositionSizeInput(
  toolInput: z.input<typeof calculatePositionSizeInputSchema>,
  getMarketQuoteImpl: (asset: string, options?: MarketDataOptions) => ReturnType<typeof getMarketQuote>,
) {
  if (!toolInput.pair || toolInput.pipValuePerLot || toolInput.quoteToAccountRate || toolInput.exchangeRate) {
    return toolInput;
  }

  const { base, quote } = normalizeForexPair(toolInput.pair);
  const accountCurrency = toolInput.accountCurrency ?? "GBP";

  if (accountCurrency === quote) {
    return toolInput;
  }

  const conversionPair = accountCurrency === base ? toolInput.pair : `${quote}/${accountCurrency}`;
  const quoteData = await getMarketQuoteImpl(conversionPair).catch(async (error: unknown) => {
    if (accountCurrency === base) {
      throw error;
    }

    const inverseQuote = await getMarketQuoteImpl(`${accountCurrency}/${quote}`);
    return {
      ...inverseQuote,
      price: 1 / inverseQuote.price,
    };
  });

  return {
    ...toolInput,
    ...(accountCurrency === base
      ? { exchangeRate: quoteData.price }
      : { quoteToAccountRate: quoteData.price }),
  };
}

function buildPipValueCard(result: ReturnType<typeof calculatePipValue>): AskCard {
  return buildInsightCard(
    "Pip Value",
    `${result.lotSize} lot on ${result.pair} moves ${result.currency} ${result.pipValue.toFixed(2)} per pip.`,
    "Use that number before sizing the trade.",
  );
}

function buildMarginCard(result: ReturnType<typeof calculateMarginRequirement>): AskCard {
  return buildInsightCard(
    "Margin Needed",
    `${result.lotSize} lot on ${result.pair} needs ${result.currency} ${result.marginRequired.toFixed(2)} margin.`,
    "Check free margin before you open the trade.",
  );
}

function buildRiskRewardCard(result: ReturnType<typeof calculateRiskReward>): AskCard {
  return buildInsightCard(
    "Risk Reward",
    `Risk is ${result.riskDistance}. Reward is ${result.rewardDistance}. Reward-to-risk is ${result.ratio.toFixed(2)}:1 (${result.ratio.toFixed(2)}R).`,
    "Take it only if the reward still justifies the setup.",
  );
}

function buildProfitLossCard(result: ReturnType<typeof calculateProfitLoss>): AskCard {
  return buildInsightCard(
    "Profit Or Loss",
    `${result.direction} ${result.pair} gives ${result.currency} ${result.profitLoss.toFixed(2)} over ${result.pipsMoved.toFixed(1)} pips.`,
    "Judge the trade on risk first, not payout.",
  );
}

export function createAskTools(dependencies: AskServiceDependencies) {
  const getMarketQuoteImpl =
    dependencies.getMarketQuoteImpl ?? ((asset: string) => getMarketQuote(asset, askLiveMarketOptions));
  const getMarketSeriesImpl =
    dependencies.getMarketSeriesImpl ?? ((asset: string, timeframe) =>
      getMarketSeries(asset, timeframe, askLiveMarketOptions));
  const fetchNewsEverythingImpl =
    dependencies.fetchNewsEverythingImpl ?? fetchNewsEverything;
  const getEconomicCalendarSnapshotImpl =
    dependencies.getEconomicCalendarSnapshotImpl ?? getCachedEconomicCalendarSnapshot;

  return {
    verify_entity: tool({
      description:
        "Verify a SINGLE named broker, prop firm, or trading guru. Use this for legitimacy, safety-to-deposit, regulation, complaints, or trust checks on a specific firm. It returns reviewed entity data plus live FCA confirmation as EVIDENCE — it is not your reply. After calling it you must still call submit_ask_card with the final card (echo the exact score and status) and 2-3 followups. Never end your turn on the raw verify_entity result.",
      inputSchema: verifyEntityInputSchema,
      execute: async ({ name }) => resolveVerificationToolResult(name, dependencies),
    }),
    list_verified_entities: tool({
      description:
        "List the top reviewed brokers, prop firms, or trading gurus from our database, ranked by trust score. Use this whenever the user asks for the top / best / safest / recommended ones, or 'which … are good', or to list them, and has NOT named a specific firm. For a single named firm use verify_entity instead. Summarize the returned list in your own words: lead with the highest-trust names, give each a quick reason, and flag any marked avoid.",
      inputSchema: listVerifiedEntitiesInputSchema,
      execute: async ({ type, limit }) => ({
        entities: await listVerifiedEntities(type, limit ?? 8),
      }),
    }),
    get_market_briefing: tool({
      description:
        "Live price, levels, and series for a tradable. Use it for direct market-status questions like what is X doing or price now. Not for headline-only questions, and not as the final answer for best-trade-now or trade-ranking questions. Do not call it twice for equivalent assets such as BTC/USD and Bitcoin in the same answer.",
      inputSchema: getMarketSeriesInputSchema,
      execute: async ({ asset, timeframe }) => {
        const [quote, series] = await Promise.all([
          getMarketQuoteImpl(asset),
          getMarketSeriesImpl(asset, timeframe),
        ]);

        return {
          ...buildBriefingCard(quote, series),
        };
      },
    }),
    get_market_setup: tool({
      description:
        "Live setup for explicit entry questions: buy, sell, long, short, stop, target, invalidation. Use it when the user asks for live levels, not for generic education or broad market comparisons. After using it for conversational asks like 'set up a buy trade on gold', submit a final setup card in trader language instead of just echoing the raw tool output.",
      inputSchema: getMarketSetupInputSchema,
      execute: async ({ asset, timeframe, side }) => {
        const [quote, series] = await Promise.all([
          getMarketQuoteImpl(asset),
          getMarketSeriesImpl(asset, timeframe),
        ]);

        return {
          ...buildMarketSetupCard(quote, series, side),
        };
      },
    }),
    search_news: tool({
      description:
        "Recent headlines with descriptions (NewsData). Use it for macro reactions, geopolitics, policy, earnings, sector themes, or deeper context after a scheduled event is known. Use get_economic_calendar for scheduled event timing and actual/forecast/previous values. Optional from date only if the user stated it. Read the descriptions for context, not just titles. Use the result to explain market impact, and submit the final card yourself instead of echoing raw headlines. For broad market-trend prompts, run one focused search only and do not retry with another generic market query.",
      inputSchema: searchNewsInputSchema,
      execute: async (input) => {
        try {
          const result = await fetchNewsEverythingImpl({
            query: input.query,
            from: input.from,
            language: input.language,
          });
          return {
            query: result.query,
            articles: result.articles.slice(0, MAX_NEWS_TOOL_ARTICLES).map((a) => ({
              title: a.title,
              description: truncateNewsDescription(a.description),
              source: a.source,
            })),
            note: result.note,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : "News search failed.";
          return {
            query: input.query,
            articles: [],
            note: message,
          };
        }
      },
    }),
    // Server-side Claude web tools: live web, no key or quota, for anything our own data doesn't cover.
    // Basic (single-round) variants, capped at one use each — the _20260209 dynamic-filtering variants
    // run multiple server-side code-execution rounds and pushed one entity lookup to ~35s+. One search
    // returns in ~5-8s and is enough to answer; the cap keeps every turn fast and cheap.
    web_search: anthropic.tools.webSearch_20250305({
      maxUses: 1,
      userLocation: { type: "approximate", country: "GB" },
    }),
    web_fetch: anthropic.tools.webFetch_20250910({
      maxUses: 1,
      citations: { enabled: true },
    }),
    get_economic_calendar: tool({
      description:
        "Cached economic calendar events for scheduled macro releases. Use this for questions like economic calendar today/this week, what high-impact events are next, CPI/NFP/Fed timings, USD/GBP/EUR events, and what a release means for FX pairs or Gold. This reads the cached calendar only; do not use it for breaking-news reactions.",
      inputSchema: economicCalendarInputSchema,
      execute: async (input) => buildEconomicCalendarToolResult(await getEconomicCalendarSnapshotImpl(), input),
    }),
    calculate_position_size: tool({
      description:
        "Calculate the exact position size card for a risk-based lot size question. Use it only when account size, risk percent, and stop loss in pips are known or can be recovered from recent history. If the user labels a cash amount as risk, do not reinterpret it as account size. If account size or risk percent is missing or ambiguous, ask for that one value instead of forcing a calc. In broader questions, use the result as support and still synthesize the final card.",
      inputSchema: calculatePositionSizeInputSchema,
      execute: async (toolInput) =>
        withCard(calculatePositionSizeCard(await enrichPositionSizeInput(toolInput, getMarketQuoteImpl))),
    }),
    calculate_risk_reward: tool({
      description:
        "Calculate risk-reward ratio from pips or from entry, stop, and target prices. Use it when the user gives either riskPips plus rewardPips, or entryPrice plus stopPrice plus targetPrice. Do not invent missing prices or distances. In mixed questions, treat this as evidence, not the whole final answer.",
      inputSchema: calculateRiskRewardInputSchema,
      execute: async (toolInput) => {
        const result = calculateRiskReward(toolInput);
        return withCard(buildRiskRewardCard(result));
      },
    }),
    calculate_pip_value: tool({
      description:
        "Calculate forex pip value using pair and lot size, with optional currency conversion inputs. Use it for pip-value questions when the pair and lot size are known. If lot size is missing, ask for it. In mixed questions, treat this as evidence, not the whole final answer.",
      inputSchema: calculatePipValueInputSchema,
      execute: async (toolInput) => {
        const result = calculatePipValue(toolInput);
        return withCard(buildPipValueCard(result));
      },
    }),
    calculate_margin_required: tool({
      description:
        "Calculate required margin from pair, lot size, and leverage or margin rate. If price is missing, this tool may use the current live market price for the pair. Use it for margin questions, not for general market briefings. In mixed questions, treat this as evidence, not the whole final answer.",
      inputSchema: calculateMarginRequirementInputSchema,
      execute: async (toolInput) => {
        const price = toolInput.price ?? (await getMarketQuoteImpl(toolInput.pair)).price;
        const result = calculateMarginRequirement({
          ...toolInput,
          price,
        });

        return withCard(buildMarginCard(result));
      },
    }),
    calculate_profit_loss: tool({
      description:
        "Calculate profit or loss from pair, entry price, exit price, direction, and lot size. Use it when those values are known. Do not invent missing trade prices or direction. In mixed questions, treat this as evidence, not the whole final answer.",
      inputSchema: calculateProfitLossInputSchema,
      execute: async (toolInput) => {
        const result = calculateProfitLoss(toolInput);
        return withCard(buildProfitLossCard(result));
      },
    }),
    generate_projection: tool({
      description:
        "Generate the full projection card for account growth and compounding questions. Requires months and startBalance. If return or drawdown assumptions are missing, it can still answer with sensible defaults, but the verdict must clearly separate user-supplied assumptions from assumed ones. Always pass currencySymbol when the user's message contains a currency marker ($, £, or €) so the card and chart display the correct symbol.",
      inputSchema: generateProjectionInputSchema,
      execute: async (toolInput) => withCard(generateProjectionCard(toolInput)),
    }),
    generate_growth_plan: tool({
      description:
        "Generate a realistic trading growth plan for account-target questions such as daily, weekly, and monthly goals. Use it when the user gives a balance and asks what to aim for, optionally with a monthly top-up or projection horizon.",
      inputSchema: generateGrowthPlanInputSchema,
      execute: async (toolInput) => withCard(generateGrowthPlanCard(toolInput)),
    }),
    submit_ask_card: tool({
      description:
        "Final card submission for the actual answer the user should see. After search_news: use insight, or setup if the user asked for a trade plan and you also used get_market_setup. After get_market_briefing: use briefing only for direct market-status asks, otherwise use insight or setup. After get_market_setup: use setup. After generate_growth_plan: use plan. After calcs: use calc or insight. For mixed multi-topic questions, synthesize one final insight card instead of stopping at a raw tool card. card_json = stringified card.",
      inputSchema: submitAskCardInputSchema,
      execute: async ({ card_json, followups }) => {
        return { card: parseSubmittedAskCardJson(card_json), followups };
      },
    }),
  };
}

export type AskToolSet = ReturnType<typeof createAskTools>;

async function resolveVerificationToolResult(
  name: string,
  dependencies: AskServiceDependencies,
): Promise<VerificationToolResponse> {
  const lookupVerifiedEntityImpl =
    dependencies.lookupVerifiedEntityImpl ?? lookupVerifiedEntity;
  const getFcaStatusImpl = dependencies.getFcaStatusImpl ?? getFcaStatus;

  const normalized = normalizeVerificationName(name);
  const lookup = await lookupVerifiedEntityImpl(normalized.lookupName);

  if (lookup.found && lookup.entity) {
    if (lookup.entity.type === "guru") {
      const card = buildGuruCard(lookup);
      if (card) return withCard(card);
    } else if (lookup.entity.type === "propfirm") {
      const card = buildPropFirmCard(lookup);
      if (card) return withCard(card, propFirmUiMeta(lookup));
    } else {
      const fcaStatus = await getFcaStatusImpl({
        name: lookup.entity.name,
        frn: lookup.entity.fcaReference ?? undefined,
      });
      const card = buildBrokerCard(lookup, fcaStatus);
      if (card) {
        return withCard(card, {
          verificationKind: "broker",
          verificationSourceLabel: fcaStatus.available ? "Live FCA confirmed" : "Reviewed record",
        });
      }
    }
  } else if (!normalized.fromUrl) {
    // A plain name we don't hold — check the live FCA register before giving up.
    const fcaStatus = await getFcaStatusImpl({ name: normalized.lookupName, frn: undefined });
    if (fcaStatus.available && fcaStatus.statusText) {
      return {
        fcaData: {
          queriedName: fcaStatus.queriedName,
          frn: fcaStatus.frn,
          statusText: fcaStatus.statusText,
          authorised: fcaStatus.authorised,
          warning: fcaStatus.warning,
          note: fcaStatus.note,
          source: fcaStatus.source,
        },
      };
    }
  }

  // No confident record: hand the model the closest labelled candidates and let
  // it write the reply ("did you mean X?" or ask for the exact name).
  return coverageEvidence(normalized.fromUrl ? normalized.displayName : normalized.lookupName, normalized.fromUrl);
}
