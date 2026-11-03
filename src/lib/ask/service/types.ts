import { generateText } from "ai";

import { getActiveAnalysisRules } from "@/lib/ask/analysis-rules";
import { getFcaStatus } from "@/lib/ask/fca";
import type { getBtsAskContext, getBtsAskContextByBrand, listBtsRanked } from "@/lib/compare/bts-data";
import type { getL2Assessment } from "@/lib/compare/bts-l2";
import { lookupVerifiedEntity } from "@/lib/ask/entities";
import { getMarketQuote, getMarketSeries } from "@/lib/ask/market";
import { fetchNewsEverything } from "@/lib/ask/newsdata";
import type { EconomicCalendarSnapshot } from "@/lib/markets/economic-calendar";

/** Side-channel hooks the route uses to stream tool activity to the client. */
export type AskGenerationCallbacks = {
  onToolCall?: (event: { toolName: string; input: unknown }) => void;
};

export interface ParsedImageInput {
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
}

export interface AskServiceDependencies {
  brokerPreferences?: import("@/lib/ask/broker-discovery").BrokerPreferences;
  generateTextImpl?: typeof generateText;
  getActiveAnalysisRulesImpl?: typeof getActiveAnalysisRules;
  lookupVerifiedEntityImpl?: typeof lookupVerifiedEntity;
  getFcaStatusImpl?: typeof getFcaStatus;
  getBtsAskContextImpl?: typeof getBtsAskContext;
  listBtsRankedImpl?: typeof listBtsRanked;
  getBtsAskContextByBrandImpl?: typeof getBtsAskContextByBrand;
  getL2AssessmentImpl?: typeof getL2Assessment;
  /** User's country (ISO-2) when known outside a web request (e.g. tests, mobile); else read from the request. */
  country?: string;
  getMarketQuoteImpl?: typeof getMarketQuote;
  getMarketSeriesImpl?: typeof getMarketSeries;
  fetchNewsEverythingImpl?: typeof fetchNewsEverything;
  getEconomicCalendarSnapshotImpl?: () => Promise<EconomicCalendarSnapshot | null>;
}
