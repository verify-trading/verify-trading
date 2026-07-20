"use client";

import { useEffect } from "react";

import { trackMetaViewContent } from "@/lib/marketing/meta-pixel";

/** Fires the Meta Pixel "ViewContent" event on mount. Renders nothing. */
export function TrackViewContent() {
  useEffect(() => {
    trackMetaViewContent();
  }, []);

  return null;
}
