"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import {
  authFieldClassWithError,
  authInlineErrorBannerClass,
  authLabelClass,
  authSecondaryLinkClass,
} from "@/components/auth/auth-field-styles";
import { Button } from "@/components/ui/button";
import { AuthFieldError } from "@/components/auth/auth-field-error";
import { AuthShell, AuthShellSpinner } from "@/components/auth/auth-shell";
import { AUTH_NOT_CONFIGURED_MESSAGE } from "@/lib/auth/messages";
import { appendSafeNextParam } from "@/lib/auth/safe-redirect";
import { updatePasswordSchema, type UpdatePasswordFormValues } from "@/lib/auth/schemas";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";

function UpdatePasswordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");
  const loginHref = useMemo(() => appendSafeNextParam("/login", nextParam), [nextParam]);
  const resetSuccessHref = useMemo(
    () => appendSafeNextParam("/login?reset=success", nextParam),
    [nextParam],
  );
  const { supabase, user, ready } = useSupabaseAuth();
  const [apiError, setApiError] = useState<string | null>(null);
  const [isCompletingReset, setIsCompletingReset] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdatePasswordFormValues>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (ready && !user && !isCompletingReset) {
      router.replace(loginHref);
    }
  }, [isCompletingReset, loginHref, ready, router, user]);

  async function onSubmit(values: UpdatePasswordFormValues) {
    setApiError(null);

    if (!supabase) {
      setApiError(AUTH_NOT_CONFIGURED_MESSAGE);
      return;
    }
    if (!user) {
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: values.password });

    if (error) {
      setApiError(error.message);
      return;
    }

    setIsCompletingReset(true);

    const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });

    if (signOutError) {
      setIsCompletingReset(false);
      setApiError("Password updated, but we could not end the recovery session. Please sign in again.");
      return;
    }

    router.replace(resetSuccessHref);
    router.refresh();
  }

  if (!ready) {
    return (
      <AuthShell
        title="Choose a new password"
        subtitle="Loading…"
        leadingIcon={<KeyRound className="size-7" strokeWidth={1.75} aria-hidden />}
      >
        <AuthShellSpinner />
      </AuthShell>
    );
  }

  if (!user) {
    return (
      <AuthShell
        title="Choose a new password"
        subtitle="Redirecting to sign in…"
        leadingIcon={<KeyRound className="size-7" strokeWidth={1.75} aria-hidden />}
      >
        <AuthShellSpinner />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Your reset link is active. Use a strong password you haven’t used on other sites."
      leadingIcon={<KeyRound className="size-7" strokeWidth={1.75} aria-hidden />}
    >
      <div aria-live="polite">
        {apiError ? (
          <div className={authInlineErrorBannerClass}>{apiError}</div>
        ) : null}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <label htmlFor="new-password" className={authLabelClass}>
            New password
          </label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
            className={authFieldClassWithError(Boolean(errors.password))}
            placeholder="At least 8 characters"
            {...register("password")}
          />
          <AuthFieldError message={errors.password?.message} />
        </div>
        <div>
          <label htmlFor="confirm-new-password" className={authLabelClass}>
            Confirm new password
          </label>
          <input
            id="confirm-new-password"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.confirmPassword)}
            className={authFieldClassWithError(Boolean(errors.confirmPassword))}
            placeholder="Same as above"
            {...register("confirmPassword")}
          />
          <AuthFieldError message={errors.confirmPassword?.message} />
        </div>
        <Button type="submit" variant="default" size="pill" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save new password"}
        </Button>
      </form>

      <p className="text-center text-sm text-(--vt-muted)">
        Wrong place?{" "}
        <Link href={loginHref} className={authSecondaryLinkClass}>
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}

export default function UpdatePasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthShell
          title="Choose a new password"
          subtitle="Loading…"
          leadingIcon={<KeyRound className="size-7" strokeWidth={1.75} aria-hidden />}
        >
          <AuthShellSpinner />
        </AuthShell>
      }
    >
      <UpdatePasswordPageContent />
    </Suspense>
  );
}
