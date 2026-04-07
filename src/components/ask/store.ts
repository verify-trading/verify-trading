"use client";

import { create } from "zustand";

import type {
  AskAttachmentMeta,
  AskCard,
  AskHistoryPageMessage,
  AskUiMeta,
} from "@/lib/ask/contracts";

export interface AskAttachment {
  file: File;
  previewUrl: string;
}

export interface AskHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

const CONTEXT_WINDOW_SIZE = 6;
const MAX_CONTEXT_CHARS = 500;

export interface UserAskMessage {
  id: string;
  role: "user";
  content: string;
  createdAt: string;
  attachmentName: string | null;
  attachmentPreviewUrl?: string;
}

export interface AssistantAskMessage {
  id: string;
  role: "assistant";
  createdAt: string;
  card: AskCard;
  uiMeta?: AskUiMeta;
  attachmentPreviewUrl?: string;
}

export type AskMessage = UserAskMessage | AssistantAskMessage;

interface AskStoreState {
  draft: string;
  sessionId: string | null;
  attachment: AskAttachment | null;
  messages: AskMessage[];
  historyCursor: string | null;
  isLoadingHistory: boolean;
  isLoadingOlder: boolean;
  error: string | null;
  setDraft: (draft: string) => void;
  setAttachment: (attachment: AskAttachment | null) => void;
  clearAttachment: () => void;
  setSessionId: (sessionId: string | null) => void;
  openSession: (sessionId: string | null) => void;
  setError: (error: string | null) => void;
  startHistoryLoad: () => void;
  finishHistoryLoad: () => void;
  startOlderLoad: () => void;
  finishOlderLoad: () => void;
  hydrateThread: (messages: AskMessage[], nextCursor: string | null) => void;
  prependHistoryPage: (messages: AskMessage[], nextCursor: string | null) => void;
  appendUserMessage: (
    content: string,
    attachmentName: string | null,
    attachmentPreviewUrl?: string,
  ) => void;
  appendAssistantCard: (
    card: AskCard,
    uiMeta?: AskUiMeta,
    attachmentPreviewUrl?: string,
  ) => void;
  historyWindow: () => AskHistoryMessage[];
}

function mapAttachmentName(attachmentMeta?: AskAttachmentMeta | null) {
  return attachmentMeta?.fileName ?? null;
}

function mapAttachmentPreviewUrl(attachmentMeta?: AskAttachmentMeta | null) {
  return attachmentMeta?.previewUrl ?? undefined;
}

function trimContextText(content: string) {
  const trimmed = content.trim();
  if (trimmed.length <= MAX_CONTEXT_CHARS) {
    return trimmed;
  }

  return `${trimmed.slice(0, MAX_CONTEXT_CHARS)}…`;
}

function serializeAssistantCardForContext(card: AskCard) {
  switch (card.type) {
    case "broker":
      return JSON.stringify({
        type: card.type,
        name: card.name,
        status: card.status,
        fca: card.fca,
        verdict: card.verdict,
      });
    case "guru":
      return JSON.stringify({
        type: card.type,
        name: card.name,
        status: card.status,
        verified: card.verified,
        verdict: card.verdict,
      });
    case "briefing":
      return JSON.stringify({
        type: card.type,
        asset: card.asset,
        price: card.price,
        change: card.change,
        verdict: card.verdict,
      });
    case "calc":
      return JSON.stringify({
        type: card.type,
        lots: card.lots,
        risk_amount: card.risk_amount,
        risk_pct: card.risk_pct,
        sl_pips: card.sl_pips,
        verdict: card.verdict,
      });
    case "chart":
      return JSON.stringify({
        type: card.type,
        pattern: card.pattern,
        bias: card.bias,
        entry: card.entry,
        stop: card.stop,
        target: card.target,
        verdict: card.verdict,
      });
    case "setup":
      return JSON.stringify({
        type: card.type,
        asset: card.asset,
        bias: card.bias,
        entry: card.entry,
        stop: card.stop,
        target: card.target,
        verdict: card.verdict,
      });
    case "plan":
      return JSON.stringify({
        type: card.type,
        startBalance: card.startBalance,
        monthlyAdd: card.monthlyAdd,
        currencySymbol: card.currencySymbol,
        dailyTarget: card.dailyTarget,
        weeklyTarget: card.weeklyTarget,
        monthlyTarget: card.monthlyTarget,
        projectedBalance: card.projectedBalance,
        projectionMonths: card.projectionMonths,
        projectionReturn: card.projectionReturn,
        verdict: card.verdict,
      });
    case "projection":
      return JSON.stringify({
        type: card.type,
        months: card.months,
        startBalance: card.startBalance,
        monthlyAdd: card.monthlyAdd,
        currencySymbol: card.currencySymbol,
        projectedBalance: card.projectedBalance,
        totalReturn: card.totalReturn,
        lossEvents: card.lossEvents,
        verdict: card.verdict,
      });
    case "insight":
      return JSON.stringify({
        type: card.type,
        headline: card.headline,
        body: card.body,
        verdict: card.verdict,
      });
  }
}

export function mapPersistedMessageToStoreMessage(
  message: AskHistoryPageMessage,
): AskMessage | null {
  if (message.role === "assistant") {
    if (!message.card) {
      return null;
    }

    return {
      id: message.id,
      role: "assistant",
      createdAt: message.createdAt,
      card: message.card,
      ...(message.uiMeta ? { uiMeta: message.uiMeta } : {}),
      ...(mapAttachmentPreviewUrl(message.attachmentMeta)
        ? { attachmentPreviewUrl: mapAttachmentPreviewUrl(message.attachmentMeta) }
        : {}),
    };
  }

  return {
    id: message.id,
    role: "user",
    createdAt: message.createdAt,
    content: message.content,
    attachmentName: mapAttachmentName(message.attachmentMeta),
    ...(mapAttachmentPreviewUrl(message.attachmentMeta)
      ? { attachmentPreviewUrl: mapAttachmentPreviewUrl(message.attachmentMeta) }
      : {}),
  };
}

export const useAskStore = create<AskStoreState>()(
  (set, get) => ({
    draft: "",
    sessionId: null,
    attachment: null,
    messages: [],
    historyCursor: null,
    isLoadingHistory: false,
    isLoadingOlder: false,
    error: null,
    setDraft: (draft) => set({ draft }),
    setAttachment: (attachment) => {
      const previous = get().attachment;
      if (previous?.previewUrl && previous.previewUrl !== attachment?.previewUrl) {
        URL.revokeObjectURL(previous.previewUrl);
      }
      set({ attachment, error: null });
    },
    clearAttachment: () => {
      const previous = get().attachment;
      if (previous?.previewUrl) {
        URL.revokeObjectURL(previous.previewUrl);
      }
      set({ attachment: null });
    },
    setSessionId: (sessionId) => set({ sessionId }),
    openSession: (sessionId) => {
      const previous = get().attachment;
      if (previous?.previewUrl) {
        URL.revokeObjectURL(previous.previewUrl);
      }

      set({
        draft: "",
        sessionId,
        attachment: null,
        messages: [],
        historyCursor: null,
        isLoadingHistory: false,
        isLoadingOlder: false,
        error: null,
      });
    },
    setError: (error) => set({ error }),
    startHistoryLoad: () => set({ isLoadingHistory: true }),
    finishHistoryLoad: () => set({ isLoadingHistory: false }),
    startOlderLoad: () => set({ isLoadingOlder: true }),
    finishOlderLoad: () => set({ isLoadingOlder: false }),
    hydrateThread: (messages, nextCursor) =>
      set({
        messages,
        historyCursor: nextCursor,
        isLoadingHistory: false,
        isLoadingOlder: false,
      }),
    prependHistoryPage: (messages, nextCursor) =>
      set((state) => ({
        messages: [...messages, ...state.messages],
        historyCursor: nextCursor,
        isLoadingOlder: false,
      })),
    appendUserMessage: (content, attachmentName, attachmentPreviewUrl) =>
      set((state) => ({
        messages: [
          ...state.messages,
          {
            id: crypto.randomUUID(),
            role: "user",
            content,
            createdAt: new Date().toISOString(),
            attachmentName,
            ...(attachmentPreviewUrl ? { attachmentPreviewUrl } : {}),
          },
        ],
      })),
    appendAssistantCard: (card, uiMeta, attachmentPreviewUrl) =>
      set((state) => ({
        messages: [
          ...state.messages,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            createdAt: new Date().toISOString(),
            card,
            ...(uiMeta ? { uiMeta } : {}),
            ...(attachmentPreviewUrl ? { attachmentPreviewUrl } : {}),
          },
        ],
      })),
    historyWindow: () =>
      get()
        .messages
        .slice(-CONTEXT_WINDOW_SIZE)
        .filter((message) =>
          message.role === "assistant" || message.content.trim().length > 0,
        )
        .map((message) =>
          message.role === "user"
            ? { role: "user", content: trimContextText(message.content) }
            : {
                role: "assistant",
                content: serializeAssistantCardForContext(message.card),
              },
        ),
  }),
);
