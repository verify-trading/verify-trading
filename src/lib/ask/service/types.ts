import { generateText } from "ai";

import { getFcaStatus } from "@/lib/ask/fca";
import { lookupVerifiedEntity } from "@/lib/ask/entities";
import { getMarketQuote, getMarketSeries } from "@/lib/ask/market";
import { fetchNewsEverything } from "@/lib/ask/newsdata";

export interface ParsedImageInput {
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
}

export interface AskServiceDependencies {
  generateTextImpl?: typeof generateText;
  lookupVerifiedEntityImpl?: typeof lookupVerifiedEntity;
  getFcaStatusImpl?: typeof getFcaStatus;
  getMarketQuoteImpl?: typeof getMarketQuote;
  getMarketSeriesImpl?: typeof getMarketSeries;
  fetchNewsEverythingImpl?: typeof fetchNewsEverything;
}
