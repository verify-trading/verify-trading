import type { Metadata } from "next";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Camera,
  CirclePlay,
  Globe2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact Verify Trading Limited for company, support, partnership, and product enquiries.",
};

const socialLinks = [
  {
    label: "YouTube",
    href: "https://youtube.com/@verify.trading?si=d16WLyMHFiSZ9rdA",
    icon: CirclePlay,
  },
  {
    label: "Telegram",
    href: "https://t.me/VerifyTradingBot?start=tg_Web_contact",
    icon: MessageCircle,
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/verifytrading.app?igsh=NHBkYmVnc2ViZmIw",
    icon: Camera,
  },
] as const;

type ContactDetail = {
  label: string;
  value: string;
  href?: string;
  icon: LucideIcon;
};

const details: ContactDetail[] = [
  {
    label: "Company",
    value: "Verify Trading Limited",
    icon: Building2,
  },
  {
    label: "Company number",
    value: "17245091",
    icon: Building2,
  },
  {
    label: "Address",
    value: "205 Regent Street, London W1B 4HB",
    icon: MapPin,
  },
  {
    label: "Phone",
    value: "TBC",
    icon: Phone,
  },
  {
    label: "Email",
    value: "ai@verify.trading",
    href: "mailto:ai@verify.trading",
    icon: Mail,
  },
  {
    label: "Website",
    value: "www.verify.trading",
    href: "https://www.verify.trading",
    icon: Globe2,
  },
] as const;

export default function ContactPage() {
  return (
    <main className="flex-1">
      <section className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-16">
        <div>
          <p className="text-xl font-black tracking-tight text-white">
            verify.trading
          </p>
          <h1 className="mt-5 text-5xl font-black tracking-tight text-white sm:text-6xl lg:text-7xl">
            Contact.
            <br />
            <span className="bg-gradient-to-r from-[var(--vt-blue)] via-indigo-400 to-[var(--vt-coral)] bg-clip-text text-transparent">
              Company Details.
            </span>
            <br />
            Clear Answers.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
            For company, support, partnership, or product enquiries, contact
            Verify Trading Limited using the details below.
          </p>

          <div className="mt-10 max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">
              Support & partnerships
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {socialLinks.map((item) => {
                const Icon = item.icon;

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-4 text-sm font-bold text-white/80 transition hover:-translate-y-0.5 hover:border-[var(--vt-blue)]/60 hover:bg-[var(--vt-blue)]/10 hover:text-white"
                  >
                    <Icon className="size-4" strokeWidth={2} aria-hidden />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        <aside className="self-start rounded-xl border border-white/10 bg-white/[0.025] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.24)]">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm font-semibold text-white/45">
              Registered details
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
              Verify Trading Limited
            </h2>
          </div>

          <dl className="mt-4 grid gap-3">
            {details.map((item) => {
              const Icon = item.icon;
              const value = item.href ? (
                <Link
                  href={item.href}
                  className="text-[var(--vt-blue)] transition hover:text-white"
                  target={item.href.startsWith("http") ? "_blank" : undefined}
                  rel={
                    item.href.startsWith("http")
                      ? "noopener noreferrer"
                      : undefined
                  }
                >
                  {item.value}
                </Link>
              ) : (
                item.value
              );

              return (
                <div
                  key={item.label}
                  className="rounded-lg border border-white/10 bg-white/[0.03] p-4"
                >
                  <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-white/40">
                    <Icon className="size-3.5" strokeWidth={2} aria-hidden />
                    {item.label}
                  </dt>
                  <dd className="mt-2 overflow-wrap-anywhere text-base font-bold leading-6 text-white">
                    {value}
                  </dd>
                </div>
              );
            })}
          </dl>
        </aside>
      </section>
    </main>
  );
}
