import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, PlayCircle } from "lucide-react";

import { HeroAskDemo } from "@/components/landing/hero-ask-demo";
// Data comes from the server-safe module (a Server Component can't read values
// re-exported through a "use client" boundary).
import { HERO_ASK_VARIANTS } from "@/components/landing/hero-ask-demo/types";
import { AppWordmarkInline } from "@/components/site/logo";
import { Button } from "@/components/ui/button";
import { getAppName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Hero Ask Demo — design options",
  robots: { index: false, follow: false },
};

/** Faithful copy of the real hero's left column so each design is judged in context. */
function HeroCopy({ appName }: { appName: string }) {
  return (
    <div className="min-w-0 max-w-2xl text-left">
      <h1 className="text-[2.125rem] font-semibold leading-[1.05] tracking-normal text-white sm:text-4xl sm:leading-[1.06] lg:text-5xl">
        <span className="mb-3 block text-xl font-bold tracking-normal sm:mb-4 sm:text-2xl">
          <AppWordmarkInline />
        </span>
        <span className="block">One Check.</span>
        <span className="block text-[var(--vt-coral)]">Better Decisions.</span>
        <span className="block">Fewer Losses.</span>
        <span className="mt-4 block max-w-xl text-sm font-normal leading-6 text-slate-400 sm:text-[15px]">
          Verify traders, validate trades, and manage risk with live data &amp; AI
          - all in one place.
        </span>
      </h1>
      <div className="mt-7 flex w-full max-w-[13rem] flex-col items-stretch gap-3 sm:mt-8">
        <Button
          asChild
          variant="default"
          size="pill"
          className="min-w-48 justify-between bg-gradient-to-r from-[var(--vt-blue)] via-[#8b5cf6] to-[var(--vt-coral)] px-6 shadow-[0_18px_36px_-12px_rgba(242,109,109,0.7)] hover:brightness-110"
        >
          <Link href="/ask" prefetch={false}>
            Start Free Now
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="pill"
          className="justify-between border-white/15 bg-white/[0.02] px-6 text-white/90 hover:bg-white/[0.06]"
        >
          See How It Works
          <PlayCircle className="size-4" aria-hidden />
        </Button>
      </div>
      <ul className="mt-5 flex flex-col items-start gap-2 text-sm text-slate-500 sm:mt-6 sm:flex-row sm:flex-wrap sm:justify-start sm:gap-x-8 sm:gap-y-2">
        {["Stop bad trades in seconds", "Avoid any scams", "Control your risk"].map(
          (t) => (
            <li key={t} className="flex items-center gap-2">
              <CheckCircle2
                className="size-3.5 shrink-0 text-[var(--vt-green)]"
                aria-hidden
              />
              {t}
            </li>
          ),
        )}
      </ul>
      <p className="mt-6 text-xs text-slate-500" aria-label={appName}>
        Tap the input in the preview → opens the subscription CTA.
      </p>
    </div>
  );
}

export default function HeroPreviewPage() {
  const appName = getAppName();

  return (
    <main className="min-h-dvh bg-[var(--vt-navy)]">
      {/* Toolbar */}
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[rgba(10,13,46,0.85)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">Hero · Ask demo</p>
            <p className="text-xs text-white/50">
              4 designs — scroll to compare, then tell me which to ship.
            </p>
          </div>
          <nav className="flex flex-wrap gap-1.5">
            {HERO_ASK_VARIANTS.map((v, i) => (
              <a
                key={v.id}
                href={`#design-${v.id}`}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/70 transition hover:border-[rgba(76,110,245,0.35)] hover:bg-[rgba(76,110,245,0.08)] hover:text-white"
              >
                {i + 1}. {v.name}
              </a>
            ))}
          </nav>
        </div>
      </header>

      {HERO_ASK_VARIANTS.map((v, i) => (
        <section
          key={v.id}
          id={`design-${v.id}`}
          className="scroll-mt-20 border-b border-white/[0.06] bg-[radial-gradient(ellipse_90%_70%_at_100%_35%,rgba(76,110,245,0.1),transparent_52%),var(--vt-navy)] max-md:bg-[radial-gradient(ellipse_100%_60%_at_50%_0%,rgba(76,110,245,0.1),transparent_45%),var(--vt-navy)]"
        >
          <div className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">
              <span className="flex size-5 items-center justify-center rounded-full bg-[var(--vt-blue)] text-[11px] font-bold text-white">
                {i + 1}
              </span>
              <span className="text-sm font-semibold text-white">{v.name}</span>
              <span className="hidden text-xs text-white/45 sm:inline">
                — {v.tagline}
              </span>
            </div>
          </div>
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-4 py-10 sm:px-6 md:grid-cols-2 md:items-center md:gap-12 md:py-16 lg:gap-16">
            <HeroCopy appName={appName} />
            <div className="min-w-0">
              <HeroAskDemo variant={v.id} />
            </div>
          </div>
        </section>
      ))}

      <footer className="mx-auto max-w-6xl px-4 py-10 text-center text-xs text-white/40 sm:px-6">
        Each design is live and interactive · the loop pauses for reduced-motion
        users · CTA submits to <code className="text-white/60">/api/subscribe</code>.
      </footer>
    </main>
  );
}
