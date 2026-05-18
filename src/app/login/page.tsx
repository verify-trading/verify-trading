"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { AuthDivider } from "@/components/auth/auth-divider";
import {
  authFieldClassWithError,
  authInlineErrorBannerClass,
  authInlineSuccessBannerClass,
  authLabelClass,
  authSecondaryLinkClass,
} from "@/components/auth/auth-field-styles";
import { Button } from "@/components/ui/button";
import { AuthFieldError } from "@/components/auth/auth-field-error";
import { AuthShell, AuthShellSpinner } from "@/components/auth/auth-shell";
import { CaptchaWidget } from "@/components/auth/captcha-widget";
import { GoogleOAuthButton } from "@/components/auth/google-oauth-button";
import { beginOAuthFlow, setAuthRedirectCookie } from "@/lib/auth/oauth-flow";
import { appendSafeNextParam, getSafeRedirectPath } from "@/lib/auth/safe-redirect";
import { AUTH_NOT_CONFIGURED_MESSAGE } from "@/lib/auth/messages";
import { loginSchema, type LoginFormValues } from "@/lib/auth/schemas";
import { LEGAL_LINKS } from "@/lib/legal/legal-links";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

function LoginPageContent() {
  const { supabase } = useSupabaseAuth();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");
  const next = useMemo(() => getSafeRedirectPath(nextParam, "/ask"), [nextParam]);
  const forgotPasswordHref = useMemo(
    () => appendSafeNextParam("/forgot-password", nextParam),
    [nextParam],
  );
  const signupHref = useMemo(() => appendSafeNextParam("/signup", nextParam), [nextParam]);
  const paramError = searchParams.get("error");
  const resetParam = searchParams.get("reset");

  const [googleBusy, setGoogleBusy] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const captchaRequired = Boolean(TURNSTILE_SITE_KEY);

  const defaultError = useMemo(() => {
    if (!paramError) {
      return null;
    }
    try {
      return decodeURIComponent(paramError);
    } catch {
      return paramError;
    }
  }, [paramError]);
  const resetSuccessMessage = resetParam === "success" ? "Password updated. Sign in with your new password." : null;

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginFormValues) {
    clearErrors("root");

    if (!supabase) {
      setError("root", { message: AUTH_NOT_CONFIGURED_MESSAGE });
      return;
    }

    if (captchaRequired && !captchaToken) {
      setError("root", { message: "Please complete the security check before signing in." });
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: values.email.trim(),
      password: values.password,
      options: {
        captchaToken: captchaToken ?? undefined,
      },
    });

    if (signInError) {
      setError("root", { message: signInError.message });
      setCaptchaToken(null);
      setCaptchaKey((key) => key + 1);
      return;
    }

    toast.success("Signed in.");
    // Full navigation so Supabase session cookies are sent before /ask (avoids client nav race with middleware).
    window.location.assign(next);
  }

  async function signInWithGoogle() {
    clearErrors("root");
    setGoogleBusy(true);

    try {
      if (!supabase) {
        setError("root", { message: AUTH_NOT_CONFIGURED_MESSAGE });
        setGoogleBusy(false);
        return;
      }
      beginOAuthFlow("signup");
      setAuthRedirectCookie(next);
      const origin = window.location.origin;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}&oauth=signup`,
        },
      });

      if (oauthError) {
        setError("root", { message: oauthError.message });
        setGoogleBusy(false);
      }
    } catch {
      setError("root", { message: "Could not start Google sign-in. Please try again." });
      setGoogleBusy(false);
    }
  }

  const rootMessage = errors.root?.message || defaultError;
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to save sessions, sync across devices, and track your daily chat usage."
    >
      <div aria-live="polite">
        {resetSuccessMessage ? (
          <div className={cn("mb-4", authInlineSuccessBannerClass)}>{resetSuccessMessage}</div>
        ) : null}
        {rootMessage ? (
          <div className={authInlineErrorBannerClass}>{rootMessage}</div>
        ) : null}
      </div>

      <div className="space-y-3.5">
        <GoogleOAuthButton
          onClick={signInWithGoogle}
          disabled={isSubmitting}
          loading={googleBusy}
          label="Create or sign in with Google"
        />
        <AuthDivider label="or with email" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5" noValidate>
        <div>
          <label htmlFor="login-email" className={authLabelClass}>
            Email
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            aria-invalid={Boolean(errors.email)}
            className={authFieldClassWithError(Boolean(errors.email))}
            placeholder="you@example.com"
            {...register("email")}
          />
          <AuthFieldError message={errors.email?.message} />
        </div>
        <div>
          <label htmlFor="login-password" className={authLabelClass}>
            Password
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            aria-invalid={Boolean(errors.password)}
            className={authFieldClassWithError(Boolean(errors.password))}
            placeholder="Enter your password"
            {...register("password")}
          />
          <AuthFieldError message={errors.password?.message} />
          <div className="mt-2 flex justify-end">
            <Link href={forgotPasswordHref} className={`${authSecondaryLinkClass} text-sm`}>
              Forgot password?
            </Link>
          </div>
        </div>
        <CaptchaWidget
          siteKey={TURNSTILE_SITE_KEY ?? ""}
          captchaKey={captchaKey}
          onSuccess={setCaptchaToken}
          onExpire={() => setCaptchaToken(null)}
          onError={() => setCaptchaToken(null)}
        />
        <Button
          type="submit"
          variant="default"
          size="pill"
          className="w-full"
          disabled={googleBusy || isSubmitting || (captchaRequired && !captchaToken)}
        >
          {isSubmitting ? "Signing in…" : "Sign in with email"}
        </Button>
      </form>

      <p className="text-center text-sm text-(--vt-muted)">
        No account?{" "}
        <Link href={signupHref} className={authSecondaryLinkClass}>
          Create one
        </Link>
      </p>

      <nav
        className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-1 border-t border-white/[0.06] pt-5"
        aria-label="Legal"
      >
        {LEGAL_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-[11px] font-semibold text-white/35 transition hover:text-white/70"
          >
            {link.shortLabel}
          </Link>
        ))}
      </nav>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Welcome back" subtitle="Loading…">
          <AuthShellSpinner />
        </AuthShell>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
