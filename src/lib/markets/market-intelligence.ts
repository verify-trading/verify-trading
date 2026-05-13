/** Market intelligence feed item (news headlines) for the Markets tab. */

export type MarketIntelligenceItem = {
  id: string;
  title: string;
  source: string;
  /** ISO 8601 */
  publishedAt: string;
  summary: string;
  url?: string;
  /** Optional category/tag from the upstream provider */
  category?: string;
  /** Short row badge label (e.g. GOLD, NFP). If omitted, inferred from the title when possible. */
  tag?: string;
};

export type DailyMarketBriefAsset = {
  level: string;
  bias: string;
  verdict: string;
};

export type DailyMarketBrief = {
  date: string;
  generatedAt: string;
  overview: string;
  gold: DailyMarketBriefAsset;
  oil: DailyMarketBriefAsset;
  eurusd: DailyMarketBriefAsset;
  gbpusd: DailyMarketBriefAsset;
  session_tone: string;
};

export type MarketIntelligenceSnapshot = {
  updatedAt: string;
  items: MarketIntelligenceItem[];
  sourceCount?: number;
  dailyBrief?: DailyMarketBrief | null;
};
