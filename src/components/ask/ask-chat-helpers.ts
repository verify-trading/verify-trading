"use client";

import type { UIMessage } from "@ai-sdk/react";

import {
  askCardSchema,
  askHistoryPageSchema,
  askSessionListSchema,
  askStreamSessionSchema,
  askUiMetaSchema,
  type AskCard,
  type AskStreamSession,
  type AskUiMeta,
} from "@/lib/ask/contracts";
import { ASK_HISTORY_PAGE_SIZE } from "@/lib/ask/config";

export const suggestionPrompts = [
  "Is Pepperstone safe for UK retail CFD?",
  "Gold — key levels before London open",
  "Position size: 1% risk, £8k, 22 pip stop",
  "24-month projection: £10k start, £400/month",
];

export type AskStreamData = {
  "ui-meta": AskUiMeta;
  session: AskStreamSession;
};

export type AskChatMessage = UIMessage<unknown, AskStreamData>;
type AskChatPart = AskChatMessage["parts"][number];
type AskTextPart = Extract<AskChatPart, { type: "text" }>;
type AskUiMetaPart = Extract<AskChatPart, { type: "data-ui-meta" }>;
type AskSessionPart = Extract<AskChatPart, { type: "data-session" }>;

export function isDefined<T>(value: T | null): value is T {
  return value !== null;
}

export function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read image."));
    reader.readAsDataURL(file);
  });
}

export async function fetchHistoryPage(sessionId: string, cursor?: string | null) {
  const params = new URLSearchParams({
    sessionId,
    limit: String(ASK_HISTORY_PAGE_SIZE),
  });
  if (cursor) {
    params.set("cursor", cursor);
  }

  const response = await fetch(`/api/ask/history?${params.toString()}`);
  const json = await response.json();
  const parsed = askHistoryPageSchema.safeParse(json);

  if (!response.ok || !parsed.success) {
    throw new Error("Failed to load chat history.");
  }

  return parsed.data;
}

export async function fetchSessionList(limit = 40, cursor?: string | null) {
  const params = new URLSearchParams({
    limit: String(limit),
  });
  if (cursor) {
    params.set("cursor", cursor);
  }

  const response = await fetch(`/api/ask/sessions?${params.toString()}`);
  const json = await response.json();
  const parsed = askSessionListSchema.safeParse(json);

  if (!response.ok || !parsed.success) {
    throw new Error("Failed to load chat sessions.");
  }

  return parsed.data;
}

export async function deleteAskSession(sessionId: string) {
  const response = await fetch(`/api/ask/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to delete chat session.");
  }
}

function extractJson(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace <= firstBrace) {
      return null;
    }

    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as unknown;
    } catch {
      return null;
    }
  }
}

export function extractAssistantCard(message: AskChatMessage): AskCard | null {
  const text = message.parts
    .filter((part): part is AskTextPart => part.type === "text")
    .map((part) => part.text)
    .join("");

  const parsedPayload = extractJson(text);
  const parsedCard = askCardSchema.safeParse(parsedPayload);

  return parsedCard.success ? parsedCard.data : null;
}

export function extractUiMeta(message: AskChatMessage) {
  const uiMetaPart = message.parts.find(
    (part): part is AskUiMetaPart => part.type === "data-ui-meta",
  );

  if (!uiMetaPart) {
    return undefined;
  }

  const parsed = askUiMetaSchema.safeParse(uiMetaPart.data);
  return parsed.success ? parsed.data : undefined;
}

export function extractSessionData(message: AskChatMessage) {
  const sessionPart = message.parts.find(
    (part): part is AskSessionPart => part.type === "data-session",
  );

  if (!sessionPart) {
    return undefined;
  }

  const parsed = askStreamSessionSchema.safeParse(sessionPart.data);
  return parsed.success ? parsed.data : undefined;
}
