"use client";

import { Turnstile } from "@marsidev/react-turnstile";

type CaptchaWidgetProps = {
  captchaKey: number;
  failed: boolean;
  onSuccess: (token: string) => void;
  onExpire: () => void;
  onError: () => void;
  onRetry: () => void;
};

/**
 * Renders nothing when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is unset, so auth forms can
 * mount it unconditionally. Pair with {@link useCaptcha}, which owns the token state.
 *
 * Invisible unless Cloudflare wants an interaction; then it fills the form width
 * instead of popping in as a fixed 300px box.
 */
export function CaptchaWidget({
  captchaKey,
  failed,
  onSuccess,
  onExpire,
  onError,
  onRetry,
}: CaptchaWidgetProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey) {
    return null;
  }

  return (
    <div className="w-full">
      <Turnstile
        key={captchaKey}
        siteKey={siteKey}
        onSuccess={onSuccess}
        onExpire={onExpire}
        onError={onError}
        options={{ theme: "dark", appearance: "interaction-only", size: "flexible" }}
        className="w-full"
      />
      {failed ? (
        <p className="mt-1.5 text-xs text-red-300" role="alert">
          The security check couldn&apos;t load. If you use an ad or tracker blocker (e.g. Brave
          Shields), allow this site, then{" "}
          <button type="button" onClick={onRetry} className="font-medium text-white underline underline-offset-4">
            try again
          </button>
          .
        </p>
      ) : null}
    </div>
  );
}
