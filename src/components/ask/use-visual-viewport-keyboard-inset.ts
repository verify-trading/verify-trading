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

/**
 * Locks the root container to the initial layout viewport height so iOS Safari
 * cannot shrink it when the keyboard opens. Returns a style object to apply.
 */
export function useLockedViewportHeight(enabled: boolean) {
  const [style, setStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      setStyle({});
      return;
    }

    const initialHeight = window.innerHeight;

    if (!window.visualViewport) {
      setStyle({});
      return;
    }

    const vv = window.visualViewport;

    const update = () => {
      const keyboardHeight = Math.max(0, initialHeight - vv.height);
      setStyle({
        height: `${initialHeight}px`,
        maxHeight: `${initialHeight}px`,
        paddingBottom: `${keyboardHeight}px`,
      });
    };

    update();
    vv.addEventListener("resize", update);

    return () => {
      vv.removeEventListener("resize", update);
    };
  }, [enabled]);

  return style;
}
