import { tool } from "ai";
import { after } from "next/server";
import { z } from "zod";

import { getAskWebSearchTool } from "@/lib/ask/service/provider";

import {
  httpUrlSchema,
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
import { btsVerificationGate } from "@/lib/compare/bts-research";
import { cardStatus, DATABASE_ONLY, countryName, statusColor } from "@/lib/compare/bts";
import { regulationLabel } from "@/lib/compare/regulators";
import { getBtsAskContext, getBtsAskContextByBrand, getRequestCountrySafe, listBtsRanked, type BtsAskContext } from "@/lib/compare/bts-data";
import { getL2Assessment, isDisputed, type L2Result, type L2Subject } from "@/lib/compare/bts-l2";
import {
  findEntityCandidates,
  listVerifiedEntities,
  lookupVerifiedEntity,
  normalizeEntityText,
  upsertDevelopingPropFirm,
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
import { formatChange } from "@/lib/markets/twelve-markets-data";

const verifyEntityInputSchema = z.object({
  name: z.string().min(1).describe("Broker, prop firm, guru, or brand name to verify."),
  country: z
    .string()
    .length(2)
    .optional()
    .describe("ISO country code ONLY when the user asks about a specific country (e.g. 'is IG safe in South Africa' -> ZA). Omit it to use the user's own country."),
});

const persistDiscoveredPropFirmInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  confirmed: z
    .array(
      z.object({
        text: z.string().trim().min(1).max(500),
        sourceLabel: z.string().trim().min(1).max(120),
        // Same http(s)-only rule the DB reader and render boundary enforce.
        sourceUrl: httpUrlSchema,
      }),
    )
    .min(1)
    .max(5),
  unconfirmed: z.array(z.string().trim().min(1).max(500)).max(5).optional(),
  reverifyTrigger: z.string().trim().min(1).max(500).optional(),
  trustpilot: z
    .object({
      rating: z.number().min(0).max(5),
      count: z.number().int().nonnegative(),
      date: z.iso.date().optional(),
    })
    .optional(),
});

const listVerifiedEntitiesInputSchema = z.object({
  type: z
    .enum(["broker", "propfirm", "guru"])
    .describe("Which kind of reviewed entity to list."),
  country: z
    .string()
    .length(2)
    .optional()
    .describe("ISO country code ONLY when the user asks for a specific country (e.g. 'best brokers in South Africa' -> ZA). Omit it to use the user's own country."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(15)
    .optional()
    .describe("How many research candidates to inspect; show only 2 or 3 relevant options to the trader."),
  instruments: z.array(z.string().trim().min(1)).optional().describe("Trading instruments stated by the trader, required for broker and prop-firm discovery."),
});

/** Tool registration requires a plain object JSON Schema; z.discriminatedUnion breaks it. */
const submitAskCardInputSchema = z.object({
  card_json: z
    .string()
    .min(1)
    .describe(
      'One UI card as a JSON string with exactly these fields for its type (no others; strings unless noted): ' +
        'insight {type,headline,body,verdict} | ' +
        'broker {type,name,score,status:"LEGITIMATE"|"CAUTION"|"WARNING"|"AVOID",fca:"Yes"|"No",complaints:"Low"|"Medium"|"High"|"None found"|"On record"|"Not checked",verdict,color:"green"|"amber"|"red"} | ' +
        'guru {type,name,tier:"Verified"|"Unverified"|"Caution",trackRecord,citationUrl(string|null),verdict} | ' +
        'briefing {type,asset,price,change,direction:"up"|"down",level1,level2,event(string|null),verdict} | ' +
        'setup {type,asset,bias:"Bullish"|"Bearish"|"Neutral",entry,stop,target,rr,rationale,confidence:"High"|"Medium"|"Low",verdict} | ' +
        'chart {type,pattern,bias,entry,stop,target,rr,confidence,verdict} | ' +
        'calc, plan and projection: copy the card the matching tool returned.',
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

const CALENDAR_QUERY_ALIASES: Record<string, string[]> = {
  cpi: ["cpi", "consumer price index", "inflation"],
  nfp: ["nfp", "nonfarm payroll", "non farm payroll", "payroll"],
  fed: ["fed", "fomc", "federal reserve", "rate decision"],
  boe: ["boe", "bank of england", "rate decision"],
  ecb: ["ecb", "european central bank", "rate decision"],
  pmi: ["pmi", "purchasing managers"],
  gdp: ["gdp", "gross domestic product"],
};

function eventMatchesQuery(item: EconomicEventItem, query: string | undefined) {
  if (!query) {
    return true;
  }

  const normalizedQuery = normalizeEntityText(query);
  if (!normalizedQuery) {
    return true;
  }

  const expandedTerms = CALENDAR_QUERY_ALIASES[normalizedQuery] ?? [normalizedQuery];
  const haystack = normalizeEntityText(
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
  const fallbackVerdict =
    status === "LEGITIMATE"
      ? "Our reviewed record lists this broker as legitimate. Check the regulator register before depositing."
      : status === "WARNING"
        ? "Our reviewed record flags this broker for caution. Check the regulator register before depositing."
        : "Our reviewed record flags this broker to avoid.";
  const verdict = hint.founderNote || fcaText || entity.notes || fallbackVerdict;

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
  const cardFacts = hint?.cardFacts ?? null;
  // One authoritative "developing" decision, computed here and threaded through
  // uiMeta, so the card, the badge label, and the score state can't disagree.
  const developing = Boolean(
    hint?.researchStatus || cardFacts?.confirmed.length || cardFacts?.unconfirmed.length,
  );
  return {
    verificationKind: "propfirm",
    // A developing record must never carry the reassuring "Reviewed record" badge;
    // the label is pure presentation derived from the developing flag.
    verificationSourceLabel: developing ? "Not yet scoreable" : "Reviewed record",
    // Optional fields left undefined are omitted on serialize.
    propFirm: {
      band: hint?.band ?? undefined,
      notRated: hint?.notRated ? true : undefined,
      developing: developing || undefined,
      trustpilotRating: trustpilot?.rating,
      trustpilotCount: trustpilot?.count ?? undefined,
      trustpilotDate: trustpilot?.date ?? undefined,
      researchStatus: hint?.researchStatus ?? undefined,
      confirmedFacts: cardFacts?.confirmed.map((fact) => ({
        text: fact.text,
        sourceLabel: fact.sourceLabel ?? undefined,
        sourceUrl: fact.sourceUrl ?? undefined,
      })),
      unconfirmedClaims: cardFacts?.unconfirmed,
      reverifyTrigger: cardFacts?.footer ?? undefined,
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

/** Any verification result can carry the BTS engine's evidence for the firm. */
type VerificationToolResponse = (
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
  | { coverage: CoverageEvidence }
) & { bts?: CheckedBts };

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
  if (candidate.entity.type === "guru") {
    if (candidate.entity.guruTier === "Caution") return "regulator warning on file";
    return "reviewed record on file";
  }
  // Brokers and prop firms: the verdict comes from the BTS engine via verify_entity, not old record fields.
  return "record on file; call verify_entity for its verdict";
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
  // Ask reads through the shared TTL cache (Twelve Data primary, FMP fallback) rather than
  // hammering the provider live on every turn — a market briefing at most 60s old is fine, and
  // this is what stopped the FMP 429s from repeated/rapid asks re-fetching the same symbol.
  const getMarketQuoteImpl = dependencies.getMarketQuoteImpl ?? getMarketQuote;
  const getMarketSeriesImpl = dependencies.getMarketSeriesImpl ?? getMarketSeries;
  const fetchNewsEverythingImpl =
    dependencies.fetchNewsEverythingImpl ?? fetchNewsEverything;
  const getEconomicCalendarSnapshotImpl =
    dependencies.getEconomicCalendarSnapshotImpl ?? getCachedEconomicCalendarSnapshot;

  const discoveryCandidates = new Set<string>();
  const checkedCandidates = new Set<string>();
  return {
    verify_entity: tool({
      description:
        "Verify a SINGLE named broker, prop firm, or trading guru. Use this for legitimacy, safety-to-deposit, regulation, complaints, or trust checks on a specific firm. Pass the name EXACTLY as the user wrote it — the resolver already handles misspellings, spacing, and run-together words, so never correct it, normalize it, or substitute a different/similar-looking firm name you guessed. It returns reviewed entity data plus live FCA confirmation as EVIDENCE — it is not your reply. After calling it you must still call submit_ask_card with the final card (echo the exact score and status) and 2-3 followups. Never end your turn on the raw verify_entity result.",
      inputSchema: verifyEntityInputSchema,
      execute: async ({ name, country }) => {
        const result = await resolveVerificationToolResult(name, dependencies, country ?? dependencies.brokerPreferences?.country ?? dependencies.country);
        checkedCandidates.add(name.toLowerCase());
        return result;
      },
    }),
    persist_discovered_prop_firm: tool({
      description:
        "Persist a newly discovered prop firm immediately after web_search returns at least one direct source URL. Use only for a prop firm that verify_entity did not find. Put only official, regulator, or independent-tracker facts in confirmed; Trustpilot, Reddit, review-site, and forum allegations MUST go in unconfirmed. Leave the score unfinalized, and include Trustpilot only when the source explicitly shows both rating and review count. After saving, call verify_entity again so the final card comes from the stored developing record.",
      inputSchema: persistDiscoveredPropFirmInputSchema,
      execute: async (input) => upsertDevelopingPropFirm(input),
    }),
    list_verified_entities: tool({
      description:
        "Retrieve research candidates, not recommendations or endorsements. For brokers/prop firms, establish the trader's country and instruments first, including preferences remembered from this conversation. Use BTS as credibility evidence, then check country eligibility, product, entity, costs and platform using primary sources. Shortlist 3 to 5 suitable options from the whole list, not just the top two, and explain fit and unresolved risks. Investment-only platforms are not forex/CFD brokers. A named firm goes to verify_entity. For gurus, retain the existing reviewed-list behaviour.",
      inputSchema: listVerifiedEntitiesInputSchema,
      execute: async ({ type, limit, country, instruments }) => {
        if (type === "guru") return { entities: await listVerifiedEntities(type, limit ?? 8) };
        const preferences = dependencies.brokerPreferences;
        const residence = country ?? preferences?.country;
        const markets = instruments?.length ? instruments : preferences?.instruments;
        if (!residence || !markets?.length) return { clarificationRequired: true, message: "Ask only for the missing country or trading instruments before searching for firms." };
        const bts = await (dependencies.listBtsRankedImpl ?? listBtsRanked)(type, limit ?? 12, residence, markets);
        for (const firm of bts.firms) discoveryCandidates.add(firm.name.toLowerCase());
        return {
          requirements: { country: residence, instruments: markets, preferences: preferences?.requirements ?? [] },
          evidenceNote: "Stored BTS research is historical credibility evidence. Verify product and country eligibility from primary sources before recommending; a global score does not establish suitability.",
          bts,
        };
      },
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
    // Provider-run research; gateway search traces may be omitted from the response.
    web_search: getAskWebSearchTool(),
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
        "Calculate risk-reward ratio from pips or from entry, stop, and target prices. When the user gives prices, always pass entryPrice, stopPrice and targetPrice with direction (long for buy, short for sell), never distances you worked out: the tool checks the stop and target are on the right side. Use riskPips plus rewardPips only when the user gives distances. Do not invent missing prices or distances. In mixed questions, treat this as evidence, not the whole final answer.",
      inputSchema: calculateRiskRewardInputSchema,
      execute: async (toolInput) => {
        try {
          return withCard(buildRiskRewardCard(calculateRiskReward(toolInput)));
        } catch (error) {
          if (!(error instanceof RangeError)) throw error;
          return withCard(buildInsightCard(
            "Those Levels Don't Match the Side",
            "A buy needs the stop below entry and the target above it; a sell needs the stop above entry and the target below it.",
            "Did you mean to buy or sell, or are the stop and target swapped? Confirm that before placing the order.",
          ));
        }
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
        const card = parseSubmittedAskCardJson(card_json);
        if (card.type === "insight") {
          const text = `${card.headline} ${card.body} ${card.verdict}`.toLowerCase();
          const unchecked = [...discoveryCandidates].filter(name => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text) && !checkedCandidates.has(name));
          if (unchecked.length) return { verificationRequired: unchecked, message: "Call verify_entity for these candidates before presenting a shortlist. Use the latest returned assessment, exclude high-risk choices, and state what eligibility or costs remain unconfirmed." };
        }
        return { card, followups };
      },
    }),
  };
}

/** How long Ask waits for a live check before answering from the database. The run keeps going and is cached. */
const L2_WAIT_MS = 120_000; // the mobile app gives up on Ask at 180s

/** Any ISO country the user named; the live check researches countries the engine has no rows for (e.g. Morocco). */
const isoCountry = (c?: string) => (c && /^[A-Za-z]{2}$/.test(c.trim()) ? c.trim().toUpperCase() : undefined);

/**
 * Layer 2 owns the displayed number when it succeeds; Layer 1 stays in the database for audit and is
 * removed from what the model sees, so the user never gets two competing scores. When the live check
 * is unavailable, the Layer 1 rating is shown and labelled as a database assessment.
 */
async function withLiveCheck(bts: BtsAskContext, getL2: typeof getL2Assessment = getL2Assessment, country?: string, waitMs = L2_WAIT_MS) {
  if (bts.type === "tool" || btsVerificationGate(bts.operatingStatus, bts.researchStatus) || bts.global.verdict === "Not active" || bts.global.verdict === "Under review") return bts;
  const l2 = await waitForLiveCheck({ firm: bts.firm, kind: bts.type, country: isoCountry(country) ?? bts.countryCode, entityId: bts.entityId, baseline: { score: bts.global.score, verdict: bts.global.verdict } }, getL2, waitMs);
  // Same standing as the website: thin evidence keeps the baseline (pending); a disputed check shows no score.
  if (!l2 || (l2.status !== "published" && !isDisputed(l2))) return { ...bts, scoreSource: "Baseline · verification pending" };
  if (isDisputed(l2)) {
    const reason = "Our independent check found evidence that changes this rating, so it's being reviewed. No score is shown until that's done; check the regulator's register yourself before depositing.";
    return {
      ...bts,
      scoreSource: "Under review",
      shown: { ...bts.shown, verdict: "Under review" as const, score: null, note: null, global: true },
      global: { ...bts.global, verdict: "Under review" as const, score: null, reason, capApplied: null, evidenceConfidence: null, pillars: {} },
      country: null,
    };
  }
  const live = fromLiveCheck(l2);
  // Register-verified licences (e.g. FCA) stay from the research record; the live check scores, it doesn't re-list them.
  return { ...bts, ...live, global: { ...live.global, cloneAlert: bts.global.cloneAlert, licencesVerified: bts.global.licencesVerified } };
}

async function waitForLiveCheck(subject: L2Subject, getL2: typeof getL2Assessment = getL2Assessment, waitMs = L2_WAIT_MS) {
  const run = getL2(subject).catch(() => null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([run, new Promise<null>((resolve) => { timer = setTimeout(resolve, waitMs, null); })]);
    if (!result) {
      try { after(run); } catch { /* Tests and scripts have no request lifetime. */ }
    }
    return result;
  } finally {
    clearTimeout(timer);
  }
}

function fromLiveCheck(l2: L2Result) {
  const conduct = l2.pillars.find((p) => p.key === "conduct");
  const summary = l2.summary.trim();
  const risks = l2.risks.filter((risk) => !summary.toLowerCase().includes(risk.toLowerCase())).slice(0, 2);
  // The card leads with the short plain answer; the full summary and evidence sit underneath it.
  const note = l2.answer || (summary.length < 180 && risks.length ? `${summary} ${risks.join(" ")}` : summary);
  return {
    scoreSource: l2.country === "XX" ? "Official score" : `Official score · ${countryName(l2.country)}`,
    conductRecord: l2.findings.some((f) => f.adverse) ? ("On record" as const) : conduct?.sourced ? ("None found" as const) : ("Not checked" as const),
    shown: { country: "", verdict: l2.verdict, score: l2.finalScore, note, global: false },
    global: {
      verdict: l2.verdict,
      score: l2.finalScore,
      reason: null,
      capApplied: null,
      evidenceConfidence: l2.confidence,
      pillars: Object.fromEntries(l2.pillars.map((p) => [p.label, `${p.awarded} / ${p.max}${p.sourced ? "" : " (no source found)"}: ${p.reason}`])),
      licencesVerified: "",
      cloneAlert: null,
      lastChecked: l2.checkedAt.slice(0, 10),
    },
    country: null,
    liveCheck: {
      checkedAt: l2.checkedAt,
      confidence: l2.confidence,
      countryFit: l2.countryFit,
      legalEntity: l2.identity.legal_entity,
      officialWebsite: l2.identity.official_website,
      findings: l2.findings.map(({ source_id: _id, ...f }) => f),
      summary,
      regulators: l2.regulators,
      // From the firm's own pages: what a shortlist compares on (spreads, platforms, scalping).
      tradingConditions: l2.conditions,
      concern: l2.concern,
      recommendation: l2.recommendation,
      pillars: l2.pillars.map(({ label, awarded, max, reason }) => ({ label, awarded, max, reason })),
      strengths: l2.strengths,
      risks: l2.risks,
      sources: l2.sources.map(({ title, url, type }) => ({ title, url, type })),
    },
  };
}

type CheckedBts = Awaited<ReturnType<typeof withLiveCheck>>;

function verificationMeta(bts: CheckedBts): Pick<AskUiMeta, "verification" | "verificationSourceLabel" | "cloneNotice" | "regulation"> {
  const cloneNotice = bts.global.cloneAlert ? { message: bts.global.cloneAlert, ...(bts.research?.cloneNoticeSource ? { sourceUrl: bts.research.cloneNoticeSource } : {}) } : undefined;
  const regulation = regulationLabel(bts.global.licencesVerified, bts.countryCode, "liveCheck" in bts ? bts.liveCheck.regulators : []) ?? undefined;
  if (!("liveCheck" in bts)) return { cloneNotice, regulation, verificationSourceLabel: "scoreSource" in bts ? bts.scoreSource : "Reviewed record" };
  const live = bts.liveCheck;
  return {
    cloneNotice,
    regulation,
    verificationSourceLabel: bts.scoreSource,
    verification: {
      verdict: bts.shown.verdict,
      confidence: live.confidence,
      checkedAt: live.checkedAt,
      score: bts.shown.score,
      summary: live.summary,
      concern: live.concern || undefined,
      recommendation: live.recommendation || undefined,
      pillars: live.pillars,
      sources: live.sources.map(({ title, url }) => ({ title, url })),
      findings: live.findings.map((f) => ({ authority: f.authority, legalEntity: f.legal_entity, jurisdiction: f.jurisdiction, date: f.date, finding: f.finding, outcome: f.outcome, url: f.url })),
    },
  };
}


/** First sentence of a baseline (Layer 1) answer, in the same plain voice as the live check. */
function baselineOpener(verdict: string, firm: string, country: string | null): string {
  const where = country ? ` in ${country}` : "";
  if (verdict === "Verified" || verdict === "Record reviewed") return `Our preliminary record suggests ${firm}${where} is sound, as long as you confirm which company holds your account.`;
  if (verdict === "Caution") return `Our preliminary record suggests being careful with ${firm}${where}.`;
  if (verdict === "High risk") return `Our preliminary record suggests avoiding ${firm}${where}.`;
  if (verdict === "Insufficient data") return `There isn't enough verified evidence to rate ${firm}${where} yet.`;
  return `${verdict}${where}.`;
}

/** A disputed live check shows no score until a person decides (amber: not a negative finding). */
function disputedBrokerFields(firm: string): Pick<BrokerCard, "score" | "status" | "color" | "complaints" | "verdict"> {
  return {
    score: "No score",
    status: "CAUTION",
    color: "amber",
    complaints: "Not checked",
    verdict: `Our latest check found new evidence about ${firm} that changes its rating, so we're reviewing it before publishing a score. Until then, check the regulator's register yourself before depositing.`,
  };
}

/**
 * The card shows the final verdict and score verbatim: the live check's when it ran, else the
 * engine's for the user's country. Live FCA data and old record fields never change it.
 */
function applyBtsToCard(card: BrokerCard, bts: CheckedBts): BrokerCard {
  const gate = btsVerificationGate(bts.operatingStatus, bts.researchStatus);
  if (!gate && "scoreSource" in bts && bts.scoreSource === "Under review") {
    return { ...card, ...disputedBrokerFields(bts.firm) };
  }
  if (gate || bts.global.verdict === "Under review") {
    return { ...card, score: "No score", status: "WARNING", color: "red", complaints: "Not checked", verdict: gate === "inactive" ? `${bts.firm} is recorded as inactive, redirected or merged. This record does not confirm an active service.` : gate === "unknown" ? `We haven't confirmed whether ${bts.firm} is operating.` : "We're still verifying this firm." };
  }
  const { verdict, score, note } = bts.shown;
  const status = cardStatus(verdict);
  const live = "liveCheck" in bts && bts.liveCheck ? bts.liveCheck : null;
  const reason = bts.global.reason ? `${bts.global.reason.charAt(0).toUpperCase()}${bts.global.reason.slice(1)}.` : "";
  const sameAsReason = note && bts.global.reason && note.toLowerCase().includes(bts.global.reason.toLowerCase());
  return {
    ...card,
    score: score === null ? "No score" : `${score}/100`,
    status,
    // FCA standing from register-verified licences (engine), or the live check's local licence finding.
    fca: (live?.countryFit === "CONFIRMED_LOCALLY" && bts.countryCode === "GB") || /(^|\|)FCA:/.test(bts.global.licencesVerified) ? "Yes" : "No",
    complaints: bts.conductRecord,
    color: statusColor(status),
    // The live check's own summary reads naturally; the database answer says where it came from.
    verdict: live
      ? (note ?? "")
      // The card keeps 3 sentences, so the fallback drops the note to keep its "stored assessment" label.
      : [baselineOpener(verdict, bts.firm, bts.shown.global ? null : countryName(bts.countryCode)), reason && `Main reason: ${reason}`, "scoreSource" in bts ? DATABASE_ONLY : sameAsReason ? "" : (note ?? "")]
          .filter(Boolean)
          .join(" "),
  };
}

export async function resolveVerificationToolResult(
  name: string,
  dependencies: AskServiceDependencies,
  country?: string,
): Promise<VerificationToolResponse> {
  const lookupVerifiedEntityImpl =
    dependencies.lookupVerifiedEntityImpl ?? lookupVerifiedEntity;
  const getFcaStatusImpl = dependencies.getFcaStatusImpl ?? getFcaStatus;

  const normalized = normalizeVerificationName(name);
  const lookup = await lookupVerifiedEntityImpl(normalized.lookupName);
  if (lookup.entity && lookup.entity.type !== "guru" && !normalized.fromUrl) {
    const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
    const aliases = [lookup.entity.name, lookup.entity.id, ...(lookup.entity.aliases ?? [])];
    if (!aliases.some((alias) => key(alias) === key(normalized.lookupName))) return coverageEvidence(normalized.lookupName, false);
  }

  // No page on our site, but the engine may still have scored the firm (new brokers, tools).
  const engineByBrand = async () => {
    const bts = await (dependencies.getBtsAskContextByBrandImpl ?? getBtsAskContextByBrand)(normalized.lookupName, country);
    return bts ? withLiveCheck(bts, dependencies.getL2AssessmentImpl, country, dependencies.liveCheckWaitMs) : undefined;
  };

  // Brokers and prop firms: the BTS engine's verdict and score go on the card verbatim.
  const withEngine = async (result: ReturnType<typeof withCard>, slug: string) => {
    if (result.card.type !== "broker") return result;
    const engine = await (dependencies.getBtsAskContextImpl ?? getBtsAskContext)(slug, country);
    if (!engine) return (await checkWithoutBaseline(result.card.name, lookup.entity?.type === "propfirm" ? "propfirm" : "broker")) ?? result;
    if (normalized.fromUrl && engine.research?.website) {
      const host = (url: string) => new URL(url.startsWith("http") ? url : `https://${url}`).hostname.toLowerCase().replace(/^www\./, "");
      try {
        const supplied = name.match(/https?:\/\/[^\s]+|www\.[^\s]+/i)?.[0] ?? name;
        if (host(supplied) !== host(engine.research.website)) return coverageEvidence(name, true);
      } catch { return coverageEvidence(name, true); }
    }
    const bts = await withLiveCheck(engine, dependencies.getL2AssessmentImpl, country, dependencies.liveCheckWaitMs);
    return {
      ...result,
      card: applyBtsToCard(result.card, bts),
      bts,
      uiMeta: {
        ...result.uiMeta,
        ...verificationMeta(bts),
        // Old developing flags and trust bands must not hide or contradict the new final score.
        ...("liveCheck" in bts ? { propFirm: undefined } : {}),
      },
    };
  };

  const checkWithoutBaseline = async (firm: string, kind?: "broker" | "propfirm") => {
    const countryCode = isoCountry(country) ?? await getRequestCountrySafe();
    const l2 = await waitForLiveCheck({ firm, kind, country: countryCode }, dependencies.getL2AssessmentImpl, dependencies.liveCheckWaitMs);
    // Same standing rules as engine firms: thin evidence shows nothing new, a disputed check shows no score.
    if (!l2 || (l2.status !== "published" && !isDisputed(l2))) return null;
    if (isDisputed(l2)) {
      return withCard({ type: "broker", name: firm, fca: "No", ...disputedBrokerFields(firm) }, { verificationKind: l2.kind, verificationSourceLabel: "Under review" });
    }
    const bts: CheckedBts = {
      firm,
      entityId: `name:${firm.trim().toLowerCase()}`,
      type: l2.kind,
      operatingStatus: null,
      researchStatus: null,
      research: null,
      countryCode,
      userCountry: countryCode === "XX" ? "unknown" : `${countryName(countryCode)} (${countryCode})`,
      ...fromLiveCheck(l2),
    };
    const card = applyBtsToCard({ type: "broker", name: firm, score: "No score", status: "WARNING", fca: "No", complaints: "Not checked", verdict: "Score unavailable", color: "red" }, bts);
    return { ...withCard(card, { verificationKind: l2.kind, ...verificationMeta(bts) }), bts };
  };

  if (lookup.found && lookup.entity) {
    if (lookup.entity.type === "guru") {
      const card = buildGuruCard(lookup);
      if (card) return withCard(card);
    } else if (lookup.entity.type === "propfirm") {
      const card = buildPropFirmCard(lookup);
      if (card) return withEngine(withCard(card, propFirmUiMeta(lookup)), lookup.entity.id);
    } else {
      const fcaStatus = await getFcaStatusImpl({
        name: lookup.entity.name,
        frn: lookup.entity.fcaReference ?? undefined,
      });
      const card = buildBrokerCard(lookup, fcaStatus);
      if (card) {
        return withEngine(
          withCard(card, { verificationKind: "broker", verificationSourceLabel: fcaStatus.available ? "Live FCA confirmed" : "Reviewed record" }),
          lookup.entity.id,
        );
      }
    }
  } else if (!normalized.fromUrl) {
    // A plain name we don't hold — check the live FCA register before giving up.
    const bts = await engineByBrand();
    if (!bts) {
      const live = await checkWithoutBaseline(normalized.lookupName);
      if (live) return live;
    }
    const fcaStatus = await getFcaStatusImpl({ name: normalized.lookupName, frn: undefined });
    if (fcaStatus.available && fcaStatus.statusText) {
      return {
        bts,
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
    return {
      ...(await coverageEvidence(normalized.lookupName, false)),
      bts,
    };
  }

  if (normalized.fromUrl) {
    const live = await checkWithoutBaseline(name);
    if (live) return live;
  }

  // No confident record: hand the model the closest labelled candidates and let
  // it write the reply ("did you mean X?" or ask for the exact name).
  return {
    ...(await coverageEvidence(normalized.fromUrl ? normalized.displayName : normalized.lookupName, normalized.fromUrl)),
    bts: await engineByBrand(),
  };
}
