"use client";

import type { AnalyticsEventName, AnalyticsParams } from "@/lib/analytics/events";
import { getUtmEventParams } from "@/lib/analytics/utm";

declare global {
  interface Window {
    gtag?: (
      command: "event",
      eventName: string,
      params?: Record<string, unknown>,
    ) => void;
  }
}

export function trackAnalyticsEvent(
  eventName: AnalyticsEventName,
  params: AnalyticsParams = {},
) {
  if (typeof window === "undefined") {
    return;
  }

  const eventParams = {
    ...getUtmEventParams(),
    ...params,
  };

  if (new URLSearchParams(window.location.search).get("analytics_debug") === "1") {
    const debugPayload = {
      eventName,
      params: eventParams,
    };
    console.info("[analytics]", JSON.stringify(debugPayload));
    window.dispatchEvent(new CustomEvent("vt:analytics-debug", { detail: debugPayload }));
  }

  if (typeof window.gtag !== "function") {
    return;
  }

  window.gtag("event", eventName, eventParams);
}
