"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getOnboardingCallUrl } from "@/lib/site-config";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";

type BannerProfile = {
  tier: string;
  created_at: string;
  preferences: Record<string, unknown> | null;
};

const ONBOARDING_BANNER_DAYS = 7;
const ONBOARDING_BANNER_PREF_KEY = "onboarding_call_banner_last_dismissed_at";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isWithinOnboardingWindow(createdAt: string) {
  const createdAtMs = new Date(createdAt).getTime();
  if (!Number.isFinite(createdAtMs)) {
    return false;
  }
  return Date.now() - createdAtMs < ONBOARDING_BANNER_DAYS * 24 * 60 * 60 * 1000;
}

export function OnboardingCallBanner() {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { supabase, user, ready, isSignedIn } = useSupabaseAuth();
  const [isSavingDismissal, setIsSavingDismissal] = useState(false);
  const bookingUrl = getOnboardingCallUrl();
  const queryKey = ["onboarding-call-banner", user?.id ?? ""] as const;
  const dismissalSessionKey = user?.id
    ? `vt:onboarding-call-banner:${user.id}:${user.last_sign_in_at ?? "signed-in"}`
    : null;

  const profileQuery = useQuery({
    queryKey,
    enabled: Boolean(ready && isSignedIn && supabase && user?.id),
    queryFn: async (): Promise<BannerProfile | null> => {
      const { data, error } = await supabase!
        .from("profiles")
        .select("tier, created_at, preferences")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) {
        throw error;
      }
      return (data as BannerProfile | null) ?? null;
    },
  });
  const dismissedThisLogin = useSyncExternalStore(
    () => () => undefined,
    () =>
      dismissalSessionKey && typeof window !== "undefined"
        ? window.sessionStorage.getItem(dismissalSessionKey) === "1"
        : false,
    () => false,
  );

  const shouldShow =
    pathname.startsWith("/ask") &&
    ready &&
    isSignedIn &&
    !profileQuery.isLoading &&
    !profileQuery.isError &&
    profileQuery.data?.tier === "free" &&
    isWithinOnboardingWindow(profileQuery.data.created_at) &&
    !dismissedThisLogin;

  async function dismissBanner() {
    if (!supabase || !user || !profileQuery.data || isSavingDismissal) {
      return;
    }

    const nextPreferences = {
      ...(isRecord(profileQuery.data.preferences) ? profileQuery.data.preferences : {}),
      [ONBOARDING_BANNER_PREF_KEY]: new Date().toISOString(),
    };

    setIsSavingDismissal(true);
    const { error } = await supabase
      .from("profiles")
      .update({ preferences: nextPreferences })
      .eq("id", user.id);
    setIsSavingDismissal(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    if (dismissalSessionKey && typeof window !== "undefined") {
      window.sessionStorage.setItem(dismissalSessionKey, "1");
    }

    queryClient.setQueryData<BannerProfile | null>(queryKey, (current) =>
      current ? { ...current, preferences: nextPreferences } : current,
    );
  }

  if (!shouldShow) {
    return null;
  }

  return (
    <div className="border-b border-[color:var(--vt-border)] bg-white/[0.03]">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-1.5 sm:gap-3 sm:px-4 sm:py-2">
        <p className="min-w-0 flex-1 text-xs leading-snug text-white/90 sm:text-sm">
          Book your free onboarding call — 10 minutes with an expert trader
        </p>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {bookingUrl ? (
            <Button
              asChild
              variant="ghost"
              className="h-auto rounded-full border-0 bg-white px-2.5 py-1 text-xs font-semibold text-[var(--vt-navy)] shadow-none hover:bg-white/90 hover:opacity-90 sm:px-3 sm:text-sm"
            >
              <Link href={bookingUrl} target="_blank" rel="noreferrer">
                Book now →
              </Link>
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              className="h-auto rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/60 sm:px-3 sm:text-sm"
              onClick={() =>
                toast.error("Set NEXT_PUBLIC_ONBOARDING_CALL_URL to enable the booking link.")
              }
            >
              Book now →
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 rounded-full text-white/45 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => void dismissBanner()}
            disabled={isSavingDismissal}
            aria-label="Dismiss onboarding banner"
          >
            <X className="size-4" strokeWidth={2} aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
