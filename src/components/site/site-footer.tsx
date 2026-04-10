import Link from "next/link";

import { LEGAL_LINKS } from "@/lib/legal/legal-links";
import { getAppName } from "@/lib/site-config";

export function SiteFooter() {
  const year = new Date().getFullYear();
  const app = getAppName();

  return (
    <footer className="mt-auto border-t border-[color:var(--vt-border)] bg-[rgba(10,13,46,0.92)]">
      <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <nav
          className="flex flex-col items-center gap-8 sm:flex-row sm:justify-between sm:gap-6"
          aria-label="Legal"
        >
          <p className="order-2 text-center text-xs leading-relaxed text-white/40 sm:order-1 sm:text-left">
            © {year} {app}. 
          </p>
          <ul className="order-1 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 sm:order-2 sm:justify-end">
            {LEGAL_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm font-medium text-[var(--vt-muted)] transition hover:text-white"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
