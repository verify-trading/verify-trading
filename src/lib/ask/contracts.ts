import { z } from "zod";

import { ASK_MODEL_HISTORY_LIMIT } from "@/lib/ask/config";

const brokerStatusSchema = z.enum(["LEGITIMATE", "WARNING", "AVOID"]);
const cardColorSchema = z.enum(["green", "red"]);
const booleanStringSchema = z.enum(["Yes", "No"]);
const chartBiasSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim().toLowerCase();
  if (/\b(bullish|long)\b/.test(normalized)) {
    return "Bullish";
  }
  if (/\b(bearish|short)\b/.test(normalized)) {
    return "Bearish";
  }
  if (normalized.includes("neutral")) {
    return "Neutral";
  }

  return value;
}, z.enum(["Bullish", "Bearish", "Neutral"]));
const chartConfidenceSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized.includes("high")) {
    return "High";
  }
  if (normalized.includes("medium")) {
    return "Medium";
  }
  if (normalized.includes("low")) {
    return "Low";
  }

  return value;
}, z.enum(["High", "Medium", "Low"]));
const textFieldSchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .pipe(z.string().min(1));
const nullableTextFieldSchema = z.union([textFieldSchema, z.null()]);

const brokerCardSchema = z.object({
  type: z.literal("broker"),
  name: textFieldSchema,
  score: textFieldSchema,
  status: brokerStatusSchema,
  fca: booleanStringSchema,
  complaints: z.enum(["Low", "Medium", "High"]),
  verdict: textFieldSchema,
  color: cardColorSchema,
});

const briefingCardSchema = z.object({
  type: z.literal("briefing"),
  asset: textFieldSchema,
  price: textFieldSchema,
  change: textFieldSchema,
  direction: z.enum(["up", "down"]),
  level1: textFieldSchema,
  level2: textFieldSchema,
  event: nullableTextFieldSchema,
  verdict: textFieldSchema,
});

const calcCardSchema = z.object({
  type: z.literal("calc"),
  lots: textFieldSchema,
  risk_amount: textFieldSchema,
  account: textFieldSchema,
  risk_pct: textFieldSchema,
  sl_pips: textFieldSchema,
  verdict: textFieldSchema,
});

const guruCardSchema = z.object({
  type: z.literal("guru"),
  name: textFieldSchema,
  // Gurus carry no numeric score — only a gated three-tier label.
  tier: z.enum(["Verified", "Unverified", "Caution"]),
  trackRecord: textFieldSchema,
  // Citation link; present (and required to display) only when tier is Caution.
  citationUrl: nullableTextFieldSchema,
  verdict: textFieldSchema,
});

const insightCardSchema = z.object({
  type: z.literal("insight"),
  headline: textFieldSchema,
  body: textFieldSchema,
  verdict: textFieldSchema,
});

const planCardSchema = z.object({
  type: z.literal("plan"),
  startBalance: z.number().nonnegative(),
  monthlyAdd: z.number().nonnegative(),
  currencySymbol: textFieldSchema,
  dailyTarget: textFieldSchema,
  weeklyTarget: textFieldSchema,
  monthlyTarget: textFieldSchema,
  maxDailyLoss: textFieldSchema,
  projectionMonths: z.number().int().positive(),
  projectedBalance: z.number().nonnegative(),
  projectionReturn: textFieldSchema,
  rationale: textFieldSchema,
  verdict: textFieldSchema,
});

const chartCardSchema = z.object({
  type: z.literal("chart"),
  pattern: textFieldSchema,
  bias: chartBiasSchema,
  entry: textFieldSchema,
  stop: textFieldSchema,
  target: textFieldSchema,
  rr: textFieldSchema,
  confidence: chartConfidenceSchema,
  verdict: textFieldSchema,
});

const setupCardSchema = z.object({
  type: z.literal("setup"),
  asset: textFieldSchema,
  bias: chartBiasSchema,
  entry: textFieldSchema,
  stop: textFieldSchema,
  target: textFieldSchema,
  rr: textFieldSchema,
  rationale: textFieldSchema,
  confidence: chartConfidenceSchema,
  verdict: textFieldSchema,
});


const projectionCardSchema = z.object({
  type: z.literal("projection"),
  months: z.number().int().positive(),
  startBalance: z.number().nonnegative(),
  monthlyAdd: z.number().nonnegative(),
  currencySymbol: textFieldSchema.optional(),
  projectedBalance: z.number().nonnegative(),
  dataPoints: z.array(z.number().nonnegative()).min(1),
  totalReturn: textFieldSchema,
  lossEvents: z.number().int().nonnegative(),
  verdict: textFieldSchema,
});

const askCardTypeSchema = z.enum([
  "broker",
  "briefing",
  "calc",
  "guru",
  "insight",
  "plan",
  "chart",
  "setup",
  "projection",
]);

export const askCardSchema = z.discriminatedUnion("type", [
  brokerCardSchema,
  briefingCardSchema,
  calcCardSchema,
  guruCardSchema,
  insightCardSchema,
  planCardSchema,
  chartCardSchema,
  setupCardSchema,
  projectionCardSchema,
]);

export const askSessionMemorySchema = z
  .object({
    activeAsset: z.string().trim().min(1).optional(),
    activeSide: z.enum(["buy", "sell"]).optional(),
    lastCardType: askCardTypeSchema.optional(),
    lastSetup: z
      .object({
        entry: z.string().trim().min(1),
        stop: z.string().trim().min(1),
        target: z.string().trim().min(1),
        bias: z.enum(["Bullish", "Bearish", "Neutral"]),
      })
      .optional(),
    lastProjection: z
      .object({
        months: z.number().int().positive(),
        startBalance: z.number().nonnegative(),
        monthlyAdd: z.number().nonnegative(),
        totalReturn: z.string().trim().min(1),
      })
      .optional(),
    lastPlan: z
      .object({
        startBalance: z.number().nonnegative(),
        monthlyAdd: z.number().nonnegative(),
        dailyTarget: z.string().trim().min(1),
        monthlyTarget: z.string().trim().min(1),
        projectionReturn: z.string().trim().min(1),
      })
      .optional(),
    lastVerifiedEntity: z
      .object({
        name: z.string().trim().min(1),
        status: z.string().trim().min(1),
        kind: z.enum(["broker", "guru"]),
      })
      .optional(),
    recentUserGoals: z.array(z.string().trim().min(1)).max(3).optional(),
    openQuestion: z.string().trim().min(1).optional(),
    lastUpdatedAt: z.string().trim().min(1).optional(),
  })
  .strict();

export const askRequestSchema = z
  .object({
    message: z.string().trim().max(4_000),
    image: z
      .string()
      .trim()
      .min(1)
      .max(10_000_000)
      .nullable()
      .optional(),
    sessionId: z.string().uuid().nullable().optional(),
    chatSessionId: z.string().uuid().nullable().optional(),
    attachmentMeta: z
      .object({
        fileName: z.string().trim().min(1).nullable().optional(),
        mimeType: z.string().trim().min(1).nullable().optional(),
        size: z.number().nonnegative().nullable().optional(),
        storagePath: z.string().trim().min(1).nullable().optional(),
        previewUrl: z.string().trim().url().nullable().optional(),
      })
      .nullable()
      .optional(),
    sessionMemory: askSessionMemorySchema.nullable().optional(),
    history: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().trim().min(1),
        }),
      )
      .max(ASK_MODEL_HISTORY_LIMIT)
      .optional()
      .default([]),
  })
  .superRefine((value, ctx) => {
    if (value.message || value.image) {
      return;
    }

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "A message or image is required.",
      path: ["message"],
    });
  });

/**
 * http(s) only. z.url() accepts javascript:/data: URIs, which must never reach a
 * rendered <a href>; this is the single source of truth for "a safe source link".
 */
export const httpUrlSchema = z
  .string()
  .trim()
  .refine((value) => {
    try {
      const protocol = new URL(value).protocol;
      return protocol === "http:" || protocol === "https:";
    } catch {
      return false;
    }
  }, "Must be an http(s) URL");

/**
 * One independently confirmed fact on a developing firm's card. The single shape
 * shared by the DB reader, the tool input, and the uiMeta boundary — declare a
 * field once here so the four call sites can never drift (they used to disagree
 * on whether sourceUrl was required).
 */
export const cardConfirmedFactSchema = z.object({
  text: z.string().trim().min(1).max(500),
  sourceLabel: z.string().trim().min(1).max(120).nullable().optional(),
  sourceUrl: httpUrlSchema.nullable().optional(),
});

/** Curated structured facts for a firm whose research is still developing. */
export const entityCardFactsSchema = z.object({
  confirmed: z.array(cardConfirmedFactSchema),
  unconfirmed: z.array(z.string().trim().min(1).max(500)),
  footer: z.string().trim().min(1).nullable(),
});

export type CardConfirmedFact = z.infer<typeof cardConfirmedFactSchema>;
export type EntityCardFacts = z.infer<typeof entityCardFactsSchema>;

const askAttachmentMetaSchema = z
  .object({
    fileName: z.string().trim().min(1).nullable().optional(),
    mimeType: z.string().trim().min(1).nullable().optional(),
    size: z.number().nonnegative().nullable().optional(),
    storagePath: z.string().trim().min(1).nullable().optional(),
    previewUrl: z.string().trim().url().nullable().optional(),
  })
  .nullable();

export const askUiMetaSchema = z
  .object({
    marketSeries: z.array(z.number()).min(2).optional(),
    marketSourceLabel: z.string().trim().min(1).optional(),
    marketLevelScopeLabel: z.string().trim().min(1).optional(),
    projectionMarkers: z.array(z.number().int().nonnegative()).optional(),
    verificationKind: z.enum(["broker", "propfirm"]).optional(),
    verificationSourceLabel: z.string().trim().min(1).optional(),
    // Prop-firm extras shown alongside the reused broker card: the trust band,
    // the "Not yet rated" state, and the Trustpilot snapshot the score rests on.
    propFirm: z
      .object({
        band: z.string().trim().min(1).optional(),
        notRated: z.boolean().optional(),
        // Authoritative "research still developing" flag, computed once server-side
        // so the card never re-derives (and disagrees about) developing state.
        developing: z.boolean().optional(),
        trustpilotRating: z.number().optional(),
        trustpilotCount: z.number().int().nonnegative().optional(),
        trustpilotDate: z.string().trim().min(1).optional(),
        researchStatus: z.string().trim().min(1).optional(),
        confirmedFacts: z.array(cardConfirmedFactSchema).optional(),
        unconfirmedClaims: z.array(z.string().trim().min(1)).optional(),
        reverifyTrigger: z.string().trim().min(1).optional(),
      })
      .optional(),
    // Tappable next-question suggestions under the answer (in the user's voice).
    // Lives in uiMeta so it persists with the message and survives a refresh.
    followups: z.array(z.string().trim().min(1).max(120)).max(3).optional(),
  })
  .optional();

export const askStreamSessionSchema = z.object({
  sessionId: z.string().uuid(),
  messageId: z.string().uuid(),
});

export const askResponseSchema = z.object({
  data: askCardSchema,
  uiMeta: askUiMetaSchema,
  sessionId: z.string().uuid(),
  messageId: z.string().uuid(),
});

const askHistoryPageMessageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["user", "assistant"]),
  content: z.string().trim(),
  card: askCardSchema.nullable(),
  uiMeta: askUiMetaSchema.nullable().optional(),
  attachmentMeta: askAttachmentMetaSchema.optional(),
  createdAt: z.string().trim().min(1),
});

export const askHistoryPageSchema = z.object({
  messages: z.array(askHistoryPageMessageSchema),
  nextCursor: z.string().trim().min(1).nullable(),
});

const askSessionListItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1),
  updatedAt: z.string().trim().min(1),
});

export const askSessionListSchema = z.object({
  sessions: z.array(askSessionListItemSchema),
  nextCursor: z.string().trim().min(1).nullable(),
});

export type AskCard = z.infer<typeof askCardSchema>;
export type AskRequest = z.input<typeof askRequestSchema>;
export type AskResponse = z.infer<typeof askResponseSchema>;
export type AskUiMeta = NonNullable<z.infer<typeof askResponseSchema>["uiMeta"]>;
export type AskStreamSession = z.infer<typeof askStreamSessionSchema>;
export type AskAttachmentMeta = NonNullable<z.infer<typeof askAttachmentMetaSchema>>;
export type AskSessionMemory = z.infer<typeof askSessionMemorySchema>;
export type AskHistoryPageMessage = z.infer<typeof askHistoryPageMessageSchema>;
export type AskHistoryPage = z.infer<typeof askHistoryPageSchema>;
export type AskSessionListItem = z.infer<typeof askSessionListItemSchema>;
export type BrokerCard = z.infer<typeof brokerCardSchema>;
export type GuruCard = z.infer<typeof guruCardSchema>;
export type BriefingCard = z.infer<typeof briefingCardSchema>;
export type CalcCard = z.infer<typeof calcCardSchema>;
export type InsightCard = z.infer<typeof insightCardSchema>;
export type PlanCard = z.infer<typeof planCardSchema>;
export type ChartCard = z.infer<typeof chartCardSchema>;
export type SetupCard = z.infer<typeof setupCardSchema>;
export type ProjectionCard = z.infer<typeof projectionCardSchema>;

export const fallbackInsightCard: InsightCard = {
  type: "insight",
  headline: "Need More Detail",
  body: "I need a little more context to answer this properly.",
  verdict: "Send the asset, setup, broker, or calculation you want checked.",
};

/** Shown when an image was attached but no card could be produced from it. */
export const imageFallbackInsightCard: InsightCard = {
  type: "insight",
  headline: "Couldn't Read That Chart",
  body: "I couldn't make out that chart clearly enough to analyse it.",
  verdict: "Resend a sharper screenshot and name the asset and timeframe.",
};

function trimToWordLimit(value: string, maxWords: number) {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return value;
  }

  return words.slice(0, maxWords).join(" ").replace(/[,.!?;:]+$/u, "");
}

function limitSentences(value: string, maxSentences: number) {
  const decimalPlaceholder = "__ASK_DECIMAL_POINT__";
  const protectedValue = value.replace(/(?<=\d)\.(?=\d)/g, decimalPlaceholder);
  const sentences = protectedValue.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  if (!sentences || sentences.length <= maxSentences) {
    return value;
  }

  return sentences
    .slice(0, maxSentences)
    .join(" ")
    .replaceAll(decimalPlaceholder, ".")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Some OpenAI-compatible gateways leak their internal web-search references into the
// model's text. These are implementation details, not user-facing citations: the actual
// source URL (when available) lives in a dedicated URL field and is intentionally untouched.
const INTERNAL_TOOL_REFERENCE = /turn\d+(?:search|news|fetch|view|source)\d+/giu;
const BRACKETED_INTERNAL_TOOL_REFERENCE = /[【〖⟦\[][^】〗⟧\]]*turn\d+(?:search|news|fetch|view|source)\d+[^】〗⟧\]]*[】〗⟧\]]?/giu;
const PRIVATE_CITATION_BLOCK = /\uE200\s*cite(?:\s*\uE202\s*turn\d+(?:search|news|fetch|view|source)\d+)+\s*\uE201/giu;
const PRIVATE_CITATION_PREFIX = /\uE200\s*cite(?:\s*\uE202)?/giu;
const CITATION_LABEL = /[【〖⟦]\s*(?:cite|citation)\s*[】〗⟧]/giu;
const REPLACEMENT_CITATION_LABEL = /\uFFFD\s*(?:cite|citation)\s*\uFFFD?/giu;

/** Remove gateway/tool citation markers while preserving ordinary prose and source URLs. */
export function stripAskInternalCitationMarkers(value: string): string {
  return value
    .replace(PRIVATE_CITATION_BLOCK, " ")
    .replace(PRIVATE_CITATION_PREFIX, " ")
    .replace(BRACKETED_INTERNAL_TOOL_REFERENCE, " ")
    .replace(INTERNAL_TOOL_REFERENCE, " ")
    .replace(CITATION_LABEL, " ")
    .replace(REPLACEMENT_CITATION_LABEL, " ")
    // The private-use citation delimiters can remain after a malformed block; they are
    // never meaningful in model prose, so remove only those delimiters (not normal text).
    .replace(/[\uE200-\uE202]/gu, " ")
    // Unsupported gateway glyphs sometimes arrive as U+FFFD around the same marker.
    .replace(/\uFFFD/gu, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;!?])/g, "$1")
    .trim();
}

function sanitizeNaturalLanguageField(
  value: string,
  limits?: { maxSentences?: number; maxWords?: number },
): string;
function sanitizeNaturalLanguageField(
  value: null,
  limits?: { maxSentences?: number; maxWords?: number },
): null;
function sanitizeNaturalLanguageField(
  value: string | null,
  limits?: { maxSentences?: number; maxWords?: number },
): string | null;
function sanitizeNaturalLanguageField(
  value: string | null,
  limits: { maxSentences?: number; maxWords?: number } = {},
): string | null {
  if (value === null) {
    return value;
  }

  const normalized = stripAskInternalCitationMarkers(value)
    .replace(/[\u2010-\u2015]/g, ",")
    .replace(/\s+-\s+/g, ", ")
    .replace(/(?<=\p{L})-(?=\p{L})/gu, " ")
    .replace(/\s+,/g, ",")
    .replace(/,{2,}/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!normalized) {
    return "No additional detail available.";
  }

  const sentenceLimited =
    limits.maxSentences === undefined
      ? normalized
      : limitSentences(normalized, limits.maxSentences);

  return limits.maxWords === undefined
    ? sentenceLimited
    : trimToWordLimit(sentenceLimited, limits.maxWords);
}

function sanitizeCardNaturalLanguage(card: AskCard): AskCard {
  switch (card.type) {
    case "broker":
      return {
        ...card,
        verdict: sanitizeNaturalLanguageField(card.verdict, { maxSentences: 3 }),
      };
    case "briefing":
      return {
        ...card,
        event: sanitizeNaturalLanguageField(card.event, { maxSentences: 1 }),
        verdict: sanitizeNaturalLanguageField(card.verdict, { maxSentences: 3 }),
      };
    case "calc":
      return {
        ...card,
        verdict: sanitizeNaturalLanguageField(card.verdict, { maxSentences: 2 }),
      };
    case "guru":
      return {
        ...card,
        verdict: sanitizeNaturalLanguageField(card.verdict, { maxSentences: 3 }),
      };
    case "insight":
      return {
        ...card,
        headline: sanitizeNaturalLanguageField(card.headline),
        body: sanitizeNaturalLanguageField(card.body, { maxSentences: 3 }),
        verdict: sanitizeNaturalLanguageField(card.verdict, { maxSentences: 2 }),
      };
    case "plan":
      return {
        ...card,
        rationale: sanitizeNaturalLanguageField(card.rationale, { maxSentences: 3 }),
        verdict: sanitizeNaturalLanguageField(card.verdict, { maxSentences: 2 }),
      };
    case "chart":
      return {
        ...card,
        verdict: sanitizeNaturalLanguageField(card.verdict, { maxSentences: 2 }),
      };
    case "setup":
      return {
        ...card,
        rationale: sanitizeNaturalLanguageField(card.rationale, { maxSentences: 3 }),
        verdict: sanitizeNaturalLanguageField(card.verdict, { maxSentences: 2 }),
      };
    case "projection":
      return {
        ...card,
        verdict: sanitizeNaturalLanguageField(card.verdict, { maxSentences: 2 }),
      };
  }
}

export function sanitizeCard(card: AskCard): AskCard {
  const clonedCard = JSON.parse(JSON.stringify(card)) as AskCard;
  for (const [key, value] of Object.entries(clonedCard)) {
    if (key !== "citationUrl" && typeof value === "string") {
      const cleaned = stripAskInternalCitationMarkers(value);
      (clonedCard as Record<string, unknown>)[key] = cleaned || "Unavailable";
    }
  }

  return sanitizeCardNaturalLanguage(clonedCard);
}

export function sanitizeUiMeta(uiMeta: AskUiMeta | undefined): AskUiMeta | undefined {
  if (!uiMeta) {
    return undefined;
  }

  const sanitized = JSON.parse(JSON.stringify(uiMeta)) as AskUiMeta;
  const record = sanitized as unknown as Record<string, unknown>;
  const cleanOptionalText = (owner: Record<string, unknown>, key: string) => {
    const value = owner[key];
    if (typeof value !== "string") {
      return;
    }

    const cleaned = stripAskInternalCitationMarkers(value);
    if (cleaned) {
      owner[key] = cleaned;
    } else {
      delete owner[key];
    }
  };

  for (const key of [
    "marketSourceLabel",
    "marketLevelScopeLabel",
    "verificationSourceLabel",
  ]) {
    cleanOptionalText(record, key);
  }

  const propFirm = record.propFirm;
  if (propFirm && typeof propFirm === "object" && !Array.isArray(propFirm)) {
    const propFirmRecord = propFirm as Record<string, unknown>;
    for (const key of ["band", "researchStatus", "reverifyTrigger"]) {
      cleanOptionalText(propFirmRecord, key);
    }

    if (Array.isArray(propFirmRecord.confirmedFacts)) {
      propFirmRecord.confirmedFacts = propFirmRecord.confirmedFacts
        .filter((fact): fact is Record<string, unknown> => Boolean(fact && typeof fact === "object" && !Array.isArray(fact)))
        .map((fact) => {
          cleanOptionalText(fact, "text");
          cleanOptionalText(fact, "sourceLabel");
          return fact;
        })
        .filter((fact) => typeof fact.text === "string" && fact.text.length > 0);
    }

    if (Array.isArray(propFirmRecord.unconfirmedClaims)) {
      propFirmRecord.unconfirmedClaims = propFirmRecord.unconfirmedClaims
        .map((claim) => (typeof claim === "string" ? stripAskInternalCitationMarkers(claim) : ""))
        .filter((claim) => claim.length > 0);
    }
  }

  if (Array.isArray(record.followups)) {
    record.followups = record.followups
      .map((followup) => (typeof followup === "string" ? stripAskInternalCitationMarkers(followup) : ""))
      .filter((followup) => followup.length > 0);
  }

  return sanitized;
}
