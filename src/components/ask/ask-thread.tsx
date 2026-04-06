"use client";

import Image from "next/image";
import { Bot } from "lucide-react";

import { AskResponseCard } from "@/components/ask/cards";
import {
  AskAssistantLoadingSkeleton,
  AskThreadLoadOlderSkeleton,
  AskThreadRestoringSkeleton,
} from "@/components/ask/ask-skeletons";
import type { AskMessage } from "@/components/ask/store";
import { getAppName } from "@/lib/site-config";

function ChatAttachmentPreview({
  src,
  alt,
  onOpen,
  onLoad,
  compact = false,
}: {
  src: string;
  alt: string;
  onOpen: () => void;
  onLoad?: () => void;
  compact?: boolean;
}) {
  /** 16:9 frame: height always follows width (same proportions at every breakpoint; no h-sm/md jumps). */
  const maxW = compact ? "max-w-3xl" : "max-w-4xl";

  return (
    <button
      type="button"
      onClick={onOpen}
      className={[
        "mb-3 block w-full overflow-hidden rounded-2xl border border-white/6 bg-black/15 text-left transition hover:opacity-95",
        maxW,
      ].join(" ")}
      aria-label={`Open ${alt}`}
    >
      <span className="relative block w-full aspect-[16/9]">
        <Image
          src={src}
          alt={alt}
          fill
          unoptimized
          sizes={compact ? "(max-width: 768px) 100vw, 42rem" : "(max-width: 768px) 100vw, 48rem"}
          className="object-contain object-center"
          onLoadingComplete={() => onLoad?.()}
        />
      </span>
    </button>
  );
}

function AssistantAvatar() {
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--vt-blue)] to-[#6B21A8] shadow-[0_4px_16px_rgba(76,110,245,0.3)]">
      <Bot className="size-4 text-white" strokeWidth={2} aria-hidden />
    </div>
  );
}

function UserAvatar() {
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--vt-coral)] to-[#BE185D] shadow-[0_4px_16px_rgba(242,109,109,0.25)]">
      <span className="text-xs font-bold text-white" aria-hidden>
        U
      </span>
    </div>
  );
}

function TimestampLabel({ createdAt }: { createdAt: string }) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;

  const label = new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  return (
    <span className="select-none text-[10px] tabular-nums text-white/20">
      {label}
    </span>
  );
}

function UserBubble({
  message,
  onOpenImage,
  onAttachmentLoad,
}: {
  message: Extract<AskMessage, { role: "user" }>;
  onOpenImage: (src: string, alt: string) => void;
  onAttachmentLoad: () => void;
}) {
  const hasContent = message.content.trim().length > 0;
  const attachmentPreviewUrl = message.attachmentPreviewUrl;

  return (
    <div className="mx-1 flex items-start gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-white/[0.015] sm:px-6">
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-end gap-2">
          <TimestampLabel createdAt={message.createdAt} />
          <span className="text-[11px] font-semibold text-white/40">You</span>
        </div>
        <div className="mt-1.5 flex justify-end">
          <div
            className={[
              "max-w-lg rounded-[18px_18px_4px_18px] bg-[var(--vt-coral)] text-sm leading-relaxed text-white shadow-[0_8px_28px_rgba(242,109,109,0.18)]",
              hasContent ? "px-4 py-2.5" : "px-3 py-3",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {attachmentPreviewUrl ? (
              <ChatAttachmentPreview
                src={attachmentPreviewUrl}
                alt={message.attachmentName ?? "Uploaded image"}
                onLoad={onAttachmentLoad}
                onOpen={() =>
                  onOpenImage(
                    attachmentPreviewUrl,
                    message.attachmentName ?? "Uploaded image",
                  )
                }
              />
            ) : null}
            {hasContent ? <div>{message.content}</div> : null}
            {message.attachmentName ? (
              <div className="mt-1.5 text-[11px] font-medium text-white/70">
                📎 {message.attachmentName}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <UserAvatar />
    </div>
  );
}

function AssistantBubble({
  message,
  onOpenImage,
  onAttachmentLoad,
}: {
  message: Extract<AskMessage, { role: "assistant" }>;
  onOpenImage: (src: string, alt: string) => void;
  onAttachmentLoad: () => void;
}) {
  return (
    <div className="mx-1 flex items-start gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-white/[0.015] sm:px-6">
      <AssistantAvatar />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-white/40">
            {getAppName()}
          </span>
          <TimestampLabel createdAt={message.createdAt} />
        </div>
        <div className="mt-1.5">
          {message.attachmentPreviewUrl ? (
            <ChatAttachmentPreview
              src={message.attachmentPreviewUrl}
              alt="Uploaded image context"
              onLoad={onAttachmentLoad}
              compact
              onOpen={() =>
                onOpenImage(
                  message.attachmentPreviewUrl!,
                  "Uploaded image context",
                )
              }
            />
          ) : null}
          <AskResponseCard card={message.card} uiMeta={message.uiMeta} />
        </div>
      </div>
    </div>
  );
}

export function AskThread({
  messages,
  historyCursor,
  isLoadingHistory,
  isLoadingOlder,
  isSubmitting,
  onLoadOlder,
  onOpenImage,
  onAttachmentLoad,
  viewportRef,
  bottomRef,
}: {
  messages: AskMessage[];
  historyCursor: string | null;
  isLoadingHistory: boolean;
  isLoadingOlder: boolean;
  isSubmitting: boolean;
  onLoadOlder: () => void;
  onOpenImage: (src: string, alt: string) => void;
  onAttachmentLoad: () => void;
  viewportRef: React.RefObject<HTMLDivElement | null>;
  bottomRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={viewportRef}
      data-testid="ask-thread-viewport"
      className="ask-scrollbar min-h-0 flex-1 overflow-y-auto"
      role="log"
      aria-live="polite"
    >
      <div className="mx-auto flex w-full max-w-4xl flex-col">
        {/* Load older */}
        <div className="py-3 text-center">
          {isLoadingOlder ? (
            <AskThreadLoadOlderSkeleton />
          ) : historyCursor ? (
            <button
              type="button"
              onClick={onLoadOlder}
              className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/25 transition hover:text-white"
            >
              ↑ Load older messages
            </button>
          ) : null}
        </div>

        {/* Messages */}
        {messages.map((message) => (
          <div key={message.id}>
            {message.role === "user" ? (
              <UserBubble
                message={message}
                onOpenImage={onOpenImage}
                onAttachmentLoad={onAttachmentLoad}
              />
            ) : (
              <AssistantBubble
                message={message}
                onOpenImage={onOpenImage}
                onAttachmentLoad={onAttachmentLoad}
              />
            )}
          </div>
        ))}

        {/* Submitting */}
        {isSubmitting ? <AskAssistantLoadingSkeleton /> : null}

        {isLoadingHistory ? <AskThreadRestoringSkeleton /> : null}

        <div ref={bottomRef} className="h-1" />
      </div>
    </div>
  );
}
