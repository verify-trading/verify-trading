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

export const brokerCardSchema = z.object({
  type: z.literal("broker"),
  name: textFieldSchema,
  score: textFieldSchema,
  status: brokerStatusSchema,
  fca: booleanStringSchema,
  complaints: z.enum(["Low", "Medium", "High"]),
  verdict: textFieldSchema,
  color: cardColorSchema,
});

export const briefingCardSchema = z.object({
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

export const calcCardSchema = z.object({
  type: z.literal("calc"),
  lots: textFieldSchema,
  risk_amount: textFieldSchema,
  account: textFieldSchema,
  risk_pct: textFieldSchema,
  sl_pips: textFieldSchema,
  verdict: textFieldSchema,
});

export const guruCardSchema = z.object({
  type: z.literal("guru"),
  name: textFieldSchema,
  score: textFieldSchema,
  status: brokerStatusSchema,
  verified: booleanStringSchema,
  verdict: textFieldSchema,
  color: cardColorSchema,
});

export const insightCardSchema = z.object({
  type: z.literal("insight"),
  headline: textFieldSchema,
  body: textFieldSchema,
  verdict: textFieldSchema,
});

export const planCardSchema = z.object({
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

export const chartCardSchema = z.object({
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

export const setupCardSchema = z.object({
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


export const projectionCardSchema = z.object({
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

export const askAttachmentMetaSchema = z
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

export const askHistoryPageMessageSchema = z.object({
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

export const askSessionListItemSchema = z.object({
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
  headline: "Try Again",
  body: "Something went wrong with that query.",
  verdict: "Please rephrase your question.",
};

export function sanitizeCard(card: AskCard): AskCard {
  return JSON.parse(JSON.stringify(card)) as AskCard;
}

export function sanitizeUiMeta(uiMeta: AskUiMeta | undefined): AskUiMeta | undefined {
  if (!uiMeta) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(uiMeta)) as AskUiMeta;
}
