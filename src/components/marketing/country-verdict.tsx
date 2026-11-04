"use client";

import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";

import { formatRecordDate, ScoreBar, VerdictBadge } from "@/components/marketing/entity-ui";
import type { OfficialScore } from "@/lib/compare/bts-l2";
import type { Verdict } from "@/lib/compare/entities";
import {
  BTS_COUNTRIES,
  COUNTRY_COOKIE,
  GEO_COOKIE,
  countryFlag,
  countryName,
  normalizeCountry,
} from "@/lib/compare/bts";

const readCookie = (name: string) => document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))?.[1] ?? null;
const CHANGED = "vt-country-change";

const subscribeCountryChange = (onChange: () => void) => {
  window.addEventListener(CHANGED, onChange);
  return () => window.removeEventListener(CHANGED, onChange);
};
const getVisitorCountry = () => normalizeCountry(readCookie(COUNTRY_COOKIE) ?? readCookie(GEO_COOKIE));

/** The visitor's country: saved choice, else the IP guess middleware stored, else XX. Null during SSR. */
function useVisitorCountry(): string | null {
  return useSyncExternalStore(subscribeCountryChange, getVisitorCountry, () => null);
}

const OPTIONS = [...BTS_COUNTRIES].sort((a, b) => countryName(a).localeCompare(countryName(b)));

/**
 * "Showing results for 🇬🇧 United Kingdom · Change". The choice is saved in a cookie and wins over the IP guess.
 * Server-rendered lists pass `refresh` so the server re-ranks for the new country.
 */
function CountryPicker({ country, refresh = false }: { country: string; refresh?: boolean }) {
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
 * Firm hero badge. Server-rendered with the global rating (cached page, what search engines see),
 * then switched to the visitor's official country score once mounted, when one is published.
 * Never computes a score: it shows the same official score Ask gives for that country.
 */
export function CountryVerdict({
  verdict,
  score,
  basis,
  checkedAt,
  countryScores,
}: {
  verdict: Verdict;
  score: number | null;
  basis: "official" | "baseline" | null;
  checkedAt: string | null;
  countryScores: Record<string, OfficialScore>;
}) {
  const country = useVisitorCountry();
  const local = country ? countryScores[country] : undefined;
  const countryLabel = countryName(country ?? "XX");
  const view = local ? { verdict: local.verdict, score: local.score } : { verdict, score };
  const line = local
    ? local.score === null
      ? `Under review for ${countryLabel}: new evidence is being checked`
      : `Official score for ${countryLabel} · checked ${formatRecordDate(local.checkedAt)}`
    : score === null && verdict === "Under review"
      ? "Under review: new evidence is being checked"
      : basis === "official"
      ? `Independently verified · checked ${formatRecordDate(checkedAt)}`
      : basis === "baseline"
        ? "Baseline score · independent verification pending"
        : null;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-4">
        <VerdictBadge verdict={view.verdict} className="px-3 py-1 text-xs" />
        <ScoreBar entity={view} className="w-32" />
      </div>
      {line ? <p className="border-t border-white/[0.06] pt-2.5 text-xs text-slate-400">{line}</p> : null}
      <CountryPicker country={country ?? "XX"} />
    </div>
  );
}
