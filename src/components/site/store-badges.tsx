"use client";

import { trackAnalyticsEvent } from "@/lib/analytics/client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { STORE_URLS } from "@/lib/site-config";

function AppleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 384 512" className={className} fill="currentColor" aria-hidden>
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  );
}

function GooglePlayMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M3.609 1.814L13.792 12 3.609 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .61-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 0 1 0 1.73l-2.808 1.626L15.397 12l2.301-2.491zM5.864 2.658L16.802 8.99l-2.302 2.302-8.636-8.634z" />
    </svg>
  );
}

/** App-store download badges — link to the live store listings. */
export function StoreBadges({ location = "hero" }: { location?: string }) {
  const badges = [
    {
      icon: <AppleMark className="size-6" />,
      line1: "Download on the",
      line2: "App Store",
      store: "apple",
      href: STORE_URLS.apple,
    },
    {
      icon: <GooglePlayMark className="size-5" />,
      line1: "GET IT ON",
      line2: "Google Play",
      store: "google_play",
      href: STORE_URLS.googlePlay,
    },
  ];
  return (
    <div className="flex flex-row flex-wrap items-center justify-center gap-3">
      {badges.map((b) => (
        <a
          key={b.line2}
          href={b.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() =>
            trackAnalyticsEvent(ANALYTICS_EVENTS.appStoreClicked, {
              location,
              store: b.store,
            })
          }
          className="inline-flex items-center gap-2.5 rounded-xl border border-white/25 bg-black px-4 py-2.5 text-white transition hover:border-white/45 hover:bg-[#0c0c0c]"
        >
          {b.icon}
          <span className="text-left leading-tight">
            <span className="block text-[10px] font-medium text-white/70">{b.line1}</span>
            <span className="block text-[15px] font-semibold tracking-tight">{b.line2}</span>
          </span>
        </a>
      ))}
    </div>
  );
}
