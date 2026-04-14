"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Mail } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import {
  authFieldClassWithError,
  authInlineErrorBannerClass,
  authInlineSuccessBannerFlexClass,
  authLabelClass,
  authSecondaryLinkClass,
} from "@/components/auth/auth-field-styles";
import { Button } from "@/components/ui/button";
import { AuthFieldError } from "@/components/auth/auth-field-error";
import { AuthShell, AuthShellSpinner } from "@/components/auth/auth-shell";
import { appendSafeNextParam, getSafeRedirectPath } from "@/lib/auth/safe-redirect";
import { AUTH_NOT_CONFIGURED_MESSAGE } from "@/lib/auth/messages";
import { forgotPasswordSchema, type ForgotPasswordFormValues } from "@/lib/auth/schemas";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";

function ForgotPasswordPageContent() {
  const { supabase } = useSupabaseAuth();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");
  const next = useMemo(() => getSafeRedirectPath(nextParam, "/ask"), [nextParam]);
  const loginHref = useMemo(() => appendSafeNextParam("/login", nextParam), [nextParam]);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordFormValues) {
    setApiError(null);
    setInfo(null);
    setLoading(true);

    try {
      if (!supabase) {
        setApiError(AUTH_NOT_CONFIGURED_MESSAGE);
        return;
      }
      const origin = window.location.origin;
      const updatePasswordPath = appendSafeNextParam("/auth/update-password", next);
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(values.email.trim(), {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(updatePasswordPath)}`,
      });

      if (resetError) {
        setApiError(resetError.message);
        return;
      }

      setInfo("If an account exists for this email, you will receive a reset link shortly.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email and we’ll send a secure link to choose a new password."
      leadingIcon={<Mail className="size-7" strokeWidth={1.75} aria-hidden />}
    >
      <div className="space-y-4" aria-live="polite">
        {apiError ? (
          <div className={authInlineErrorBannerClass}>{apiError}</div>
        ) : null}
        {info ? (
          <div className={authInlineSuccessBannerFlexClass}>
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-400/90" aria-hidden />
            <span>{info}</span>
          </div>
        ) : null}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <label htmlFor="reset-email" className={authLabelClass}>
            Email
          </label>
          <input
            id="reset-email"
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
        <Button type="submit" variant="default" size="pill" className="w-full" disabled={loading}>
          {loading ? "Sending…" : "Send reset link"}
        </Button>
      </form>

      <p className="text-center text-sm text-(--vt-muted)">
        Remember your password?{" "}
        <Link href={loginHref} className={authSecondaryLinkClass}>
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthShell
          title="Reset your password"
          subtitle="Loading…"
          leadingIcon={<Mail className="size-7" strokeWidth={1.75} aria-hidden />}
        >
          <AuthShellSpinner />
        </AuthShell>
      }
    >
      <ForgotPasswordPageContent />
    </Suspense>
  );
}
