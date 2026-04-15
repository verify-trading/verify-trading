import {
  type AskAttachmentMeta,
  type AskCard,
  type AskHistoryPageMessage,
  type AskSessionMemory,
  type AskSessionListItem,
  type AskUiMeta,
} from "@/lib/ask/contracts";
import { ASK_MODEL_HISTORY_LIMIT } from "@/lib/ask/config";

import {
  clampHistoryLimit,
  decodeSessionCursor,
  encodeSessionCursor,
  decodeHistoryCursor,
  inferSessionTitleFromInput,
  encodeHistoryCursor,
  toHistory,
} from "@/lib/ask/persistence/shared";
import { type AskPersistence, type PersistAskExchangeInput } from "@/lib/ask/persistence/types";

type MemoryRecord = AskHistoryPageMessage & {
  card: AskCard | null;
  attachmentMeta: AskAttachmentMeta | null;
  uiMeta?: AskUiMeta | null;
};

const memorySessions = new Map<string, MemoryRecord[]>();
const memorySessionList = new Map<string, AskSessionListItem>();
const memorySessionMemory = new Map<string, AskSessionMemory | null>();

export function createMemoryPersistence(): AskPersistence {
  const persistence: AskPersistence = {
    async listSessions(limit = 40, cursor = null) {
      const sortedSessions = [...memorySessionList.values()].sort((left, right) =>
        right.updatedAt === left.updatedAt
          ? right.id.localeCompare(left.id)
          : right.updatedAt.localeCompare(left.updatedAt),
      );
      const decodedCursor = cursor ? decodeSessionCursor(cursor) : null;
      const cursorIndex = decodedCursor
        ? sortedSessions.findIndex((session) => session.id === decodedCursor.id)
        : sortedSessions.length;
      const startIndex = decodedCursor
        ? cursorIndex === -1
          ? 0
          : cursorIndex + 1
        : 0;
      const pageSize = Math.max(1, limit);
      const sessions = sortedSessions.slice(startIndex, startIndex + pageSize);
      const nextItem = sortedSessions[startIndex + pageSize];

      return {
        sessions,
        nextCursor: nextItem
          ? encodeSessionCursor({
              id: sessions.at(-1)?.id ?? "",
              updatedAt: sessions.at(-1)?.updatedAt ?? "",
            })
          : null,
      };
    },
    async deleteSession(sessionId) {
      memorySessions.delete(sessionId);
      memorySessionList.delete(sessionId);
      memorySessionMemory.delete(sessionId);
    },
    async loadSessionMemory(sessionId) {
      return memorySessionMemory.get(sessionId) ?? null;
    },
    async loadHistory(sessionId) {
      const page = await persistence.loadThreadPage(sessionId, { limit: ASK_MODEL_HISTORY_LIMIT });
      return toHistory(page.messages);
    },
    async loadThreadPage(sessionId, options = {}) {
      const limit = clampHistoryLimit(options.limit);
      const records = memorySessions.get(sessionId) ?? [];
      const decodedCursor = options.cursor ? decodeHistoryCursor(options.cursor) : null;
      const cursorIndex = decodedCursor
        ? records.findIndex((record) => record.id === decodedCursor.id)
        : records.length;
      const endIndex = cursorIndex === -1 ? records.length : cursorIndex;
      const startIndex = Math.max(0, endIndex - limit);
      const messages = records.slice(startIndex, endIndex).map((record) => ({
        id: record.id,
        role: record.role,
        content: record.content,
        card: record.card,
        uiMeta: record.uiMeta ?? null,
        attachmentMeta: record.attachmentMeta,
        createdAt: record.createdAt,
      }));

      return {
        messages,
        nextCursor:
          startIndex > 0 && messages[0]
            ? encodeHistoryCursor(messages[0])
            : null,
      };
    },
    async saveExchange(input: PersistAskExchangeInput) {
      const timestamp = new Date().toISOString();
      const records = memorySessions.get(input.sessionId) ?? [];
      const sessionListItem = memorySessionList.get(input.sessionId);
      records.push(
        {
          id: crypto.randomUUID(),
          role: "user",
          content: input.userMessage,
          card: null,
          uiMeta: null,
          attachmentMeta: input.attachmentMeta ?? null,
          createdAt: timestamp,
        },
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: JSON.stringify(input.assistantCard),
          card: input.assistantCard,
          uiMeta: input.assistantUiMeta ?? null,
          attachmentMeta: input.attachmentMeta ?? null,
          createdAt: timestamp,
        },
      );
      memorySessions.set(input.sessionId, records);
      memorySessionList.set(input.sessionId, {
        id: input.sessionId,
        title:
          sessionListItem?.title ??
          inferSessionTitleFromInput(input.userMessage, input.attachmentMeta?.fileName),
        updatedAt: timestamp,
      });
      memorySessionMemory.set(input.sessionId, input.sessionMemory ?? null);
    },
  };

  return persistence;
}

export function clearMemoryAskPersistence() {
  memorySessions.clear();
  memorySessionList.clear();
  memorySessionMemory.clear();
}
