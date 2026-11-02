"use client";

import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";

import { HeroAskDemoLazy } from "@/components/landing/hero-ask-demo/lazy";
import type { HeroLiveBriefing } from "@/components/landing/hero-ask-demo/types";
import { AppWordmarkInline } from "@/components/site/logo";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";
import { StoreBadges } from "@/components/site/store-badges";
import { getAppName } from "@/lib/site-config";

import { GuideNoteBottom, GuideNoteTop } from "./guide-notes";
import { TrackViewContent } from "./track-view-content";

/* ─── Hero ─── */

function Star() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5 fill-current sm:size-4" aria-hidden>
      <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.7 5.8 21l1.2-6.8-5-4.9 6.9-1z" />
    </svg>
  );
}

/** Social-proof row under the store badges: three stats split by hairline dividers.
 *  ponytail: static figures (1K+ per client; DB had 397 auth users Oct 2026. App Store GB 5.0 from 10 ratings), refresh by hand or wire to live counts if they need to stay current.
 *  Phones: three compact columns (visual over text). sm+: visual beside text. */
function SocialProof() {
  const item = "flex flex-col items-center gap-2 px-2 text-center sm:flex-row sm:gap-3 sm:px-6 sm:text-left";
  const value = "text-base font-semibold leading-tight text-white sm:text-lg";
  const label = "text-[11px] leading-tight text-[#9fb0e8] sm:text-xs";
  return (
    <div className="mt-8 grid w-full max-w-md grid-cols-3 divide-x divide-white/15 sm:flex sm:max-w-none sm:justify-center">
      <div className={item}>
        <div className="flex -space-x-2 sm:-space-x-2.5" aria-hidden>
          {[1, 2, 3, 4].map((n) => (
            // eslint-disable-next-line @next/next/no-img-element -- 32px static avatars
            <img key={n} src={`/avatars/user-${n}.webp`} alt="" width={32} height={32} className="size-6 rounded-full border-2 border-[#aab8e8]/70 object-cover sm:size-8" />
          ))}
        </div>
        <div>
          <p className={value}>1K+</p>
          <p className={label}>Traders Joined</p>
        </div>
      </div>
      <div className={item}>
        <span className="flex h-6 items-center text-white sm:h-auto" role="img" aria-label="Rated 5.0 out of 5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} />
          ))}
        </span>
        <div>
          <p className={value}>5.0</p>
          <p className={label}>App Store Rating</p>
        </div>
      </div>
      <div className={item}>
        <ShieldCheck className="size-6 shrink-0 text-[#aab8e8] sm:size-8" strokeWidth={1.5} aria-hidden />
        <div>
          <p className={value}>All-in-One</p>
          <p className={label}>Trading Intelligence</p>
        </div>
      </div>
    </div>
  );
}

function HeroSection({ liveGold }: { liveGold: HeroLiveBriefing | null }) {
  const appName = getAppName();

  return (
    <section className="overflow-hidden bg-[radial-gradient(ellipse_110%_55%_at_50%_0%,rgba(76,110,245,0.1),transparent_55%),var(--vt-navy)]">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 pb-16 pt-12 text-center sm:px-6 sm:pb-20 sm:pt-16">
        <h1
          className="text-[2.2rem] font-bold leading-[1.02] tracking-[-0.02em] text-white min-[400px]:text-[2.6rem] sm:text-[3.25rem] sm:leading-[1.01]"
          aria-label={`${appName}: One Check. Better Decisions. Fewer Losses.`}
        >
          <span className="mb-4 block text-xl font-bold tracking-normal sm:mb-5 sm:text-2xl">
            <AppWordmarkInline />
          </span>
          <span className="block">One Check.</span>
          <span className="block">
            <span className="bg-gradient-to-r from-[#a78bfa] via-[var(--vt-coral)] to-[#f472b6] bg-clip-text text-transparent">
              Better Decisions.
            </span>
          </span>
          <span className="block">Fewer Losses.</span>
        </h1>
        <div className="mt-8">
          <StoreBadges />
        </div>
        <SocialProof />

        {/* Phone demo with a soft gradient glow behind it */}
        <div className="relative mt-12 w-full sm:mt-14">
          {/* Wide soft glow blooming out behind the phone */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 z-0 size-[26rem] max-w-[150vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(76,110,245,0.45),rgba(139,92,246,0.22)_45%,transparent_70%)] blur-3xl"
          />
          <div className="relative z-10 mx-auto w-full max-w-[340px] sm:max-w-[392px]">
            <GuideNoteTop />
            {/* Colored aura that blooms out around the phone edges */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-3 inset-y-6 -z-10 rounded-[3.5rem] bg-gradient-to-b from-[rgba(76,110,245,0.6)] via-[rgba(139,92,246,0.45)] to-[rgba(242,109,109,0.28)] blur-2xl"
            />
            <HeroAskDemoLazy liveBriefing={liveGold} />
            <GuideNoteBottom />
          </div>
        </div>

      </div>
    </section>
  );
}

/* ─── Page ─── */

export function LandingPage({ liveGold, children }: { liveGold: HeroLiveBriefing | null; children?: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--vt-navy)] text-white">
      <SiteNav slim />
      <TrackViewContent />
      <main>
        <HeroSection liveGold={liveGold} />
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
