"use client";

import { Turnstile } from "@marsidev/react-turnstile";

type CaptchaWidgetProps = {
  siteKey: string;
  captchaKey: number;
  onSuccess: (token: string) => void;
  onExpire: () => void;
  onError: () => void;
};

export function CaptchaWidget({
  siteKey,
  captchaKey,
  onSuccess,
  onExpire,
  onError,
}: CaptchaWidgetProps) {
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
