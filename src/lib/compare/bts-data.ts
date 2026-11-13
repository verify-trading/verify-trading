import { brokerMatchesInstruments } from "@/lib/ask/broker-discovery";
import { cookies, headers } from "next/headers";

import {
  COUNTRY_COOKIE,
  PILLARS,
  SCORELESS,
  countryName,
  countryView,
  gatedVerdict,
  normalizeCountry,
  pillarDisplay,
  toVerdict,
  type CountryFitRow,
  type CountryView,
} from "@/lib/compare/bts";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { btsVerificationGate, readBtsResearch } from "@/lib/compare/bts-research";
import { selectAll } from "@/lib/supabase/select-all";
import { hasMajorLicence } from "@/lib/compare/regulators";
import { getOfficialScores } from "@/lib/compare/bts-l2";
import { unstable_cache } from "next/cache";

const COLUMNS = "entity_id, country, country_fit, country_score, country_verdict, applicable_licences, country_note";

const toRow = (r: Record<string, unknown>): CountryFitRow => ({
  country: String(r.country),
  fit: (r.country_fit as string | null) ?? null,
  score: typeof r.country_score === "number" ? r.country_score : null,
  verdict: String(r.country_verdict),
  licences: (r.applicable_licences as string | null) ?? null,
  note: (r.country_note as string | null) ?? null,
});

async function countryRows(country: string): Promise<Array<CountryFitRow & { entityId: string }>> {
  const client = getSupabaseAdminClient();
  if (!client) return [];
  const data = await selectAll((from, to) =>
    client.from("bts_country_fit").select(COLUMNS).eq("country", country).order("entity_id").order("country").range(from, to),
  );
  return (data as Record<string, unknown>[]).map((r) => ({ ...toRow(r), entityId: String(r.entity_id) }));
}

/** The engine's table for one country, keyed by firm. Cached for a day: the register list reads it on every request. */
export const getCountryRows = unstable_cache(
  async (country: string): Promise<Record<string, CountryFitRow>> =>
    Object.fromEntries((await countryRows(country)).map(({ entityId, ...row }) => [entityId, row])),
  ["bts-country-rows-v1"],
  { revalidate: 86400, tags: ["bts"] },
);

/** One firm's rows for every country, keyed by country, for its record page. Notes and licences are left out to keep the page small. */
export const getFirmCountryRows = unstable_cache(
  async (entityId: string): Promise<Record<string, CountryFitRow>> => {
    const client = getSupabaseAdminClient();
    if (!client) return {};
    const { data } = await client.from("bts_country_fit").select("country, country_fit, country_score, country_verdict").eq("entity_id", entityId);
    return Object.fromEntries(((data ?? []) as Record<string, unknown>[]).map((r) => [String(r.country), toRow(r)]));
  },
  ["bts-firm-country-rows-v1"],
  { revalidate: 86400, tags: ["bts"] },
);

/** The visitor's country: their saved choice, else Vercel's IP guess, else XX. Only the 2-letter code is used. */
export async function getRequestCountry(): Promise<string> {
  const chosen = (await cookies()).get(COUNTRY_COOKIE)?.value;
  return normalizeCountry(chosen ?? (await headers()).get("x-vercel-ip-country"));
}

/** Request country, or XX outside a request (tests, scripts). */
export async function getRequestCountrySafe(): Promise<string> {
  try {
    return await getRequestCountry();
  } catch {
    return "XX";
  }
}

/**
 * What Ask is given for one firm: the engine's global row, the country row and the user's country.
 * Ask explains these; it never changes them or produces a different number.
 */
const ASK_COLUMNS = "entity_id, kind, brand_name, operating_status, research_status, global_score, verdict, verdict_reason, cap_applied, evidence_confidence, pillars, details, research_date";

export async function getBtsAskContext(slug: string, requestedCountry?: string | null) {
  const client = getSupabaseAdminClient();
  if (!client) return null;
  const { data } = await client.from("verified_entities").select(`bts:bts_scores(${ASK_COLUMNS})`).eq("slug", slug).maybeSingle();
  const raw = (data as { bts?: Record<string, unknown> | null } | null)?.bts;
  return raw ? buildAskContext(raw, requestedCountry) : null;
}

/**
 * Same context for a firm the engine scored but the site has no page for (new brokers, tools),
 * matched on the exact brand name ("Binance", or "HyperFunding (thehyperfunding.com)"). Never fuzzy:
 * a similar name must not borrow another firm's verdict.
 */
export async function getBtsAskContextByBrand(name: string, requestedCountry?: string | null) {
  const client = getSupabaseAdminClient();
  const clean = name.trim().replace(/[%_*\\,()"]/g, "");
  if (!client || clean.length < 2) return null;
  const { data } = await client.from("bts_scores").select(ASK_COLUMNS).or(`brand_name.ilike."${clean}",brand_name.ilike."${clean} (*"`).limit(2);
  // Two hits means the name is ambiguous: give no engine verdict rather than guess.
  return data?.length === 1 ? buildAskContext(data[0] as Record<string, unknown>, requestedCountry) : null;
}

/** Engine conduct pillar max per kind: regulatory conduct (brokers), dispute record (prop firms), incidents (tools). */
const CONDUCT_PILLAR = { broker: ["conduct", 25], propfirm: ["dispute_record", 20], tool: ["conduct_incidents", 30] } as const;

/**
 * The card's "Complaints" field, from the engine's conduct evidence only: full marks = "None found",
 * any points lost (or High risk) = "On record", unchecked or no score shown = "Not checked".
 */
function conductRecord(kind: keyof typeof CONDUCT_PILLAR, rating: { verdict: string; score: number | null }, pillars: Record<string, unknown>) {
  if (rating.verdict === "High risk") return "On record" as const;
  const [key, max] = CONDUCT_PILLAR[kind];
  const value = Number(pillars[key]);
  if (rating.score === null || !Number.isFinite(value)) return "Not checked" as const;
  return value >= max ? ("None found" as const) : ("On record" as const);
}

async function buildAskContext(raw: Record<string, unknown>, requestedCountry?: string | null) {
  const client = getSupabaseAdminClient()!;
  const kind = (raw.kind === "propfirm" ? "propfirm" : raw.kind === "tool" ? "tool" : "broker") as "broker" | "propfirm" | "tool";
  const gate = btsVerificationGate(raw.operating_status as string | null, raw.research_status as string | null);
  const verdict = gatedVerdict(gate, raw.verdict as string, kind);
  const globalRating = { verdict, score: gate || SCORELESS.has(verdict) ? null : ((raw.global_score as number | null) ?? null) };
  const details = (raw.details ?? {}) as Record<string, unknown>;
  const pillars = (raw.pillars ?? {}) as Record<string, unknown>;
  const research = readBtsResearch(details);
  const country = requestedCountry ? normalizeCountry(requestedCountry) : await getRequestCountrySafe();

  let countryRating: CountryView | null = null;
  if (!gate && kind === "broker" && country !== "XX") {
    const { data: row } = await client.from("bts_country_fit").select(COLUMNS).eq("entity_id", raw.entity_id as string).eq("country", country).maybeSingle();
    countryRating = countryView(globalRating, row ? toRow(row as Record<string, unknown>) : null, country);
  }

  return {
    firm: String(raw.brand_name ?? ""),
    entityId: String(raw.entity_id),
    operatingStatus: (raw.operating_status as string | null) ?? null,
    researchStatus: (raw.research_status as string | null) ?? null,
    research,
    countryCode: country,
    conductRecord: conductRecord(kind, globalRating, pillars),
    type: kind,
    userCountry: country === "XX" ? "unknown" : `${countryName(country)} (${country})`,
    shown: countryRating ?? { ...globalRating, note: null, global: true },
    global: {
      ...globalRating,
      reason: (raw.verdict_reason as string | null) ?? null,
      // Under review / Not active show no score, so Ask gets no cap or pillar points to quote either.
      capApplied: globalRating.score === null ? null : ((raw.cap_applied as string | null) ?? null),
      evidenceConfidence: globalRating.score === null ? null : ((raw.evidence_confidence as number | null) ?? null),
      pillars:
        globalRating.score === null
          ? {}
          : kind === "tool"
            ? Object.fromEntries(Object.entries(pillars).map(([k, v]) => [k.replace(/_/g, " "), /not checked/i.test(String(v)) ? "Not yet checked" : String(v)]))
            : Object.fromEntries(PILLARS[kind].map(([key, label, max]) => [label, pillarDisplay({ label, max, value: String(pillars[key] ?? "not checked") })])),
      licencesVerified: (details.active_verified_licences as string | undefined) ?? "none",
      cloneAlert: details.clone_alert === "yes" || research?.cloneNoticeSource ? "Scammers have impersonated this brand. This is not a warning about the firm itself." : null,
      lastChecked: (raw.research_date as string | null) ?? null,
    },
    country: countryRating,
  };
}

export type BtsAskContext = NonNullable<Awaited<ReturnType<typeof getBtsAskContext>>>;

/**
 * Ask's "best / top / safest" lists: engine verdicts ranked by the user's country score (brokers) or
 * global score (prop firms). Under review, Not active and Not available are left out. Only firms with
 * a page on the site are listed. Nothing commercial affects the order.
 */
export async function listBtsRanked(type: "broker" | "propfirm", limit = 8, requestedCountry?: string | null, instruments: string[] = []) {
  const client = getSupabaseAdminClient();
  if (!client) return { country: "unknown", firms: [] };
  const country = requestedCountry ? normalizeCountry(requestedCountry) : await getRequestCountrySafe();
  const data = await selectAll((from, to) =>
    client
      .from("verified_entities")
      .select("name, bts:bts_scores(entity_id, operating_status, research_status, global_score, verdict, verdict_reason, research_date, details)")
      .eq("entity_type", type)
      .not("bts_entity_id", "is", null)
      .order("slug")
      .range(from, to),
  );
  const rows = type === "broker" && country !== "XX" ? Object.fromEntries((await countryRows(country)).map(({ entityId, ...r }) => [entityId, r])) : {};
  // The official score (this country's, else the global one) wins over the engine baseline, as on the website.
  const official = await getOfficialScores().catch(() => ({} as Awaited<ReturnType<typeof getOfficialScores>>));
  // One entry per engine firm; duplicate site rows ("IG", "IG Group") keep the shortest name.
  const byFirm = new Map<string, { name: string; bts: Record<string, unknown> }>();
  for (const { name, bts } of data as unknown as Array<{ name: string; bts: Record<string, unknown> | null }>) {
    const prev = bts && byFirm.get(String(bts.entity_id));
    if (bts && (!prev || name.length < prev.name.length)) byFirm.set(String(bts.entity_id), { name, bts });
  }
  const ranked = [...byFirm.values()]
    .flatMap(({ name, bts }) => {
      if (btsVerificationGate(bts.operating_status as string | null, bts.research_status as string | null)) return [];
      const details = (bts.details ?? {}) as Record<string, unknown>;
      const brokerType = (details.research_input as Record<string, unknown> | undefined)?.broker_type as string | undefined;
      if (type === "broker" && instruments.length && !brokerMatchesInstruments(brokerType ?? null, instruments)) return [];
      const verdict = toVerdict(bts.verdict as string, type);
      const localOfficial = official[`${bts.entity_id}|${country}`];
      const o = localOfficial ?? official[`${bts.entity_id}|XX`];
      const view = o
        ? { country, verdict: o.verdict, score: o.score, note: null, global: !localOfficial }
        : countryView({ verdict, score: SCORELESS.has(verdict) ? null : (bts.global_score as number | null) }, rows[String(bts.entity_id)], country);
      const fit = rows[String(bts.entity_id)]?.fit;
      const licensedLocally = fit === "LOCAL LICENCE VERIFIED" || fit === "EEA PASSPORT POSSIBLE";
      const majorRegulator = hasMajorLicence(details.active_verified_licences as string | undefined);
      return view.score === null || SCORELESS.has(view.verdict)
        ? []
        : [{ name, majorRegulator, verdict: view.verdict, score: view.score, scoreBasis: o ? "official" : "baseline · verification pending", reason: (bts.verdict_reason as string | null) ?? null, licensedLocally, globalRatingShown: view.global, researchDate: bts.research_date, research: readBtsResearch(details), brokerType: brokerType ?? null }];
    })
    // Established firms (a major regulator's licence) first: outside the UK local licence data is still
    // incomplete, so local-only firms would otherwise crowd out the brokers traders actually use.
    // Then firms with an official (independently verified) score: the engine's baseline alone over-rates
    // many small firms (100 for unknown prop firms), so verified firms are what a shortlist should check first.
    // Then a verified local (or EU-passported) licence, then score.
    .sort((a, b) => Number(b.majorRegulator) - Number(a.majorRegulator) || Number(b.scoreBasis === "official") - Number(a.scoreBasis === "official") || Number(b.licensedLocally) - Number(a.licensedLocally) || b.score - a.score || a.name.localeCompare(b.name));
  // Keep a few places for the best locally licensed firms so local options still get considered.
  const max = Math.max(1, Math.min(limit, 15));
  const locals = ranked.filter((f) => !f.majorRegulator && f.licensedLocally).slice(0, 5);
  const firms = [...ranked.filter((f) => f.majorRegulator).slice(0, max - locals.length), ...locals];
  if (firms.length < max) firms.push(...ranked.filter((f) => !firms.includes(f)).slice(0, max - firms.length));
  return {
    country: country === "XX" ? "unknown (global ranking)" : `${countryName(country)} (${country})`,
    firms,
  };
}
