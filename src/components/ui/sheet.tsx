"use client";

import type { ReactNode } from "react";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

type SheetSide = "right" | "bottom";

/**
 * Slide-over sheet (right drawer or bottom panel). Renders in a portal with scroll lock.
 * Use for navigation, filters, or secondary flows on small screens.
 */
export function Sheet({
  open,
  onOpenChange,
  side = "right",
  title,
  children,
  zIndexClass = "z-[100]",
  id,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side?: SheetSide;
  title?: string;
  children: ReactNode;
  /** Above sticky nav (z-50) and most modals; raise if needed. */
  zIndexClass?: string;
  /** Optional id on the dialog panel (e.g. for `aria-controls` on the open button). */
  id?: string;
}) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);

  // Client-only: portal targets document.body; skip SSR to avoid hydration mismatch.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount gate so createPortal only runs on client
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  if (!mounted || !open) {
    return null;
  }

  const panelRight =
    "right-0 top-0 h-[100dvh] w-full max-w-[min(100%,20rem)] border-l border-white/10";

  const panelBottom =
    "bottom-0 left-0 right-0 max-h-[min(92dvh,560px)] w-full rounded-t-2xl border border-white/10";

  const panelBase =
    "flex flex-col bg-[var(--vt-navy)] shadow-[0_-8px_48px_rgba(0,0,0,0.45)] motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out";

  const panelPosition =
    side === "right"
      ? `fixed ${panelRight} ${panelBase} flex min-h-0 flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]`
      : `fixed ${panelBottom} ${panelBase} flex min-h-0 flex-col pb-[max(1rem,env(safe-area-inset-bottom))] pt-3`;

  const overlay = (
    <div
      className={`fixed inset-0 ${zIndexClass} flex ${side === "right" ? "justify-end" : "items-end justify-center"}`}
      role="presentation"
    >
      <Button
        type="button"
        variant="ghost"
        aria-label="Close panel"
        className="absolute inset-0 h-full w-full rounded-none border-0 bg-[rgba(5,8,27,0.72)] p-0 backdrop-blur-[2px] hover:bg-[rgba(5,8,27,0.78)] motion-safe:transition-opacity"
        onClick={() => onOpenChange(false)}
      />
      <div
        id={id}
        className={`relative ${panelPosition}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] px-4 pb-3">
          {title ? (
            <h2 id={titleId} className="text-lg font-semibold tracking-tight text-white">
              {title}
            </h2>
          ) : (
            <span id={titleId} className="sr-only">
              Panel
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-auto inline-flex size-10 shrink-0 rounded-xl text-white/70 hover:bg-white/10 hover:text-white"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            <X className="size-5" strokeWidth={2} aria-hidden />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2">{children}</div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
