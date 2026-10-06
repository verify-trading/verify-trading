import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import { AppWordmarkInline } from "@/components/site/logo";
import { LEGAL_LINKS } from "@/lib/legal/legal-links";
import { NOT_ADVICE_STATEMENT } from "@/lib/marketing/copy";
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
      ["Ask Feature", "/ask"],
      ["Markets Feature", "/markets"],
      ["Intelligence Feature", "/intelligence"],
      ["Calendar Feature", "/economic-calendar"],
      ["Journal Feature", "/journal"],
      ["MIND Feature", "/mind"],
    ],
  },
  {
    title: "Compare",
    links: [
      ["Verify", "/verify"],
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
      ["Affiliates", "/affiliates"],
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

const ALL_SOCIALS: Array<{ label: string; href: string; icon: ReactNode }> = [
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
    label: "Facebook",
    href: SOCIAL_URLS.facebook,
    icon: (
      <svg {...svg} {...stroke}>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <path d="M15.5 8.5h-1.3c-1 0-1.7.7-1.7 1.7V21M10 13h5.5" />
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

/** Skip profiles still set to the `#` placeholder so no dead link renders. */
const SOCIALS = ALL_SOCIALS.filter((s) => s.href !== "#");

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-white/[0.07] bg-[rgba(10,13,46,0.92)]">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 pb-8 pt-12 sm:px-6 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.8fr)] lg:gap-12">
        {/* Brand column (Mobbin: Linear / Amplemarket footers). */}
        <div>
          <Link href="/" className="inline-block text-[1.75rem] font-bold tracking-tight text-white sm:text-3xl">
            <AppWordmarkInline />
          </Link>
          <p className="mt-2 text-sm text-[var(--vt-muted)]">
            Independent verification. Trusted intelligence.
          </p>

          <ul className="mt-5 flex items-center gap-2.5">
            {SOCIALS.map((s) => (
              <li key={s.label}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${getAppName()} on ${s.label}`}
                  className="flex size-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.03] text-[var(--vt-muted)] transition hover:border-[var(--vt-blue)]/60 hover:bg-[var(--vt-blue)]/10 hover:text-white"
                >
                  {s.icon}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <nav aria-label="Footer">
          {/* Mobile: collapsed accordion rows (native <details>). */}
          <div className="divide-y divide-white/10 border-y border-white/10 md:hidden">
            {FOOTER_COLUMNS.map((col) => (
              <details key={col.title} className="group">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-3 text-[15px] font-semibold text-white [&::-webkit-details-marker]:hidden">
                  {col.title}
                  <ChevronDown className="size-4 shrink-0 text-[var(--vt-muted)] transition-transform duration-200 group-open:rotate-180" aria-hidden />
                </summary>
                <ul className="space-y-3 pb-4">
                  {col.links.map(([label, href]) => (
                    <li key={label}>
                      <Link href={href} className={linkClass}>
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>

          {/* Desktop: all columns expanded. */}
          <div className="hidden gap-x-6 gap-y-10 md:grid md:grid-cols-4">
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
          </div>
        </nav>

        <div className="flex flex-col gap-4 md:border-t md:border-white/10 md:pt-6 lg:col-span-2">
          <p className="max-w-4xl text-xs leading-relaxed text-white/40">{NOT_ADVICE_STATEMENT}</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-white/45">
              © {year} Verify Trading Limited. All rights reserved.
            </p>
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
