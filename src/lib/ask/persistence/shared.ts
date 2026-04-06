import { askCardSchema, type AskCard, type AskHistoryPageMessage } from "@/lib/ask/contracts";

export function inferSessionTitle(message: string) {
  return message.trim().slice(0, 80) || "New Ask Session";
}

export function inferSessionTitleFromInput(
  message: string,
  attachmentFileName?: string | null,
) {
  const trimmedMessage = message.trim();
  if (trimmedMessage) {
    return inferSessionTitle(trimmedMessage);
  }

  const trimmedAttachmentName = attachmentFileName?.trim();
  if (trimmedAttachmentName) {
    return inferSessionTitle(trimmedAttachmentName);
  }

  return "Chart Upload";
}

export function clampHistoryLimit(limit = 20) {
  return Math.max(10, Math.min(40, limit));
}

export function encodeHistoryCursor(record: { id: string; createdAt: string }) {
  return Buffer.from(JSON.stringify(record)).toString("base64url");
}

export function decodeHistoryCursor(cursor: string) {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      id?: unknown;
      createdAt?: unknown;
    };

    if (typeof parsed.id !== "string" || typeof parsed.createdAt !== "string") {
      return null;
    }

    return {
      id: parsed.id,
      createdAt: parsed.createdAt,
    };
  } catch {
    return null;
  }
}

export function encodeSessionCursor(record: { id: string; updatedAt: string }) {
  return Buffer.from(JSON.stringify(record)).toString("base64url");
}

export function decodeSessionCursor(cursor: string) {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      id?: unknown;
      updatedAt?: unknown;
    };

    if (typeof parsed.id !== "string" || typeof parsed.updatedAt !== "string") {
      return null;
    }

    return {
      id: parsed.id,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

export function parseStoredCard(
  cardPayload: unknown,
  fallbackContent: string,
): AskCard | null {
  const parsedPayload = askCardSchema.safeParse(cardPayload);
  if (parsedPayload.success) {
    return parsedPayload.data;
  }

  try {
    const parsedContent = JSON.parse(fallbackContent) as unknown;
    const parsedCard = askCardSchema.safeParse(parsedContent);
    return parsedCard.success ? parsedCard.data : null;
  } catch {
    return null;
  }
}

export function toHistory(messages: AskHistoryPageMessage[]) {
  return messages
    .slice(-10)
    .filter((message) => message.role === "assistant" || message.content.trim().length > 0)
    .map(({ role, content }) => ({ role, content }));
}
