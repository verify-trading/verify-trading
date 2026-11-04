// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCaptcha } from "@/components/auth/use-captcha";

describe("useCaptcha", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site-key"));
  afterEach(() => vi.unstubAllEnvs());

  it("is pending until solved, surfaces failures, and retry clears them", () => {
    const { result } = renderHook(() => useCaptcha());
    expect(result.current).toMatchObject({ blocked: true, pending: true });

    act(() => result.current.widgetProps.onError());
    expect(result.current).toMatchObject({ blocked: true, pending: false });
    expect(result.current.widgetProps.failed).toBe(true);

    act(() => result.current.widgetProps.onRetry());
    expect(result.current.widgetProps).toMatchObject({ failed: false, captchaKey: 1 });

    act(() => result.current.widgetProps.onSuccess("tok"));
    expect(result.current).toMatchObject({ blocked: false, pending: false, token: "tok" });
  });

  it("never blocks when no site key is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");
    const { result } = renderHook(() => useCaptcha());
    expect(result.current).toMatchObject({ blocked: false, pending: false });
  });
});
