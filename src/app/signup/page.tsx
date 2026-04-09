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
import { signupSchema, type SignupFormValues } from "@/lib/auth/schemas";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";
import { toast } from "sonner";

function SignupPageContent() {
  const router = useRouter();
  const { supabase } = useSupabaseAuth();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");
  const next = useMemo(() => getSafeRedirectPath(nextParam, "/ask"), [nextParam]);
  const loginHref = useMemo(() => appendSafeNextParam("/login", nextParam), [nextParam]);
  const [info, setInfo] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { username: "", email: "", password: "" },
  });

  async function onSubmit(values: SignupFormValues) {
    setApiError(null);
    setInfo(null);

    if (!supabase) {
      setApiError("Authentication is not configured. Check environment variables.");
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
      router.push(next);
      router.refresh();
      return;
    }

    setInfo("Check your email to confirm your account, then sign in.");
  }

  async function signUpWithGoogle() {
    setApiError(null);
    setInfo(null);
    setGoogleBusy(true);

    try {
      if (!supabase) {
        setApiError("Authentication is not configured. Check environment variables.");
        setGoogleBusy(false);
        return;
      }
      beginOAuthFlow("signup");
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
      title="Create your account"
      subtitle="Free tier includes 10 chats per day."
    >
      <div aria-live="polite">
        {apiError ? (
          <div className="rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {apiError}
          </div>
        ) : null}
        {info ? (
          <div className="rounded-xl border border-[rgba(76,110,245,0.35)] bg-[rgba(76,110,245,0.12)] px-4 py-3 text-sm text-slate-100">
            {info}
          </div>
        ) : null}
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
            <p className="mt-1.5 text-xs text-[var(--vt-muted)]">Use at least 8 characters.</p>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={googleBusy || isSubmitting}
          className={authPrimaryButtonClass}
        >
          {isSubmitting ? "Creating…" : "Create account with email"}
        </button>
      </form>

      <p className="text-center text-sm text-(--vt-muted)">
        Already have an account?{" "}
        <Link href={loginHref} className={authSecondaryLinkClass}>
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Create your account" subtitle="Loading…">
          <div className="h-40 animate-pulse rounded-xl bg-white/6" />
        </AuthShell>
      }
    >
      <SignupPageContent />
    </Suspense>
  );
}
