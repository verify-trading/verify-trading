"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { AuthDivider } from "@/components/auth/auth-divider";
import {
  authFieldClassWithError,
  authInlineErrorBannerClass,
  authInlineInfoBannerClass,
  authLabelClass,
  authSecondaryLinkClass,
} from "@/components/auth/auth-field-styles";
import { Button } from "@/components/ui/button";
import { AuthFieldError } from "@/components/auth/auth-field-error";
import { AuthShell, AuthShellSpinner } from "@/components/auth/auth-shell";
import { GoogleOAuthButton } from "@/components/auth/google-oauth-button";
import { beginOAuthFlow } from "@/lib/auth/oauth-flow";
import { appendSafeNextParam, getSafeRedirectPath } from "@/lib/auth/safe-redirect";
import { AUTH_NOT_CONFIGURED_MESSAGE } from "@/lib/auth/messages";
import { signupSchema, type SignupFormValues } from "@/lib/auth/schemas";
import { LEGAL_LINKS } from "@/lib/legal/legal-links";
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
        setApiError(AUTH_NOT_CONFIGURED_MESSAGE);
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
          <div className={authInlineErrorBannerClass}>{apiError}</div>
        ) : null}
        {info ? <div className={authInlineInfoBannerClass}>{info}</div> : null}
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
