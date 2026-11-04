"use client";

import { useCallback, useMemo, useState } from "react";

/**
 * Turnstile state for an auth form: token, the "not solved yet" gate, and the
 * remount counter used to reset the widget after a failed submit.
 *
 * Lives here rather than in each page because login, signup, and forgot-password
 * all need the identical six-part protocol (read site key, derive `required`,
 * hold token + remount key, gate submit, reset on error, disable the button).
 * Three hand-rolled copies had already started to diverge.
 *
 * The token is only *enforced* once the matching secret key is configured in
 * Supabase Auth > Bot and Abuse Protection — see `.env.example`.
 */
export function useCaptcha() {
  const [token, setToken] = useState<string | null>(null);
  const [widgetKey, setWidgetKey] = useState(0);
  const [failed, setFailed] = useState(false);

  const required = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  const clear = useCallback(() => setToken(null), []);
  const solve = useCallback((value: string) => {
    setToken(value);
    setFailed(false);
  }, []);
  /** Turnstile couldn't load or verify (often a blocker such as Brave Shields). */
  const fail = useCallback(() => {
    setToken(null);
    setFailed(true);
  }, []);

  /** Drop the token and force a fresh challenge — a solved token is single-use. */
  const reset = useCallback(() => {
    setToken(null);
    setFailed(false);
    setWidgetKey((key) => key + 1);
  }, []);

  const widgetProps = useMemo(
    () => ({
      captchaKey: widgetKey,
      failed,
      onSuccess: solve,
      onExpire: clear,
      onError: fail,
      onRetry: reset,
    }),
    [widgetKey, failed, solve, clear, fail, reset],
  );

  return {
    /** Pass to Supabase as `captchaToken`. */
    token: token ?? undefined,
    /** Required but unsolved — block submission. */
    blocked: required && !token,
    /** Still running the (usually invisible) check — show it on the submit button. */
    pending: required && !token && !failed,
    reset,
    widgetProps,
  };
}
