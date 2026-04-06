"use client";

import { useEffect, useState } from "react";

/**
 * Pixels obscured at the bottom of the layout viewport (typically the software keyboard).
 * When `enabled` is false, always returns 0.
 */
export function useVisualViewportKeyboardInset(enabled: boolean): number {
  const [insetPx, setInsetPx] = useState(0);

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !window.visualViewport) {
      setInsetPx(0);
      return;
    }

    const vv = window.visualViewport;

    const update = () => {
      const obscured = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setInsetPx(obscured);
    };

    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();

    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [enabled]);

  return enabled ? insetPx : 0;
}
