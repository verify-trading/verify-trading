"use client";

import type { ReactNode } from "react";
import { useEffect, useId } from "react";

const sizeClass = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
} as const;

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  zIndexClass = "z-[60]",
  closeOnBackdrop = true,
  closeOnEscape = true,
  /** When true, Escape and backdrop clicks are ignored (e.g. during submit). */
  preventClose = false,
  "aria-label": ariaLabel,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof sizeClass;
  zIndexClass?: string;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  preventClose?: boolean;
  "aria-label"?: string;
}) {
  const titleId = useId();
  const bodyId = useId();
  const labelledBy = title ? titleId : undefined;
  const describedBy = children ? bodyId : undefined;

  useEffect(() => {
    if (!open || !closeOnEscape || preventClose) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, closeOnEscape, preventClose, onClose]);

  if (!open) {
    return null;
  }

  const canDismiss = !preventClose && closeOnBackdrop;

  return (
    <div
      className={`fixed inset-0 ${zIndexClass} flex items-center justify-center bg-[rgba(5,8,27,0.88)] px-4 py-6 backdrop-blur-sm`}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onClick={canDismiss ? onClose : undefined}
    >
      <div
        className={[
          "w-full rounded-2xl border border-white/[0.08] bg-[var(--vt-card)] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.45)]",
          sizeClass[size],
        ].join(" ")}
        onClick={(event) => event.stopPropagation()}
      >
        {title ? (
          <h2 id={titleId} className="text-lg font-semibold tracking-tight text-white">
            {title}
          </h2>
        ) : null}
        <div id={bodyId} className={title ? "mt-2" : ""}>
          {children}
        </div>
        {footer ? <div className="mt-6">{footer}</div> : null}
      </div>
    </div>
  );
}
