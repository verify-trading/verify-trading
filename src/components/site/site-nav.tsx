"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { startTransition, useEffect, useState, useSyncExternalStore } from "react";
import type { LucideProps } from "lucide-react";
import { BookOpen, Mail, Menu } from "lucide-react";

import { UserMenu } from "@/components/auth/user-menu";
import { Button } from "@/components/ui/button";
import { trackAnalyticsEvent } from "@/lib/analytics/client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { hidesAuthChrome } from "@/lib/auth/auth-paths";
import { Logo } from "@/components/site/logo";
import { Sheet } from "@/components/ui/sheet";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";
import { cn } from "@/lib/utils";

/** The web sheet uses the same core glyphs as the mobile tab bar. */
function AskNavIcon({ size = 24, strokeWidth = 1.8, color, absoluteStrokeWidth, ...props }: LucideProps) {
  void absoluteStrokeWidth;
  return (
    <svg
      {...props}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? "currentColor"}
      strokeWidth={Number(strokeWidth) * 0.62}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="11" />
      <circle cx="12" cy="12" r="9.9" />
      <path d="M17 10.3a2.4 2.4 0 0 0-2.4-2.4H9.4A2.4 2.4 0 0 0 7 10.3v1.6a2.4 2.4 0 0 0 2.4 2.4h.1v2.9l2.9-2.9h2.2a2.4 2.4 0 0 0 2.4-2.4z" strokeWidth={strokeWidth} />
      <circle cx="14.5" cy="10.4" r="1.15" fill="var(--vt-coral)" stroke="none" />
    </svg>
  );
}

function MarketsNavIcon({ size = 24, strokeWidth = 1.8, color, absoluteStrokeWidth, ...props }: LucideProps) {
  void absoluteStrokeWidth;
  return (
    <svg
      {...props}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? "currentColor"}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15.5 3h5v5" />
      <path d="M20.5 3 10 11 6.5 7.5 3 11.5" />
      <path d="M4.6 17h.8a1 1 0 0 1 1 1v3H3.6v-3a1 1 0 0 1 1-1z" />
      <path d="M12.1 14.5h.8a1 1 0 0 1 1 1V21h-2.8v-5.5a1 1 0 0 1 1-1z" />
      <path d="M18.6 11.5h.8a1 1 0 0 1 1 1V21h-2.8v-8.5a1 1 0 0 1 1-1z" />
    </svg>
  );
}

const navItems = [
  { href: "/ask", label: "Ask", icon: AskNavIcon, requiresAuth: true },
  { href: "/markets", label: "Markets", icon: MarketsNavIcon, requiresAuth: true },
  { href: "/guide", label: "Guide", icon: BookOpen, requiresAuth: false },
  { href: "/contact", label: "Contact", icon: Mail, requiresAuth: false },
] as const;

function subscribeToClient() {
  return () => {};
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

function siteNavLinkClass(active: boolean) {
  return [
    "shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium tracking-tight transition sm:px-3",
    active
      ? "bg-white/10 text-white"
      : "text-white/45 hover:bg-white/[0.06] hover:text-white",
  ].join(" ");
}

function trackNavItemClick(label: string) {
  if (label === "Ask") {
    trackAnalyticsEvent(ANALYTICS_EVENTS.openAskClicked, {
      location: "site_nav",
      label,
    });
    return;
  }

  if (label === "Guide") {
    trackAnalyticsEvent(ANALYTICS_EVENTS.guideClicked, {
      location: "site_nav",
      label,
    });
  }
}

export function SiteNav() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const hasMounted = useSyncExternalStore(subscribeToClient, getClientSnapshot, getServerSnapshot);
  const { ready, isSignedIn } = useSupabaseAuth();
  const hideAuthChrome = hidesAuthChrome(pathname);

  useEffect(() => {
    startTransition(() => {
      setMobileMenuOpen(false);
    });
  }, [pathname]);

  const sheetLinkClass = (active: boolean) =>
    [
      "group flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-base font-semibold transition active:bg-white/10",
      active
        ? "border-white/10 bg-white/[0.08] text-white"
        : "border-transparent text-white/80 hover:bg-white/[0.05]",
    ].join(" ");

  const visibleNavItems = hideAuthChrome
    ? []
    : navItems.filter((item) => !item.requiresAuth || (ready && isSignedIn));

  const showMenu = visibleNavItems.length > 0;
  /** Avoid hydration mismatch: SSR and first paint match (end-aligned); after mount, centre when signed in. */
  const desktopNavCentered = hasMounted && ready && isSignedIn;

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-white/[0.07] bg-[rgb(10,13,46)]/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-3 sm:gap-3 sm:px-4 lg:min-h-14 lg:gap-4 lg:px-6">
          <Link
            href="/"
            className="min-w-0 shrink-0"
            onClick={() => setMobileMenuOpen(false)}
          >
            <span className="lg:hidden">
              <Logo compact />
            </span>
            <span className="hidden lg:inline">
              <Logo />
            </span>
          </Link>

          {/* Desktop: centred when signed in; end-aligned when signed out (no centre links) */}
          <div
            className={cn(
              "hidden min-w-0 flex-1 overflow-x-auto hide-scrollbar lg:flex lg:items-center lg:px-4",
              desktopNavCentered
                ? "lg:justify-center"
                : "lg:justify-end lg:gap-3",
            )}
          >
            {visibleNavItems.length > 0 ? (
              <nav
                className="flex min-w-max items-center gap-0.5 sm:gap-1"
                aria-label="Main"
              >
                {visibleNavItems.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch={false}
                      className={siteNavLinkClass(active)}
                      onClick={() => trackNavItemClick(item.label)}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            ) : null}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            <UserMenu />
            {showMenu ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 rounded-md text-white/90 hover:bg-white/[0.08] lg:hidden"
                aria-expanded={mobileMenuOpen}
                aria-haspopup="dialog"
                aria-controls="site-mobile-nav-sheet"
                aria-label="Open menu"
                onClick={() => setMobileMenuOpen(true)}
              >
                <Menu className="size-5" strokeWidth={2} aria-hidden />
              </Button>
            ) : null}
          </div>
        </div>
      </nav>

      {showMenu ? (
        <Sheet
          id="site-mobile-nav-sheet"
          open={mobileMenuOpen}
          onOpenChange={setMobileMenuOpen}
          side="right"
          title="Menu"
        >
          <nav className="flex flex-col gap-1" aria-label="Main">
            {visibleNavItems.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  className={sheetLinkClass(active)}
                  aria-current={active ? "page" : undefined}
                  onClick={() => {
                    trackNavItemClick(item.label);
                    setMobileMenuOpen(false);
                  }}
                >
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-xl border transition-colors",
                      active
                        ? "border-[rgba(242,109,109,0.35)] bg-[rgba(242,109,109,0.12)] text-[var(--vt-coral)]"
                        : "border-white/[0.08] bg-white/[0.04] text-[var(--vt-muted)] group-hover:text-white",
                    )}
                  >
                    <Icon size={24} strokeWidth={active ? 1.9 : 1.6} aria-hidden />
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </Sheet>
      ) : null}
    </>
  );
}
