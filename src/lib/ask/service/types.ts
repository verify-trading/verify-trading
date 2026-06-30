import { generateText } from "ai";

import { getActiveAnalysisRules } from "@/lib/ask/analysis-rules";
import { getFcaStatus } from "@/lib/ask/fca";
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
  generateTextImpl?: typeof generateText;
  getActiveAnalysisRulesImpl?: typeof getActiveAnalysisRules;
  lookupVerifiedEntityImpl?: typeof lookupVerifiedEntity;
  getFcaStatusImpl?: typeof getFcaStatus;
  getMarketQuoteImpl?: typeof getMarketQuote;
  getMarketSeriesImpl?: typeof getMarketSeries;
  fetchNewsEverythingImpl?: typeof fetchNewsEverything;
  getEconomicCalendarSnapshotImpl?: () => Promise<EconomicCalendarSnapshot | null>;
}
