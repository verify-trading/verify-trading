"use client";

import Image from "next/image";
import { ArrowUp, Image as ImageIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import type { AskAttachment } from "@/components/ask/store";

const ASK_TEXTAREA_MIN_PX = 40;
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
    "mx-auto w-full max-w-4xl rounded-2xl border px-2 py-1.5 shadow-[0_8px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-all duration-200 sm:rounded-3xl sm:px-3 sm:py-2.5",
    isDragActive
      ? "border-[rgba(242,109,109,0.45)] bg-[rgba(242,109,109,0.08)]"
      : "border-white/10 bg-[rgba(17,22,72,0.88)] focus-within:border-[rgba(76,110,245,0.35)] focus-within:shadow-[0_0_0_3px_rgba(76,110,245,0.12)]",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={shellClassName}>
      <input {...inputProps} />

      {attachment ? (
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-white/[0.06] px-2.5 py-2 sm:px-3">
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
          <span className="min-w-0 flex-1 truncate text-xs text-white/55">
            {attachment.file.name}
          </span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onClearAttachment();
            }}
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-white/35 transition hover:bg-white/10 hover:text-white/70"
            aria-label="Remove attachment"
          >
            Remove
          </button>
        </div>
      ) : null}

      <div className="flex items-end gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={onOpenPicker}
          title="Add image"
          aria-label="Add image"
          className="mb-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-full text-[var(--vt-muted)] transition hover:bg-white/10 hover:text-white sm:size-9"
        >
          <ImageIcon className="size-[18px] opacity-90" strokeWidth={1.75} aria-hidden />
        </button>

        <div className="min-w-0 flex-1 py-0.5">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onFocus={() => {
              requestAnimationFrame(() => {
                window.scrollTo(0, 0);
                requestAnimationFrame(() => window.scrollTo(0, 0));
              });
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (!isSubmitting && (draft.trim() || attachment)) {
                  onSubmit();
                }
              }
            }}
            placeholder="Message…"
            rows={1}
            style={{ maxHeight: ASK_TEXTAREA_MAX_PX }}
            className="block min-h-[40px] w-full resize-none overflow-y-auto border-0 bg-transparent px-1 py-1.5 text-[15px] leading-[1.45] text-white outline-none placeholder:text-white/40 sm:text-sm sm:leading-6"
          />
        </div>

        <button
          type="button"
          disabled={isSubmitting || (!draft.trim() && !attachment)}
          onClick={onSubmit}
          className="mb-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--vt-blue)] text-white shadow-[0_4px_16px_rgba(76,110,245,0.35)] transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:shadow-none sm:size-9"
          aria-label={isSubmitting ? "Sending" : "Send message"}
        >
          {isSubmitting ? (
            <span className="text-base font-bold leading-none">…</span>
          ) : (
            <ArrowUp className="size-[18px]" strokeWidth={2.5} aria-hidden />
          )}
        </button>
      </div>
    </div>
  );
}
