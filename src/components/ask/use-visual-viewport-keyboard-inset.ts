"use client";

import { useMemo } from "react";
import { useViewportTruth } from "viewport-truth/react";

/**
 * Pixels obscured at the bottom of the layout viewport (typically the software keyboard).
 * Delegates to viewport-truth for stable VisualViewport + layout metrics on iOS Safari, Android, etc.
 * When `enabled` is false, always returns 0.
 */
export function useVisualViewportKeyboardInset(enabled: boolean): number {
  const snapshot = useViewportTruth();

  return useMemo(() => {
    if (!enabled || typeof document === "undefined" || !snapshot || !snapshot.hasVisualViewport) {
      return 0;
    }

    const { layoutHeight, height, offsetTop } = snapshot;

    // Prefer the larger layout baseline: some WebKit builds shrink `window.innerHeight` with the
    // keyboard while `documentElement.clientHeight` still tracks the layout viewport.
    const clientH = document.documentElement.clientHeight;
    const layoutBaseline = Math.max(layoutHeight, clientH);

    return Math.max(0, layoutBaseline - height - offsetTop);
  }, [enabled, snapshot]);
}
