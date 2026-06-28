"use client";

import { useEffect, useState } from "react";

import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { trackAnalyticsEvent } from "@/lib/analytics/client";
import { captureUtmAttribution } from "@/lib/analytics/utm";

const FIRST_VISIT_KEY = "vt_first_visit_at";
const RETURN_VISIT_SENT_KEY = "vt_return_visit_sent";
const RETURN_VISIT_SESSION_KEY = "vt_return_visit_session";
const RETURN_VISIT_MIN_AGE_MS = 30 * 60 * 1000;
const SIGNUP_COMPLETED_KEY = "vt_sign_up_completed";
const ANALYTICS_DEBUG_KEY = "vt_analytics_debug";
const ANALYTICS_DEBUG_EVENTS_KEY = "vt_analytics_debug_events";

type AnalyticsDebugEvent = {
  eventName: string;
  params: Record<string, unknown>;
};

function trackSignupFromUrl() {
  const url = new URL(window.location.href);
  if (url.searchParams.get("signup") !== "completed") {
    return;
  }

  const debugMode = url.searchParams.get("analytics_debug") === "1";
  if (debugMode || window.localStorage.getItem(SIGNUP_COMPLETED_KEY) !== "true") {
    trackAnalyticsEvent(ANALYTICS_EVENTS.signUpCompleted, {
      method: url.searchParams.get("signup_method") ?? "unknown",
      source: "auth_callback",
    });
    window.localStorage.setItem(SIGNUP_COMPLETED_KEY, "true");
  }

  url.searchParams.delete("signup");
  url.searchParams.delete("signup_method");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

export function AnalyticsAttribution() {
  const [debugEvents, setDebugEvents] = useState<AnalyticsDebugEvent[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("analytics_debug") === "1") {
      window.sessionStorage.setItem(ANALYTICS_DEBUG_KEY, "1");
      window.sessionStorage.setItem(ANALYTICS_DEBUG_EVENTS_KEY, "[]");
    }

    if (window.sessionStorage.getItem(ANALYTICS_DEBUG_KEY) === "1") {
      window.setTimeout(() => {
        try {
          setDebugEvents(JSON.parse(window.sessionStorage.getItem(ANALYTICS_DEBUG_EVENTS_KEY) ?? "[]"));
        } catch {
          setDebugEvents([]);
        }
      }, 0);
    }

    captureUtmAttribution();
    window.setTimeout(trackSignupFromUrl, 0);

    const now = Date.now();
    const firstVisitAt = Number(window.localStorage.getItem(FIRST_VISIT_KEY));
    if (!firstVisitAt) {
      window.localStorage.setItem(FIRST_VISIT_KEY, String(now));
      return;
    }

    const alreadySent = window.localStorage.getItem(RETURN_VISIT_SENT_KEY) === "true";
    const sentThisSession = window.sessionStorage.getItem(RETURN_VISIT_SESSION_KEY) === "true";
    if (!alreadySent && !sentThisSession && now - firstVisitAt >= RETURN_VISIT_MIN_AGE_MS) {
      trackAnalyticsEvent(ANALYTICS_EVENTS.returnVisit, {
        visit_age_minutes: Math.floor((now - firstVisitAt) / 60000),
      });
      window.localStorage.setItem(RETURN_VISIT_SENT_KEY, "true");
      window.sessionStorage.setItem(RETURN_VISIT_SESSION_KEY, "true");
    }
  }, []);

  useEffect(() => {
    function handleAnalyticsDebug(event: Event) {
      if (window.sessionStorage.getItem(ANALYTICS_DEBUG_KEY) !== "1") {
        return;
      }

      const detail = (event as CustomEvent<AnalyticsDebugEvent>).detail;
      const nextEvents = [...debugEvents, detail].slice(-30);
      setDebugEvents(nextEvents);
      window.sessionStorage.setItem(ANALYTICS_DEBUG_EVENTS_KEY, JSON.stringify(nextEvents));
    }

    window.addEventListener("vt:analytics-debug", handleAnalyticsDebug);
    return () => window.removeEventListener("vt:analytics-debug", handleAnalyticsDebug);
  }, [debugEvents]);

  if (debugEvents.length === 0) {
    return null;
  }

  return (
    <pre data-testid="analytics-debug-events" hidden>
      {JSON.stringify(debugEvents)}
    </pre>
  );
}
