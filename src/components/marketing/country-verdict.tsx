"use client";

import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";

import { ScoreBar, VerdictBadge } from "@/components/marketing/entity-ui";
import {
  BTS_COUNTRIES,
  COUNTRY_COOKIE,
  GEO_COOKIE,
  countryFlag,
  countryName,
  countryView,
  normalizeCountry,
  type BtsVerdict,
  type CountryFitRow,
} from "@/lib/compare/bts";

const readCookie = (name: string) => document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))?.[1] ?? null;
const CHANGED = "vt-country-change";

/** The visitor's country: saved choice, else the IP guess middleware stored, else XX. Null during SSR. */
function useVisitorCountry(): string | null {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener(CHANGED, onChange);
      return () => window.removeEventListener(CHANGED, onChange);
    },
    () => normalizeCountry(readCookie(COUNTRY_COOKIE) ?? readCookie(GEO_COOKIE)),
    () => null,
  );
}

const OPTIONS = [...BTS_COUNTRIES].sort((a, b) => countryName(a).localeCompare(countryName(b)));

/**
 * "Showing results for 🇬🇧 United Kingdom · Change". The choice is saved in a cookie and wins over the IP guess.
 * Server-rendered lists pass `refresh` so the server re-ranks for the new country.
 */
export function CountryPicker({ country, refresh = false }: { country: string; refresh?: boolean }) {
  const router = useRouter();
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
      <span>
        Showing results for <span aria-hidden>{countryFlag(country)}</span> <span className="font-medium text-slate-200">{countryName(country)}</span>
      </span>
      <span aria-hidden>·</span>
      <span className="relative inline-flex">
        <span aria-hidden className="font-medium text-[var(--vt-blue)] underline-offset-2 hover:underline">Change</span>
        <select
          aria-label="Change country"
          value={country}
          onChange={(ev) => {
            const next = ev.target.value;
            document.cookie = `${COUNTRY_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
            window.dispatchEvent(new Event(CHANGED));
            if (refresh) router.refresh();
          }}
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          <option value="XX">Global (country unknown)</option>
          {OPTIONS.map((c) => (
            <option key={c} value={c}>{countryName(c)}</option>
          ))}
        </select>
      </span>
    </p>
  );
}

/**
 * Broker hero badge. Server-rendered with the global rating (cached page, what search engines see),
 * then switched to the visitor's country view once mounted. Never computes a score: the numbers come
 * from the engine's country rows.
 */
export function CountryVerdict({ verdict, score, rows }: { verdict: BtsVerdict; score: number | null; rows: CountryFitRow[] }) {
  const country = useVisitorCountry();
  const view = countryView({ verdict, score }, rows.find((r) => r.country === country), country ?? "XX");
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-4">
        <VerdictBadge verdict={view.verdict} className="px-3 py-1 text-xs" />
        <ScoreBar entity={view} className="w-32" />
      </div>
      {view.note ? <p className="max-w-xs text-xs leading-relaxed text-slate-300">{view.note}</p> : null}
      <CountryPicker country={country ?? "XX"} />
    </div>
  );
}
