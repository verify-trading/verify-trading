"use client";

import { useEffect, useMemo, useState } from "react";
import { useViewportTruth } from "viewport-truth/react";

const EDITABLE = /^(input|textarea|select)$/i;

const isEditable = (el: Element | null): boolean =>
  !!el && (EDITABLE.test(el.tagName) || (el as HTMLElement).isContentEditable);

/**
 * Pixels obscured at the bottom of the layout viewport (typically the software keyboard).
 * Delegates to viewport-truth for stable VisualViewport + layout metrics on iOS Safari, Android, etc.
 * When `enabled` is false, always returns 0.
 *
 * Gated on an editable element actually being focused. iOS 26 has a live bug where
 * `visualViewport.offsetTop` (and sometimes `height`) do not return to their resting values
 * after the keyboard is dismissed, so the geometry alone keeps reporting an inset that is no
 * longer there — which would strand a lifted element above a keyboard that has already gone.
 * Focus is the reliable signal: no focused field, no keyboard, no inset. CSS-only and
 * geometry-only approaches cannot work around an active browser bug.
 */
export function useVisualViewportKeyboardInset(enabled: boolean): number {
  const snapshot = useViewportTruth();
  const [editableFocused, setEditableFocused] = useState(false);

  useEffect(() => {
    if (!enabled || typeof document === "undefined") {
      return;
    }
    // On focusout `document.activeElement` has already fallen back to <body>, so read
    // `relatedTarget` (the element about to receive focus) instead — otherwise moving
    // between two fields would drop the lift for a frame and visibly jolt the composer.
    const sync = (event?: FocusEvent) =>
      setEditableFocused(
        isEditable(
          event?.type === "focusout"
            ? (event.relatedTarget as Element | null)
            : document.activeElement,
        ),
      );
    sync();
    // focusout fires as the keyboard starts animating away, which is what we want:
    // drop the lift immediately rather than waiting on metrics that may never settle.
    document.addEventListener("focusin", sync as EventListener);
    document.addEventListener("focusout", sync as EventListener);
    return () => {
      document.removeEventListener("focusin", sync as EventListener);
      document.removeEventListener("focusout", sync as EventListener);
    };
  }, [enabled]);

  return useMemo(() => {
    if (!enabled || !editableFocused || typeof document === "undefined" || !snapshot || !snapshot.hasVisualViewport) {
      return 0;
    }

    const { layoutHeight, height, offsetTop } = snapshot;

    // Prefer the larger layout baseline: some WebKit builds shrink `window.innerHeight` with the
    // keyboard while `documentElement.clientHeight` still tracks the layout viewport.
    const clientH = document.documentElement.clientHeight;
    const layoutBaseline = Math.max(layoutHeight, clientH);

    return Math.max(0, layoutBaseline - height - offsetTop);
  }, [enabled, editableFocused, snapshot]);
}
