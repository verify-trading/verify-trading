"use client";

import { Turnstile } from "@marsidev/react-turnstile";

type CaptchaWidgetProps = {
  captchaKey: number;
  onSuccess: (token: string) => void;
  onExpire: () => void;
  onError: () => void;
};

/**
 * Renders nothing when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is unset, so auth forms can
 * mount it unconditionally. Pair with {@link useCaptcha}, which owns the token state.
 */
export function CaptchaWidget({
  captchaKey,
  onSuccess,
  onExpire,
  onError,
}: CaptchaWidgetProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey) {
    return null;
  }

  return (
    <Turnstile
      key={captchaKey}
      siteKey={siteKey}
      onSuccess={onSuccess}
      onExpire={onExpire}
      onError={onError}
      options={{ theme: "dark", appearance: "interaction-only" }}
    />
  );
}
