"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { startTransition, useEffect, useState } from "react";
import { BookOpen, LineChart, Menu, MessageSquare } from "lucide-react";

import { UserMenu } from "@/components/auth/user-menu";
import { Button } from "@/components/ui/button";
import { hidesAuthChrome } from "@/lib/auth/auth-paths";
import { Logo } from "@/components/site/logo";
import { Sheet } from "@/components/ui/sheet";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/ask", label: "Ask", icon: MessageSquare, requiresAuth: true },
  { href: "/markets", label: "Markets", icon: LineChart, requiresAuth: true },
  { href: "/guide", label: "Guide", icon: BookOpen, requiresAuth: true },
] as const;

/** Mobile header height for fixed overlays (single row + safe area). */
export const MOBILE_SITE_NAV_BODY_REM = "3.5rem";

function siteNavLinkClass(active: boolean) {
  return [
    "shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium tracking-tight transition sm:px-3",
    active ? "bg-white/10 text-white" : "text-white/45 hover:bg-white/[0.06] hover:text-white",
  ].join(" ");
}

export function SiteNav() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const { ready, isSignedIn } = useSupabaseAuth();
  const hideAuthChrome = hidesAuthChrome(pathname);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    startTransition(() => {
      setMobileMenuOpen(false);
    });
  }, [pathname]);

  const sheetLinkClass = (active: boolean) =>
    [
      "flex items-center gap-3 rounded-xl px-4 py-3.5 text-base font-semibold transition active:bg-white/10",
      active ? "bg-white/[0.08] text-white" : "text-white/80 hover:bg-white/[0.05]",
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
          <Link href="/" className="min-w-0 shrink-0" onClick={() => setMobileMenuOpen(false)}>
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
              desktopNavCentered ? "lg:justify-center" : "lg:justify-end lg:gap-3",
            )}
          >
            {visibleNavItems.length > 0 ? (
              <nav className="flex min-w-max items-center gap-0.5 sm:gap-1" aria-label="Main">
                {visibleNavItems.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch={false}
                      className={siteNavLinkClass(active)}
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
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Icon className="size-5 shrink-0 text-[var(--vt-muted)]" strokeWidth={2} aria-hidden />
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
