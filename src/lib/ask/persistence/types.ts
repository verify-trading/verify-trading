import type {
  AskAttachmentMeta,
  AskCard,
  AskHistoryPage,
  AskSessionListItem,
  AskUiMeta,
} from "@/lib/ask/contracts";

export interface PersistedAskHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface PersistAskExchangeInput {
  sessionId: string;
  userMessage: string;
  assistantCard: AskCard;
  assistantUiMeta?: AskUiMeta;
  attachmentMeta?: AskAttachmentMeta | null;
  userImageDataUrl?: string | null;
}

export interface AskSessionListPage {
  sessions: AskSessionListItem[];
  nextCursor: string | null;
}

export interface AskPersistence {
  listSessions: (
    limit?: number,
    cursor?: string | null,
  ) => Promise<AskSessionListPage>;
  deleteSession: (sessionId: string) => Promise<void>;
  loadHistory: (sessionId: string) => Promise<PersistedAskHistoryMessage[]>;
  loadThreadPage: (
    sessionId: string,
    options?: {
      cursor?: string | null;
      limit?: number;
    },
  ) => Promise<AskHistoryPage>;
  saveExchange: (input: PersistAskExchangeInput) => Promise<void>;
}
