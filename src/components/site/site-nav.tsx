"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/site/logo";

const navItems = [
  { href: "/ask", label: "Ask" },
  { href: "/markets", label: "Markets" },
  { href: "/tools", label: "Tools" },
];

export function SiteNav() {
  const pathname = usePathname();
  const isLanding = pathname === "/";

  return (
    <nav className="sticky top-0 z-50 border-b border-[color:var(--vt-border)] bg-[rgba(10,13,46,0.92)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between px-4 sm:px-6">
        <Link href="/" className="shrink-0">
          <Logo />
        </Link>
        <div className="flex max-w-[min(100%,18rem)] items-center gap-0.5 overflow-x-auto rounded-full border border-[color:var(--vt-border)] bg-white/5 p-1 sm:max-w-none sm:gap-2">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm ${
                  active
                    ? "bg-[var(--vt-card)] text-white"
                    : "text-[var(--vt-muted)] hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
        <Link
          href={isLanding ? "/ask" : "/"}
          className="rounded-full bg-[var(--vt-coral)] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_40px_rgba(242,109,109,0.28)] transition hover:brightness-105"
        >
          {isLanding ? "Open Ask" : "Back Home"}
        </Link>
      </div>
    </nav>
  );
}
