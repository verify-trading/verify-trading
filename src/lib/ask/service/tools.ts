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
import { lookupVerifiedEntity, type LookupVerifiedEntityResult } from "@/lib/ask/entities";
import { getMarketQuote, getMarketSeries, getMarketSeriesInputSchema } from "@/lib/ask/market";
import type { AskServiceDependencies } from "@/lib/ask/service/types";
import { generateProjectionCard, generateProjectionInputSchema } from "@/lib/ask/projections";

const verifyEntityInputSchema = z.object({
  name: z.string().min(1).describe("Broker, prop firm, guru, or brand name to verify."),
});

function buildInsightCard(headline: string, body: string, verdict: string): AskCard {
  return {
    type: "insight",
    headline,
    body,
    verdict,
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

  if (fcaStatus.authorised === false) {
    fca = "No";
    if (status === "LEGITIMATE") {
      status = "WARNING";
    }
  } else if (fcaStatus.authorised === true) {
    fca = "Yes";
  }

  if (fcaStatus.warning === true) {
    status = "WARNING";
  }

  return {
    type: "broker",
    name: hint.name,
    score: hint.score,
    status,
    fca,
    complaints: hint.complaints,
    verdict: fcaStatus.note ?? fcaStatus.statusText ?? entity.notes,
    color: hint.color,
  };
}

function buildPropFirmCard(lookup: LookupVerifiedEntityResult): BrokerCard | null {
  const hint = lookup.brokerCardHint;
  const entity = lookup.entity;
  if (!hint || !entity) {
    return null;
  }

  const hasRegulationContext = /not fca|not regulated|not authorised|not authorized/i.test(
    entity.notes,
  );
  const verdict = hasRegulationContext
    ? entity.notes
    : `${entity.notes} Not FCA-regulated because it is a prop firm, not a retail broker.`;

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

function buildGuruCard(lookup: LookupVerifiedEntityResult): GuruCard | null {
  const hint = lookup.guruCardHint;
  const entity = lookup.entity;
  if (!hint || !entity) {
    return null;
  }

  return {
    type: "guru",
    name: hint.name,
    score: hint.score,
    status: hint.status,
    verified: hint.verified,
    verdict: entity.notes,
    color: hint.color,
  };
}

function buildCoverageInsightCard(): AskCard {
  return buildInsightCard(
    "Limited Coverage",
    "I do not have a reviewed record for that name yet.",
    "Send the exact broker, firm, or brand name.",
  );
}

function formatPrice(value: number) {
  return value.toFixed(2);
}

function formatChange(value: number) {
  return `${value >= 0 ? "+" : "-"}${Math.abs(value).toFixed(2)}%`;
}

function buildBriefingCard(
  quote: Awaited<ReturnType<typeof getMarketQuote>>,
  series: Awaited<ReturnType<typeof getMarketSeries>>,
): { card: BriefingCard; uiMeta: AskUiMeta } {
  const supportCandidates = series.closeValues.filter((value) => value < quote.price);
  const resistanceCandidates = series.closeValues.filter((value) => value > quote.price);

  const support =
    supportCandidates.length > 0 ? Math.max(...supportCandidates) : quote.price;
  const resistance =
    resistanceCandidates.length > 0 ? Math.min(...resistanceCandidates) : quote.price;
  const hasTwoSidedRange =
    supportCandidates.length > 0 && resistanceCandidates.length > 0;
  const rangeRatio = resistance > support ? (resistance - support) / Math.max(Math.abs(quote.price), 1) : 0;
  const verdict =
    hasTwoSidedRange && rangeRatio < 0.0015
      ? `${quote.asset} is compressed here. Wait for a clean break before choosing a side.`
      : quote.direction === "up"
        ? `${quote.asset} is holding above support. Watch resistance for continuation.`
        : `${quote.asset} is leaning heavy. Watch support for the next move.`;

  const card: BriefingCard = {
    type: "briefing",
    asset: quote.asset,
    price: formatPrice(quote.price),
    change: formatChange(quote.changePercent),
    direction: quote.direction,
    level1: formatPrice(resistance),
    level2: formatPrice(support),
    event: null,
    verdict,
  };

  return {
    card,
    uiMeta: {
      marketSeries: series.closeValues,
      marketLevelScopeLabel: "Near-term levels",
    },
  };
}

function withCard(card: AskCard, uiMeta?: AskUiMeta) {
  return uiMeta ? { card, uiMeta } : { card };
}

async function enrichPositionSizeInput(
  toolInput: z.input<typeof calculatePositionSizeInputSchema>,
  getMarketQuoteImpl: typeof getMarketQuote,
) {
  if (!toolInput.pair || toolInput.pipValuePerLot || toolInput.quoteToAccountRate || toolInput.exchangeRate) {
    return toolInput;
  }

  const { base, quote } = normalizeForexPair(toolInput.pair);
  const accountCurrency = toolInput.accountCurrency ?? "GBP";

  if (accountCurrency !== base || accountCurrency === quote) {
    return toolInput;
  }

  const quoteData = await getMarketQuoteImpl(toolInput.pair);

  return {
    ...toolInput,
    exchangeRate: quoteData.price,
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
    `Risk is ${result.riskDistance}. Reward is ${result.rewardDistance}. Ratio is ${result.ratio.toFixed(2)} to 1.`,
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
  const lookupVerifiedEntityImpl =
    dependencies.lookupVerifiedEntityImpl ?? lookupVerifiedEntity;
  const getFcaStatusImpl = dependencies.getFcaStatusImpl ?? getFcaStatus;
  const getMarketQuoteImpl = dependencies.getMarketQuoteImpl ?? getMarketQuote;
  const getMarketSeriesImpl = dependencies.getMarketSeriesImpl ?? getMarketSeries;

  return {
    verify_entity: tool({
      description:
        "Verify a broker, prop firm, or trading guru. Use this for legitimacy, safety-to-deposit, regulation, complaints, or trust checks. It uses reviewed entity data first and then live FCA confirmation when an FRN is available.",
      inputSchema: verifyEntityInputSchema,
      execute: async ({ name }) => {
        const lookup = await lookupVerifiedEntityImpl(name);
        if (!lookup.found || !lookup.entity) {
          return withCard(buildCoverageInsightCard());
        }

        if (lookup.entity.type === "guru") {
          const card = buildGuruCard(lookup);
          return withCard(card ?? buildCoverageInsightCard());
        }

        if (lookup.entity.type === "propfirm") {
          const card = buildPropFirmCard(lookup);
          return withCard(
            card ?? buildCoverageInsightCard(),
            card
              ? {
                  verificationKind: "propfirm",
                  verificationSourceLabel: "Reviewed record",
                }
              : undefined,
          );
        }

        const fcaStatus = await getFcaStatusImpl({
          name: lookup.entity.name,
          frn: lookup.entity.fcaReference ?? undefined,
        });
        const card = buildBrokerCard(lookup, fcaStatus);

        return withCard(
          card ?? buildCoverageInsightCard(),
          card
            ? {
                verificationKind: "broker",
                verificationSourceLabel: fcaStatus.available ? "Live FCA confirmed" : "Reviewed record",
              }
            : undefined,
        );
      },
    }),
    get_market_briefing: tool({
      description:
        "Get a complete live market briefing card plus chart data for a market asset, stock, ETF, forex pair, crypto pair, commodity, or index. Use this for 'what is X doing', price, level, session prep, and current move questions. It can resolve broader names like Silver to a supported tradable instrument or proxy.",
      inputSchema: getMarketSeriesInputSchema,
      execute: async ({ asset, timeframe }) => ({
        ...buildBriefingCard(
          await getMarketQuoteImpl(asset),
          await getMarketSeriesImpl(asset, timeframe),
        ),
      }),
    }),
    calculate_position_size: tool({
      description:
        "Calculate the exact position size card for a risk-based lot size question. Use it only when account size, risk percent, and stop loss in pips are known or can be recovered from recent history. If the user labels a cash amount as risk, do not reinterpret it as account size. If account size or risk percent is missing or ambiguous, ask for that one value instead of forcing a calc.",
      inputSchema: calculatePositionSizeInputSchema,
      execute: async (toolInput) =>
        withCard(calculatePositionSizeCard(await enrichPositionSizeInput(toolInput, getMarketQuoteImpl))),
    }),
    calculate_risk_reward: tool({
      description:
        "Calculate risk-reward ratio from pips or from entry, stop, and target prices. Use it when the user gives either riskPips plus rewardPips, or entryPrice plus stopPrice plus targetPrice. Do not invent missing prices or distances.",
      inputSchema: calculateRiskRewardInputSchema,
      execute: async (toolInput) => {
        const result = calculateRiskReward(toolInput);
        return withCard(buildRiskRewardCard(result));
      },
    }),
    calculate_pip_value: tool({
      description:
        "Calculate forex pip value using pair and lot size, with optional currency conversion inputs. Use it for pip-value questions when the pair and lot size are known. If lot size is missing, ask for it.",
      inputSchema: calculatePipValueInputSchema,
      execute: async (toolInput) => {
        const result = calculatePipValue(toolInput);
        return withCard(buildPipValueCard(result));
      },
    }),
    calculate_margin_required: tool({
      description:
        "Calculate required margin from pair, lot size, and leverage or margin rate. If price is missing, this tool may use the current live market price for the pair. Use it for margin questions, not for general market briefings.",
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
        "Calculate profit or loss from pair, entry price, exit price, direction, and lot size. Use it when those values are known. Do not invent missing trade prices or direction.",
      inputSchema: calculateProfitLossInputSchema,
      execute: async (toolInput) => {
        const result = calculateProfitLoss(toolInput);
        return withCard(buildProfitLossCard(result));
      },
    }),
    generate_projection: tool({
      description:
        "Generate the full projection card for account growth and compounding questions. Requires months and startBalance. If return or drawdown assumptions are missing, it can still answer with sensible defaults, but the verdict must clearly separate user-supplied assumptions from assumed ones.",
      inputSchema: generateProjectionInputSchema,
      execute: async (toolInput) => withCard(generateProjectionCard(toolInput)),
    }),
  };
}
