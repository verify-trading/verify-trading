"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { startTransition, useEffect, useState } from "react";
import { Home, LineChart, Menu, MessageSquare, Wrench } from "lucide-react";

import { Logo } from "@/components/site/logo";
import { Sheet } from "@/components/ui/sheet";

const navItems = [
  { href: "/ask", label: "Ask", icon: MessageSquare },
  { href: "/markets", label: "Markets", icon: LineChart },
  { href: "/tools", label: "Tools", icon: Wrench },
] as const;

/** Height of the mobile header bar below safe-area (single row `h-14`). Used by overlays (e.g. Ask session sheet). */
export const MOBILE_SITE_NAV_BODY_REM = "3.5rem";

export function SiteNav() {
  const pathname = usePathname();
  const isLanding = pathname === "/";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    startTransition(() => {
      setMobileMenuOpen(false);
    });
  }, [pathname]);

  const navLinkClass = (active: boolean) =>
    [
      "shrink-0 rounded-full px-2.5 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm",
      active
        ? "bg-[var(--vt-card)] text-white"
        : "text-[var(--vt-muted)] hover:text-white",
    ].join(" ");

  const sheetLinkClass = (active: boolean) =>
    [
      "flex items-center gap-3 rounded-xl px-4 py-3.5 text-base font-semibold transition active:bg-white/10",
      active ? "bg-white/[0.08] text-white" : "text-white/80 hover:bg-white/[0.05]",
    ].join(" ");

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-[color:var(--vt-border)] bg-[rgba(10,13,46,0.92)] pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        {/* Mobile / tablet: logo + menu sheet — no crowded inline tabs */}
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-3 lg:hidden">
          <Link href="/" className="min-w-0 shrink-0" onClick={() => setMobileMenuOpen(false)}>
            <Logo compact />
          </Link>
          <button
            type="button"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white transition hover:bg-white/[0.08]"
            aria-expanded={mobileMenuOpen}
            aria-haspopup="dialog"
            aria-controls="site-mobile-nav-sheet"
            aria-label="Open menu"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="size-5" strokeWidth={2} aria-hidden />
          </button>
        </div>

        {/* Desktop */}
        <div className="mx-auto hidden h-14 w-full max-w-6xl items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6 lg:flex lg:h-16">
          <Link href="/" className="min-w-0 shrink-0">
            <Logo />
          </Link>
          <div className="mx-1 flex min-w-0 flex-1 items-center justify-center gap-0.5 overflow-x-auto rounded-full border border-[color:var(--vt-border)] bg-white/5 p-1 sm:mx-3 sm:gap-2">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} className={navLinkClass(active)}>
                  {item.label}
                </Link>
              );
            })}
          </div>
          <Link
            href={isLanding ? "/ask" : "/"}
            className="shrink-0 rounded-full bg-[var(--vt-coral)] px-3 py-2 text-xs font-semibold text-white shadow-[0_12px_40px_rgba(242,109,109,0.28)] transition hover:brightness-105 sm:px-4 sm:text-sm"
          >
            {isLanding ? "Open Ask" : (
              <>
                <span className="sm:hidden">Home</span>
                <span className="hidden sm:inline">Back Home</span>
              </>
            )}
          </Link>
        </div>
      </nav>

      <Sheet
        id="site-mobile-nav-sheet"
        open={mobileMenuOpen}
        onOpenChange={setMobileMenuOpen}
        side="right"
        title="Menu"
      >
        <nav className="flex flex-col gap-1" aria-label="Main">
          {navItems.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={sheetLinkClass(active)}
                onClick={() => setMobileMenuOpen(false)}
              >
                <Icon className="size-5 shrink-0 text-[var(--vt-muted)]" strokeWidth={2} aria-hidden />
                {item.label}
              </Link>
            );
          })}

          <div className="my-2 border-t border-white/[0.06]" role="separator" />

          <Link
            href={isLanding ? "/ask" : "/"}
            className="flex items-center justify-center gap-2 rounded-xl bg-[var(--vt-coral)] px-4 py-3.5 text-base font-semibold text-white shadow-[0_12px_40px_rgba(242,109,109,0.25)] transition hover:brightness-105"
            onClick={() => setMobileMenuOpen(false)}
          >
            <Home className="size-5" strokeWidth={2} aria-hidden />
            {isLanding ? "Open Ask" : "Back home"}
          </Link>
        </nav>
      </Sheet>
    </>
  );
}
