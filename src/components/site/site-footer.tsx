import Link from "next/link";
import type { ReactNode } from "react";

import { AppWordmarkInline } from "@/components/site/logo";
import { LEGAL_LINKS } from "@/lib/legal/legal-links";
import { getAppName, SOCIAL_URLS } from "@/lib/site-config";

const FOOTER_COLUMNS: Array<{ title: string; links: Array<[label: string, href: string]> }> = [
  {
    title: "Platform",
    links: [
      ["How it Works", "/how-it-works"],
      ["Pricing", "/pricing"],
      ["Methodology", "/methodology"],
    ],
  },
  {
    title: "Products",
    links: [
      ["Ask", "/ask"],
      ["Verify", "/verify"],
      ["Markets", "/markets"],
      ["Intelligence", "/intelligence"],
      ["Economic Calendar", "/economic-calendar"],
      ["Journal", "/journal"],
      ["Mind", "/mind"],
    ],
  },
  {
    title: "Compare",
    links: [
      ["Compare Brokers", "/compare/brokers"],
      ["Compare Prop Firms", "/compare/prop-firms"],
      ["Regulators", "/regulators"],
    ],
  },
  {
    title: "Who it's for",
    links: [
      ["Retail Traders", "/retail-traders"],
      ["Prop Firm Traders", "/prop-firm-traders"],
      ["Affiliates", "/affiliates"],
      ["Brokers", "/brokers"],
      ["Prop Firms", "/prop-firms"],
    ],
  },
  {
    title: "Resources",
    links: [
      ["Blog", "/blog"],
      ["Learning Hub", "/resources"],
      ["Glossary", "/glossary"],
      ["Risk Calculators", "/tools"],
      ["FAQ", "/faq"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About", "/about"],
      ["Trust & Independence", "/trust"],
      ["Careers", "/careers"],
      ["Contact", "/contact"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["Privacy Policy", "/privacy"],
      ["Terms of Service", "/terms"],
      ["Disclaimer", "/risk-disclosure"],
    ],
  },
];

const [PRIVACY_LINK, TERMS_LINK] = LEGAL_LINKS;

const linkClass = "text-sm text-[var(--vt-muted)] transition hover:text-white";

const svg = { viewBox: "0 0 24 24", "aria-hidden": true, className: "size-[18px]" } as const;
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const SOCIALS: Array<{ label: string; href: string; icon: ReactNode }> = [
  {
    label: "Instagram",
    href: SOCIAL_URLS.instagram,
    icon: (
      <svg {...svg} {...stroke}>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.3" cy="6.7" r="0.6" fill="currentColor" />
      </svg>
    ),
  },
  {
    label: "TikTok",
    href: SOCIAL_URLS.tiktok,
    icon: (
      <svg {...svg} fill="currentColor">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
      </svg>
    ),
  },
  {
    label: "X",
    href: SOCIAL_URLS.x,
    icon: (
      <svg {...svg} fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: "LinkedIn",
    href: SOCIAL_URLS.linkedin,
    icon: (
      <svg {...svg} {...stroke}>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="M8 10.5V16M8 7.8v.01M12 16v-5.5M12 13c0-1.7 1-2.5 2.3-2.5S16.5 11.3 16.5 13v3" />
      </svg>
    ),
  },
  {
    label: "YouTube",
    href: SOCIAL_URLS.youtube,
    icon: (
      <svg {...svg} {...stroke}>
        <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
        <path d="m10.5 9.5 4 2.5-4 2.5z" fill="currentColor" />
      </svg>
    ),
  },
];

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-white/[0.07] bg-[rgba(10,13,46,0.92)]">
      <div className="mx-auto w-full max-w-7xl px-4 pb-8 pt-12 sm:px-6 lg:px-8">
        <Link href="/" className="inline-block text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
          <AppWordmarkInline />
        </Link>
        <p className="mt-3 text-sm text-[var(--vt-muted)] sm:text-base">
          Independent verification. Trusted intelligence.
        </p>

        <nav
          aria-label="Footer"
          className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-9 lg:grid-cols-7 lg:gap-x-4"
        >
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
                {col.title}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    <Link href={href} className={linkClass}>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="mt-12 flex flex-col gap-5 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-white/45">
            © {year} Verify Trading Limited. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <ul className="flex items-center gap-4 text-[var(--vt-muted)]">
              {SOCIALS.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.href}
                    target={s.href === "#" ? undefined : "_blank"}
                    rel="noopener noreferrer"
                    aria-label={`${getAppName()} on ${s.label}`}
                    className="block transition hover:text-white"
                  >
                    {s.icon}
                  </a>
                </li>
              ))}
            </ul>
            <span className="hidden h-5 w-px bg-white/15 sm:block" aria-hidden />
            <p className="flex items-center gap-2 text-xs text-white/45">
              <Link href={PRIVACY_LINK.href} className="transition hover:text-white">
                Privacy Policy
              </Link>
              <span className="text-[var(--vt-coral)]" aria-hidden>
                •
              </span>
              <Link href={TERMS_LINK.href} className="transition hover:text-white">
                Terms of Service
              </Link>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
