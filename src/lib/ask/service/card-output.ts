import { z } from "zod";

import { askCardSchema, type AskCard } from "@/lib/ask/contracts";

export const askCardOutputEnvelopeSchema = z.object({
  card_json: z
    .string()
    .describe("A single JSON object string for the final response card. It must match the ask card schema exactly."),
});

function buildInsightCard(headline: string, body: string, verdict: string): AskCard {
  return {
    type: "insight",
    headline,
    body,
    verdict,
  };
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeBriefingCard(value: unknown) {
  const card = asRecord(value);
  if (!card) {
    return value;
  }

  if (card.type !== "briefing") {
    return card;
  }

  const normalized = { ...card };
  if (!("event" in normalized)) {
    normalized.event = null;
  }

  if (typeof normalized.direction !== "string") {
    const change = typeof normalized.change === "string" ? normalized.change.trim() : "";
    if (change.startsWith("-")) {
      normalized.direction = "down";
    } else if (change.startsWith("+")) {
      normalized.direction = "up";
    }
  }

  return normalized;
}

type JsonParseResult =
  | { success: true; value: unknown }
  | { success: false };

function parseCardJson(value: string): JsonParseResult {
  try {
    return { success: true, value: JSON.parse(value) as unknown };
  } catch {
    return { success: false };
  }
}

function parseEnvelopeCandidate(value: unknown) {
  const envelope = askCardOutputEnvelopeSchema.safeParse(value);
  if (!envelope.success) {
    return null;
  }

  const parsed = parseCardJson(envelope.data.card_json);
  return parsed.success ? parsed.value : null;
}

function safeParseNormalizedCard(value: unknown) {
  return askCardSchema.safeParse(normalizeBriefingCard(value));
}

export function parseAskCardCandidate(value: unknown): AskCard | null {
  const directCard = safeParseNormalizedCard(value);
  if (directCard.success) {
    return directCard.data;
  }

  const envelopeCard = parseEnvelopeCandidate(value);
  if (!envelopeCard) {
    return null;
  }

  const nestedCard = safeParseNormalizedCard(envelopeCard);
  return nestedCard.success ? nestedCard.data : null;
}

export function parseSubmittedAskCardJson(cardJson: string): AskCard {
  const parsed = parseCardJson(cardJson);
  if (!parsed.success) {
    throw new Error("submit_ask_card: card_json must be valid JSON.");
  }

  const result = safeParseNormalizedCard(parsed.value);
  if (!result.success) {
    throw new Error(`submit_ask_card: ${result.error.message}`);
  }

  return result.data;
}

function readLooseText(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value !== "string") {
      continue;
    }

    const normalized = normalizeWhitespace(value);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function readLooseCardObject(value: unknown) {
  return asRecord(parseEnvelopeCandidate(value) ?? value);
}

export function buildInsightCardFromLooseCard(value: unknown): AskCard | null {
  const card = readLooseCardObject(value);
  if (!card) {
    return null;
  }

  const headline =
    readLooseText(card, ["headline", "title", "asset", "name", "broker"]) ?? "Quick Read";
  const verdict = readLooseText(card, ["verdict", "summary", "rationale", "body"]);
  const level1 = readLooseText(card, ["level1"]);
  const level2 = readLooseText(card, ["level2"]);
  let body = readLooseText(card, ["body", "rationale", "summary", "verdict"]);
  if (!body && (level1 || level2)) {
    body = `Key area one: ${level1 ?? "not provided"}. Key area two: ${level2 ?? "not provided"}.`;
  }

  if (!body && !verdict) {
    return null;
  }

  return buildInsightCard(
    headline,
    body ?? "I have partial context, but not enough clean detail for a full structured card.",
    verdict ?? "Ask for the asset, levels, setup, broker, or calculation you want checked.",
  );
}
