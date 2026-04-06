"use client";

import Image from "next/image";
import { ArrowUp, Image as ImageIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import type { AskAttachment } from "@/components/ask/store";

const ASK_TEXTAREA_MIN_PX = 36;
const ASK_TEXTAREA_MAX_PX = 200;

export function AskComposer({
  draft,
  attachment,
  isSubmitting,
  isDragActive,
  inputProps,
  onDraftChange,
  onSubmit,
  onOpenPicker,
  onClearAttachment,
  onPreviewAttachment,
}: {
  draft: string;
  attachment: AskAttachment | null;
  isSubmitting: boolean;
  isDragActive: boolean;
  inputProps: Record<string, unknown>;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  onOpenPicker: () => void;
  onClearAttachment: () => void;
  onPreviewAttachment: (previewUrl: string, alt: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    const nextHeight = Math.min(
      Math.max(textarea.scrollHeight, ASK_TEXTAREA_MIN_PX),
      ASK_TEXTAREA_MAX_PX,
    );
    textarea.style.height = `${nextHeight}px`;
  }, [draft]);

  const shellClassName = [
    "mx-auto w-full max-w-4xl rounded-2xl border px-3 py-2 transition-all duration-200",
    isDragActive
      ? "border-[rgba(242,109,109,0.35)] bg-[rgba(242,109,109,0.04)]"
      : "border-white/[0.06] bg-white/[0.03] focus-within:border-[rgba(76,110,245,0.25)] focus-within:shadow-[0_0_0_3px_rgba(76,110,245,0.06)]",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={shellClassName}>
      <input {...inputProps} />

      {/* Attachment preview */}
      {attachment ? (
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2">
          <button
            type="button"
            onClick={() =>
              onPreviewAttachment(attachment.previewUrl, attachment.file.name)
            }
            className="block shrink-0 rounded-lg transition hover:opacity-90"
            aria-label="Open attached image preview"
          >
            <Image
              src={attachment.previewUrl}
              alt="Attached image"
              width={40}
              height={40}
              unoptimized
              className="size-10 rounded-lg object-cover ring-1 ring-white/10"
            />
          </button>
          <span className="min-w-0 flex-1 truncate text-xs text-white/50">
            {attachment.file.name}
          </span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onClearAttachment();
            }}
            className="shrink-0 text-xs font-medium text-white/30 transition hover:text-white/60"
            aria-label="Remove attachment"
          >
            ✕
          </button>
        </div>
      ) : null}

      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={onOpenPicker}
          title="Add image"
          aria-label="Add image"
          className="mb-px inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-[var(--vt-muted)] transition hover:bg-white/5 hover:text-white"
        >
          <ImageIcon
            className="size-4 opacity-80"
            strokeWidth={1.8}
            aria-hidden
          />
        </button>

        <div className="min-w-0 flex-1">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (!isSubmitting && (draft.trim() || attachment)) {
                  onSubmit();
                }
              }
            }}
            placeholder="Ask anything trading…"
            rows={1}
            style={{ maxHeight: ASK_TEXTAREA_MAX_PX }}
            className="block min-h-9 w-full resize-none overflow-y-auto border-0 bg-transparent py-1.5 text-sm leading-6 text-white outline-none placeholder:text-white/25"
          />
        </div>

        <button
          type="button"
          disabled={isSubmitting || (!draft.trim() && !attachment)}
          onClick={onSubmit}
          className="mb-px inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--vt-blue)] text-white transition hover:opacity-90 hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:translate-y-0"
          aria-label={isSubmitting ? "Sending" : "Send message"}
        >
          {isSubmitting ? (
            <span className="text-sm font-black leading-none">…</span>
          ) : (
            <ArrowUp className="size-4" strokeWidth={2.5} aria-hidden />
          )}
        </button>
      </div>
    </div>
  );
}
