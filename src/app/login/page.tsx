"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { AuthDivider } from "@/components/auth/auth-divider";
import {
  authFieldClassWithError,
  authLabelClass,
  authPrimaryButtonClass,
  authSecondaryLinkClass,
} from "@/components/auth/auth-field-styles";
import { AuthFieldError } from "@/components/auth/auth-field-error";
import { AuthShell } from "@/components/auth/auth-shell";
import { GoogleOAuthButton } from "@/components/auth/google-oauth-button";
import { beginOAuthFlow } from "@/lib/auth/oauth-flow";
import { appendSafeNextParam, getSafeRedirectPath } from "@/lib/auth/safe-redirect";
import { loginSchema, type LoginFormValues } from "@/lib/auth/schemas";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";

function LoginPageContent() {
  const router = useRouter();
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

  const [googleBusy, setGoogleBusy] = useState(false);

  const defaultError = useMemo(() => {
    if (!paramError) {
      return null;
    }
    if (paramError === "oauth_login_no_account") {
      return "No account for this Google sign-in. Create an account first.";
    }
    try {
      return decodeURIComponent(paramError);
    } catch {
      return paramError;
    }
  }, [paramError]);

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
      setError("root", { message: "Authentication is not configured. Check environment variables." });
      return;
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: values.email.trim(),
      password: values.password,
    });

    if (signInError) {
      setError("root", { message: signInError.message });
      return;
    }

    router.push(next);
    router.refresh();
  }

  async function signInWithGoogle() {
    clearErrors("root");
    setGoogleBusy(true);

    try {
      if (!supabase) {
        setError("root", { message: "Authentication is not configured. Check environment variables." });
        setGoogleBusy(false);
        return;
      }
      beginOAuthFlow("login_only");
      const origin = window.location.origin;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}&oauth=login_only`,
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
  const showOAuthNoAccountBanner = paramError === "oauth_login_no_account" && !errors.root;

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to save sessions, sync across devices, and track your daily chat usage."
    >
      <div aria-live="polite">
        {rootMessage ? (
          showOAuthNoAccountBanner ? (
            <div className="rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm leading-relaxed text-red-100">
              No account for this Google sign-in.{" "}
              <Link
                href={signupHref}
                className="font-semibold text-red-50 underline decoration-red-300/60 underline-offset-2 transition hover:text-white hover:decoration-white/80"
              >
                Create an account
              </Link>{" "}
              to continue.
            </div>
          ) : (
            <div className="rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {rootMessage}
            </div>
          )
        ) : null}
      </div>

      <div className="space-y-4">
        <GoogleOAuthButton
          onClick={signInWithGoogle}
          disabled={isSubmitting}
          loading={googleBusy}
          variant="continue"
        />
        <AuthDivider label="or with email" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
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
        <button type="submit" disabled={googleBusy || isSubmitting} className={authPrimaryButtonClass}>
          {isSubmitting ? "Signing in…" : "Sign in with email"}
        </button>
      </form>

      <p className="text-center text-sm text-(--vt-muted)">
        No account?{" "}
        <Link href={signupHref} className={authSecondaryLinkClass}>
          Create one
        </Link>
      </p>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Welcome back" subtitle="Loading…">
          <div className="h-40 animate-pulse rounded-xl bg-white/6" />
        </AuthShell>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
