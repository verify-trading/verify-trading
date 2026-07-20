"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Mail } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useReducer } from "react";
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
import { CaptchaWidget } from "@/components/auth/captcha-widget";
import { useCaptcha } from "@/components/auth/use-captcha";
import { AuthShell, AuthShellSpinner } from "@/components/auth/auth-shell";
import { appendSafeNextParam, getSafeRedirectPath } from "@/lib/auth/safe-redirect";
import { AUTH_NOT_CONFIGURED_MESSAGE } from "@/lib/auth/messages";
import { forgotPasswordSchema, type ForgotPasswordFormValues } from "@/lib/auth/schemas";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";

type ForgotPasswordState = {
  info: string | null;
  loading: boolean;
  apiError: string | null;
};

type ForgotPasswordAction =
  | { type: "submit_start" }
  | { type: "submit_end" }
  | { type: "error"; message: string }
  | { type: "success"; message: string };

const initialForgotPasswordState: ForgotPasswordState = {
  info: null,
  loading: false,
  apiError: null,
};

function forgotPasswordReducer(
  state: ForgotPasswordState,
  action: ForgotPasswordAction,
): ForgotPasswordState {
  switch (action.type) {
    case "submit_start":
      return { ...state, apiError: null, info: null, loading: true };
    case "submit_end":
      return { ...state, loading: false };
    case "error":
      return { ...state, apiError: action.message };
    case "success":
      return { ...state, info: action.message };
  }
}

function readSearchParam(params: ReturnType<typeof useSearchParams>, key: string): string | null {
  return params.get(key);
}

function ForgotPasswordPageContent() {
  const { supabase } = useSupabaseAuth();
  const searchParams = useSearchParams();
  const nextParam = readSearchParam(searchParams, "next");
  const next = useMemo(() => getSafeRedirectPath(nextParam, "/ask"), [nextParam]);
  const loginHref = useMemo(() => appendSafeNextParam("/login", nextParam), [nextParam]);
  const [state, dispatch] = useReducer(forgotPasswordReducer, initialForgotPasswordState);
  const { info, loading, apiError } = state;
  const captcha = useCaptcha();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordFormValues) {
    dispatch({ type: "submit_start" });

    try {
      if (!supabase) {
        dispatch({ type: "error", message: AUTH_NOT_CONFIGURED_MESSAGE });
        return;
      }

      if (captcha.blocked) {
        dispatch({ type: "error", message: "Please complete the security check before continuing." });
        return;
      }

      const origin = window.location.origin;
      const updatePasswordPath = appendSafeNextParam("/auth/update-password", next);
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(values.email.trim(), {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(updatePasswordPath)}`,
        captchaToken: captcha.token,
      });

      if (resetError) {
        dispatch({ type: "error", message: resetError.message });
        captcha.reset();
        return;
      }

      dispatch({
        type: "success",
        message: "If an account exists for this email, you will receive a reset link shortly.",
      });
    } finally {
      dispatch({ type: "submit_end" });
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
        <CaptchaWidget {...captcha.widgetProps} />
        <Button type="submit" variant="default" size="pill" className="w-full" disabled={loading || captcha.blocked}>
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
