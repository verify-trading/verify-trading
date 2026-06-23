/**
 * Scripted data + types for the animated "Ask" hero demo.
 *
 * One shared story is replayed by every visual variant (see ./index.tsx). The
 * cards mirror the real Ask answer cards (src/components/ask/cards.tsx) but are
 * self-contained so the hero never pulls in the live RAG contracts/charts.
 */

export type DemoBrokerCard = {
  type: "broker";
  name: string;
  /** e.g. "8.6" — rendered as "8.6 / 10" with a fill bar. */
  score: string;
  status: "LEGITIMATE" | "WARNING" | "AVOID";
  fca: "Yes" | "No";
  complaints: "Low" | "Medium" | "High";
  /** "green" -> verified accent, otherwise coral. */
  color: "green" | "red";
  /** Small source pill, e.g. "Trustpilot 4.6 · 21k reviews". */
  source?: string;
  verdict: string;
};

export type DemoBriefingCard = {
  type: "briefing";
  asset: string;
  price: string;
  change: string;
  direction: "up" | "down";
  level1: string;
  level2: string;
  event?: string;
  /** Normalised 0..1 series for the inline sparkline. */
  series: number[];
  verdict: string;
};

export type DemoCalcCard = {
  type: "calc";
  lots: string;
  account: string;
  risk: string;
  sl: string;
  verdict: string;
};

export type DemoCard = DemoBrokerCard | DemoBriefingCard | DemoCalcCard;

/** A complete user-question -> assistant-answer pair. */
export type DemoExchange = {
  id: string;
  question: string;
  card: DemoCard;
  followups: string[];
  /** Status phrases shown one-by-one while "thinking" — reads as real work. */
  thinkingSteps: string[];
};

/** Identifiers for the four hero visual treatments. */
export type HeroAskVariant = "device" | "glass" | "island" | "editorial";

/**
 * Variant catalogue — drives the comparison page and any picker UI. Kept in this
 * server-safe module (no "use client") so Server Components can read the values.
 */
export const HERO_ASK_VARIANTS: {
  id: HeroAskVariant;
  name: string;
  tagline: string;
}[] = [
  {
    id: "device",
    name: "iPhone Device",
    tagline: "Polished phone frame with a Dynamic Island and a building thread.",
  },
  {
    id: "glass",
    name: "Glass Tilt",
    tagline: "Frameless glass panel floating in 3D over an aurora glow.",
  },
  {
    id: "island",
    name: "Live Island",
    tagline: "Energetic phone with a spinning halo and live-data island.",
  },
  {
    id: "editorial",
    name: "Editorial Minimal",
    tagline: "Calm, frameless layout where the input is the hero.",
  },
];

/** The four chips shown on the intro/empty state — straight from the real app. */
export const DEMO_SUGGESTIONS: string[] = [
  "Is Pepperstone safe for UK retail CFD?",
  "Gold: key levels before London open",
  "Position size: 1% risk, £8k, 22 pip stop",
  "24-month projection: £10k start, £400/mo",
];

export const DEMO_EXCHANGES: DemoExchange[] = [
  {
    id: "broker",
    question: "Is Pepperstone safe for UK retail CFD?",
    card: {
      type: "broker",
      name: "Pepperstone",
      score: "8.6",
      status: "LEGITIMATE",
      fca: "Yes",
      complaints: "Low",
      color: "green",
      source: "Trustpilot 4.6 · 21k reviews",
      verdict:
        "FCA-authorised (No. 684312), client funds segregated. Safe for UK retail CFD trading.",
    },
    followups: [
      "How does it compare to IC Markets?",
      "What are the overnight swap fees?",
    ],
    thinkingSteps: [
      "Reading your question",
      "Checking the FCA register",
      "Cross-checking Trustpilot reviews",
    ],
  },
  {
    id: "briefing",
    question: "Gold: key levels before London open",
    card: {
      type: "briefing",
      asset: "XAU/USD · Gold",
      price: "$2,418.30",
      change: "0.74%",
      direction: "up",
      level1: "$2,432",
      level2: "$2,401",
      event: "US CPI at 13:30 BST — expect a volatility spike.",
      series: [
        0.32, 0.36, 0.3, 0.4, 0.46, 0.42, 0.5, 0.55, 0.49, 0.58, 0.64, 0.6,
        0.68, 0.72, 0.66, 0.74, 0.8, 0.76, 0.84, 0.88, 0.82, 0.9, 0.95, 1,
      ],
      verdict:
        "Holding above $2,401 keeps the intraday bias bullish. Lose it and $2,388 opens up.",
    },
    followups: [
      "What's the trade setup with R:R?",
      "How will CPI likely move price?",
    ],
    thinkingSteps: [
      "Pulling live gold prices",
      "Marking intraday key levels",
      "Scanning the economic calendar",
    ],
  },
  {
    id: "calc",
    question: "Position size: 1% risk, £8k, 22 pip stop",
    card: {
      type: "calc",
      lots: "0.36",
      account: "£8,000",
      risk: "1%",
      sl: "22 pips",
      verdict:
        "Risk £80 on this trade. 0.36 lots keeps you to your 1% rule with a 22-pip stop.",
    },
    followups: [
      "Recalculate at 0.5% risk",
      "What if the stop is 30 pips?",
    ],
    thinkingSteps: [
      "Reading your account & risk",
      "Sizing to your 1% rule",
    ],
  },
];
