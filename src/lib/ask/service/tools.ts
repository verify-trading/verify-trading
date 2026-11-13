import { tool } from "ai";
import { z } from "zod";

import { getAskWebSearchTool } from "@/lib/ask/service/provider";

import { httpUrlSchema, type AskCard, type AskUiMeta, type BriefingCard } from "@/lib/ask/contracts";
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
import { listBtsRanked } from "@/lib/compare/bts-data";
import { listVerifiedEntities, upsertDevelopingPropFirm } from "@/lib/ask/entities";
import {
  getMarketQuote,
  getMarketSeries,
  getMarketSeriesInputSchema,
  type MarketDataOptions,
} from "@/lib/ask/market";
import { formatMarketPrice } from "@/lib/ask/market-format";
import { fetchNewsEverything } from "@/lib/ask/newsdata";
import { buildEconomicCalendarToolResult, economicCalendarInputSchema, getCachedEconomicCalendarSnapshot } from "@/lib/ask/service/calendar-tool";
import { parseSubmittedAskCardJson } from "@/lib/ask/service/card-output";
import type { AskServiceDependencies } from "@/lib/ask/service/types";
import { resolveVerificationToolResult, withCard } from "@/lib/ask/service/verification";
import { generateProjectionCard, generateProjectionInputSchema } from "@/lib/ask/projections";
import { generateGrowthPlanCard, generateGrowthPlanInputSchema } from "@/lib/ask/plans";
import { buildMarketSetupCard, getMarketSetupInputSchema } from "@/lib/ask/setups";
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


const MAX_NEWS_TOOL_ARTICLES = 4;
const MAX_NEWS_DESCRIPTION_CHARS = 160;

const buildInsightCard = (headline: string, body: string, verdict: string): AskCard => ({ type: "insight", headline, body, verdict });

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

        return buildBriefingCard(quote, series);
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

        return buildMarketSetupCard(quote, series, side);
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
      execute: async (toolInput) => withCard(buildPipValueCard(calculatePipValue(toolInput))),
    }),
    calculate_margin_required: tool({
      description:
        "Calculate required margin from pair, lot size, and leverage or margin rate. If price is missing, this tool may use the current live market price for the pair. Use it for margin questions, not for general market briefings. In mixed questions, treat this as evidence, not the whole final answer.",
      inputSchema: calculateMarginRequirementInputSchema,
      execute: async (toolInput) => {
        const price = toolInput.price ?? (await getMarketQuoteImpl(toolInput.pair)).price;
        return withCard(buildMarginCard(calculateMarginRequirement({ ...toolInput, price })));
      },
    }),
    calculate_profit_loss: tool({
      description:
        "Calculate profit or loss from pair, entry price, exit price, direction, and lot size. Use it when those values are known. Do not invent missing trade prices or direction. In mixed questions, treat this as evidence, not the whole final answer.",
      inputSchema: calculateProfitLossInputSchema,
      execute: async (toolInput) => withCard(buildProfitLossCard(calculateProfitLoss(toolInput))),
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
