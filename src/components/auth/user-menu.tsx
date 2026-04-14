"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, CreditCard, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";

import type { AccountMenuProfile } from "@/lib/auth/account-menu-query";
import { useAccountMenuQuery } from "@/lib/auth/use-account-menu-query";
import { Button } from "@/components/ui/button";
import { hidesAuthChrome } from "@/lib/auth/auth-paths";
import { FREE_DAILY_ASK_LIMIT, type FreeAskUsageSummary } from "@/lib/rate-limit/usage";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";
import { toast } from "sonner";

function initialsFromUser(email: string | undefined, profile: AccountMenuProfile | null) {
  const fromDisplay = profile?.display_name?.trim();
  if (fromDisplay) {
    const parts = fromDisplay.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase() || "?";
    }
    return fromDisplay.slice(0, 2).toUpperCase();
  }
  const fromUsername = profile?.username?.trim();
  if (fromUsername) {
    return fromUsername.slice(0, 2).toUpperCase();
  }
  const local = email?.split("@")[0]?.trim();
  if (local) {
    return local.slice(0, 2).toUpperCase();
  }
  return "?";
}

export function UserMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const { supabase, user, ready, isSignedIn } = useSupabaseAuth();
  const email = user?.email ?? "";
  const accountMenuQuery = useAccountMenuQuery();
  const profile = accountMenuQuery.data?.profile ?? null;
  const usage: FreeAskUsageSummary | null = accountMenuQuery.data?.usage ?? null;

  /** Prefer human-readable name; handle without @ in the nav (email is in the dropdown). */
  const displayLabel = useMemo(() => {
    const dn = profile?.display_name?.trim();
    if (dn) {
      return dn;
    }
    const un = profile?.username?.trim();
    if (un) {
      return un;
    }
    return email.split("@")[0] || "Account";
  }, [email, profile?.display_name, profile?.username]);

  async function signOut() {
    if (!supabase) {
      return;
    }
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Signed out.");
    router.push("/");
    router.refresh();
  }

  if (!ready) {
    return (
      <div className="h-9 w-[7.5rem] shrink-0 animate-pulse rounded-full bg-white/[0.06]" aria-hidden />
    );
  }

  if (hidesAuthChrome(pathname)) {
    return null;
  }

  if (!isSignedIn || !user) {
    return (
      <Button asChild variant="outline" size="pillCompact" className="shrink-0 px-3 text-xs sm:px-4 sm:text-sm">
        <Link href="/login">Sign in</Link>
      </Button>
    );
  }

  const tierLabel = profile?.tier === "pro" ? "Pro" : "Free";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button
          type="button"
          variant="secondary"
          className="h-auto max-w-[min(100vw-8rem,14rem)] shrink-0 items-center gap-2 rounded-full border-[color:var(--vt-border)] bg-white/[0.04] py-1.5 pl-1.5 pr-2.5 text-left font-normal text-white hover:bg-white/[0.08] sm:max-w-[16rem] sm:gap-2.5 sm:pl-2 sm:pr-3"
          aria-label="Account menu"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[rgba(76,110,245,0.35)] text-xs font-bold text-white">
            {initialsFromUser(email, profile)}
          </span>
          <span className="min-w-0 flex-1 truncate text-left text-xs font-semibold sm:text-sm">{displayLabel}</span>
          <ChevronDown className="size-4 shrink-0 text-[var(--vt-muted)]" strokeWidth={2} aria-hidden />
        </Button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-[100] min-w-[14rem] overflow-hidden rounded-2xl border border-[color:var(--vt-border)] bg-[rgba(15,17,64,0.98)] p-1 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl"
          sideOffset={8}
          align="end"
        >
          <div className="border-b border-white/[0.06] px-3 py-3">
            <div className="flex items-start gap-2">
              <UserRound className="mt-0.5 size-4 shrink-0 text-[var(--vt-muted)]" strokeWidth={2} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{displayLabel}</p>
                {email ? (
                  <p className="mt-0.5 break-all text-xs text-[var(--vt-muted)]" title={email}>
                    {email}
                  </p>
                ) : null}
                <p className="mt-2 inline-flex rounded-full border border-[color:var(--vt-border)] bg-white/[0.05] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--vt-muted)]">
                  {tierLabel}
                </p>
              </div>
            </div>
          </div>

          {profile?.tier === "pro" ? (
            <div className="border-b border-white/[0.06] px-3 py-3">
              <div className="rounded-xl border border-[color:var(--vt-border)] bg-white/[0.04] px-3 py-2.5">
                <div className="flex items-center justify-between gap-3 text-[11px] font-semibold text-white">
                  <span>Daily message usage</span>
                  <span className="tabular-nums text-[var(--vt-green)]">Unlimited</span>
                </div>
                <div
                  className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.08]"
                  role="progressbar"
                  aria-label="Daily message usage"
                  aria-valuetext="Unlimited"
                >
                  <div className="h-full w-full rounded-full bg-[var(--vt-green)]" />
                </div>
                <p className="mt-2 text-[11px] text-[var(--vt-muted)]">Pro: no daily cap on Ask messages.</p>
              </div>
            </div>
          ) : null}

          {profile?.tier !== "pro" && usage ? (
            <div className="border-b border-white/[0.06] px-3 py-3">
              <div className="rounded-xl border border-[color:var(--vt-border)] bg-white/[0.04] px-3 py-2.5">
                <div className="flex items-center justify-between gap-3 text-[11px] font-semibold text-white">
                  <span>Daily message usage</span>
                  <span>
                    {usage.used}/{FREE_DAILY_ASK_LIMIT}
                  </span>
                </div>
                <div
                  className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.08]"
                  role="progressbar"
                  aria-label="Daily message usage"
                  aria-valuemin={0}
                  aria-valuemax={usage.limit}
                  aria-valuenow={usage.used}
                >
                  <div
                    className="h-full rounded-full bg-[var(--vt-blue)] transition-[width]"
                    style={{ width: `${usage.progressPercent}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] text-[var(--vt-muted)]">
                  {usage.remaining} free messages left today.
                </p>
              </div>
            </div>
          ) : null}

          <DropdownMenu.Item asChild>
            <Link
              href={profile?.tier === "pro" ? "/billing" : "/pricing"}
              className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-white outline-none data-[highlighted]:bg-white/[0.08]"
            >
              <CreditCard className="size-4 text-[var(--vt-muted)]" strokeWidth={2} aria-hidden />
              {profile?.tier === "pro" ? "Manage subscription" : "Upgrade to Pro"}
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-white outline-none data-[highlighted]:bg-white/[0.08]"
            onSelect={(event) => {
              event.preventDefault();
              void signOut();
            }}
          >
            <LogOut className="size-4 text-[var(--vt-muted)]" strokeWidth={2} aria-hidden />
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
