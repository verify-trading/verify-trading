"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, MailOpen } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { AuthDivider } from "@/components/auth/auth-divider";
import {
  authFieldClassWithError,
  authInlineErrorBannerClass,
  authLabelClass,
  authSecondaryLinkClass,
} from "@/components/auth/auth-field-styles";
import { Button } from "@/components/ui/button";
import { AuthFieldError } from "@/components/auth/auth-field-error";
import { AuthShell, AuthShellSpinner } from "@/components/auth/auth-shell";
import { GoogleOAuthButton } from "@/components/auth/google-oauth-button";
import { beginOAuthFlow, setAuthRedirectCookie } from "@/lib/auth/oauth-flow";
import { appendSafeNextParam, getSafeRedirectPath } from "@/lib/auth/safe-redirect";
import { AUTH_NOT_CONFIGURED_MESSAGE } from "@/lib/auth/messages";
import { signupSchema, type SignupFormValues } from "@/lib/auth/schemas";
import { LEGAL_LINKS } from "@/lib/legal/legal-links";
import { FREE_DAILY_ASK_LIMIT } from "@/lib/rate-limit/usage";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";
import { toast } from "sonner";

const EMPTY_SIGNUP: SignupFormValues = { username: "", email: "", password: "" };

function SignupPageContent() {
  const { supabase } = useSupabaseAuth();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");
  const next = useMemo(() => getSafeRedirectPath(nextParam, "/ask"), [nextParam]);
  const loginHref = useMemo(() => appendSafeNextParam("/login", nextParam), [nextParam]);
  /** Set after email sign-up when Supabase sends a confirmation link (no immediate session). */
  const [sentToEmail, setSentToEmail] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const verificationSent = sentToEmail !== null;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: EMPTY_SIGNUP,
  });

  async function onSubmit(values: SignupFormValues) {
    setApiError(null);
    setSentToEmail(null);

    if (!supabase) {
      setApiError(AUTH_NOT_CONFIGURED_MESSAGE);
      return;
    }
    const origin = window.location.origin;
    const username = values.username.trim();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: values.email.trim(),
      password: values.password,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        data: {
          username: username.toLowerCase(),
          full_name: username,
        },
      },
    });

    if (signUpError) {
      setApiError(signUpError.message);
      return;
    }

    if (data.session) {
      toast.success("Welcome — you're signed in.");
      window.location.assign(next);
      return;
    }

    setSentToEmail(values.email.trim());
    reset(EMPTY_SIGNUP);
  }

  async function signUpWithGoogle() {
    setApiError(null);
    setSentToEmail(null);
    setGoogleBusy(true);

    try {
      if (!supabase) {
        setApiError(AUTH_NOT_CONFIGURED_MESSAGE);
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
        setApiError(oauthError.message);
        setGoogleBusy(false);
      }
    } catch {
      setApiError("Could not start Google sign-up. Please try again.");
      setGoogleBusy(false);
    }
  }

  return (
    <AuthShell
      title={verificationSent ? "Check your inbox" : "Create your account"}
      subtitle={
        verificationSent
          ? undefined
          : `Free tier includes ${FREE_DAILY_ASK_LIMIT} chats per day.`
      }
      leadingIcon={
        verificationSent ? <MailOpen className="size-7" strokeWidth={1.75} aria-hidden /> : undefined
      }
    >
      {verificationSent ? (
        <div className="flex flex-col items-center space-y-7 pt-1 text-center" aria-live="polite">
          <div className="space-y-3">
            <p className="text-[15px] leading-relaxed text-white/80">
              We have dispatched a secure verification link to<br />
              <span className="font-semibold tracking-wide text-white">{sentToEmail}</span>
            </p>
            <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-emerald-500/15 p-5 text-[14px] font-medium leading-relaxed text-emerald-50 shadow-[inset_0_1px_0_rgba(16,185,129,0.3)] ring-4 ring-emerald-500/5">
              <div className="absolute top-0 left-0 h-[1px] w-full bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-60" aria-hidden />
              Open the email and follow the link to activate your account. You can then sign in and explore.
            </div>
          </div>
          
          <div className="w-full pt-2">
            <button
              type="button"
              className="group flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-[14px] font-medium text-white transition-all duration-200 hover:border-white/20 hover:bg-white/10 active:scale-[0.98]"
              onClick={() => {
                setSentToEmail(null);
                reset(EMPTY_SIGNUP);
              }}
            >
              <ArrowLeft className="size-4 text-white/40 transition-transform duration-200 group-hover:-translate-x-1 group-hover:text-white/70" aria-hidden />
              Use a different email
            </button>
          </div>
        </div>
      ) : (
        <>
          <div aria-live="polite">
            {apiError ? <div className={authInlineErrorBannerClass}>{apiError}</div> : null}
          </div>

          <div className="space-y-4">
            <GoogleOAuthButton
              onClick={signUpWithGoogle}
              disabled={isSubmitting}
              loading={googleBusy}
              variant="signup"
            />
            <AuthDivider label="or with email" />
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div>
              <label htmlFor="signup-username" className={authLabelClass}>
                Username
              </label>
              <input
                id="signup-username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                aria-invalid={Boolean(errors.username)}
                className={authFieldClassWithError(Boolean(errors.username))}
                placeholder="e.g. jane_doe"
                {...register("username")}
              />
              <AuthFieldError message={errors.username?.message} />
            </div>
            <div>
              <label htmlFor="signup-email" className={authLabelClass}>
                Email
              </label>
              <input
                id="signup-email"
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
              <label htmlFor="signup-password" className={authLabelClass}>
                Password
              </label>
              <input
                id="signup-password"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(errors.password)}
                className={authFieldClassWithError(Boolean(errors.password))}
                placeholder="At least 8 characters"
                {...register("password")}
              />
              <AuthFieldError message={errors.password?.message} />
              {!errors.password ? (
                <p className="mt-1.5 text-xs text-(--vt-muted)">Use at least 8 characters.</p>
              ) : null}
            </div>
            <Button type="submit" variant="default" size="pill" className="w-full" disabled={googleBusy || isSubmitting}>
              {isSubmitting ? "Creating…" : "Create account with email"}
            </Button>
          </form>
        </>
      )}

      <p className="text-center text-sm text-(--vt-muted)">
        Already have an account?{" "}
        <Link href={loginHref} className={authSecondaryLinkClass}>
          Sign in
        </Link>
      </p>

      <nav
        className="mt-8 flex flex-wrap justify-center gap-x-4 gap-y-1 border-t border-white/[0.06] pt-6"
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

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Create your account" subtitle="Loading…">
          <AuthShellSpinner />
        </AuthShell>
      }
    >
      <SignupPageContent />
    </Suspense>
  );
}
