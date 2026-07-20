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

  const required = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  const clear = useCallback(() => setToken(null), []);

  /** Drop the token and force a fresh challenge — a solved token is single-use. */
  const reset = useCallback(() => {
    setToken(null);
    setWidgetKey((key) => key + 1);
  }, []);

  const widgetProps = useMemo(
    () => ({
      captchaKey: widgetKey,
      onSuccess: setToken,
      onExpire: clear,
      onError: clear,
    }),
    [widgetKey, clear],
  );

  return {
    /** Pass to Supabase as `captchaToken`. */
    token: token ?? undefined,
    /** Required but unsolved — block submission. */
    blocked: required && !token,
    reset,
    widgetProps,
  };
}
