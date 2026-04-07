import type { AskCard, AskUiMeta } from "@/lib/ask/contracts";
import { decodeImageDataUrl } from "@/lib/ask/image-data-url";

import type { ParsedImageInput } from "@/lib/ask/service/types";

type ToolResultRecord = {
  toolName?: string;
  output?: unknown;
};

export function parseImageDataUrl(image: string | null | undefined): ParsedImageInput | null {
  if (!image) {
    return null;
  }

  const { mimeType, bytes } = decodeImageDataUrl(image);

  return {
    mediaType: mimeType as ParsedImageInput["mediaType"],
    base64: bytes.toString("base64"),
  };
}

export function extractJson(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first === -1 || last === -1 || last <= first) {
      return null;
    }

    try {
      return JSON.parse(trimmed.slice(first, last + 1)) as unknown;
    } catch {
      return null;
    }
  }
}

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function extractToolUiMeta(
  card: AskCard,
  toolResults: ToolResultRecord[],
): AskUiMeta | undefined {
  for (const result of toolResults) {
    const output = asObject(result.output);
    const nestedUiMeta = asObject(output?.uiMeta);
    if (!nestedUiMeta) {
      continue;
    }

    if (card.type === "briefing" || card.type === "setup") {
      if (
        Array.isArray(nestedUiMeta.marketSeries) &&
        nestedUiMeta.marketSeries.every((value) => typeof value === "number")
      ) {
        return {
          marketSeries: nestedUiMeta.marketSeries as number[],
          ...(typeof nestedUiMeta.marketSourceLabel === "string"
            ? { marketSourceLabel: nestedUiMeta.marketSourceLabel }
            : {}),
          ...(typeof nestedUiMeta.marketLevelScopeLabel === "string"
            ? { marketLevelScopeLabel: nestedUiMeta.marketLevelScopeLabel }
            : {}),
        };
      }
    }

    if (card.type === "broker") {
      const verificationKind =
        nestedUiMeta.verificationKind === "broker" || nestedUiMeta.verificationKind === "propfirm"
          ? nestedUiMeta.verificationKind
          : undefined;
      const verificationSourceLabel = nestedUiMeta.verificationSourceLabel;

      if (
        verificationKind ||
        typeof verificationSourceLabel === "string"
      ) {
        return {
          ...(verificationKind ? { verificationKind } : {}),
          ...(typeof verificationSourceLabel === "string"
            ? { verificationSourceLabel }
            : {}),
        };
      }
    }
  }

  return undefined;
}

export function extractSubmitAskCard(
  toolResults: ToolResultRecord[],
  askCardSchema: {
    safeParse: (value: unknown) => { success: boolean; data?: AskCard };
  },
): AskCard | null {
  for (let index = toolResults.length - 1; index >= 0; index -= 1) {
    const result = toolResults[index];
    if (result.toolName !== "submit_ask_card") {
      continue;
    }

    const output = asObject(result.output);
    const nestedParsed = askCardSchema.safeParse(output?.card);
    if (nestedParsed.success && nestedParsed.data) {
      return nestedParsed.data;
    }
  }

  return null;
}

export function extractToolCard(toolResults: ToolResultRecord[], askCardSchema: {
  safeParse: (value: unknown) => { success: boolean; data?: AskCard };
}) {
  for (const result of toolResults) {
    if (result.toolName === "submit_ask_card") {
      continue;
    }

    const output = asObject(result.output);
    const nested = output?.card;
    const nestedParsed = askCardSchema.safeParse(nested);
    if (nestedParsed.success && nestedParsed.data) {
      return nestedParsed.data;
    }
  }

  return null;
}

function buildProjectionMarkers(card: AskCard) {
  if (card.type !== "projection" || card.lossEvents <= 0 || card.dataPoints.length <= 1) {
    return undefined;
  }

  const markers: number[] = [];
  const spacing = card.dataPoints.length / (card.lossEvents + 1);

  for (let index = 1; index <= card.lossEvents; index += 1) {
    markers.push(
      Math.max(0, Math.min(card.dataPoints.length - 1, Math.round(index * spacing) - 1)),
    );
  }

  return markers;
}

export function extractUiMeta(
  card: AskCard,
  toolResults: Array<{ output?: unknown }>,
): AskUiMeta | undefined {
  const toolUiMeta: AskUiMeta | undefined = extractToolUiMeta(card, toolResults);
  const projectionMarkers = buildProjectionMarkers(card);

  if (!toolUiMeta && !projectionMarkers) {
    return undefined;
  }

  return {
    ...(toolUiMeta ?? {}),
    ...(projectionMarkers ? { projectionMarkers } : {}),
  };
}
