import { getRegulator, REGULATORS, type Regulator } from "@/lib/compare/regulators";
import type { PublicEntity, PublicEntityType, Verdict } from "@/lib/compare/entities";

/** Best first. Used to order alternatives and to say which record rates higher. */
export const VERDICT_RANK: Record<Verdict, number> = {
  "Strongly Trusted": 0,
  Trusted: 1,
  "Proceed With Caution": 2,
  "High Risk": 3,
  Avoid: 4,
  "Not yet rated": 5,
  // Guru tiers rank separately (used only within the guru register).
  Verified: 0,
  Unverified: 1,
  Caution: 2,
};

/**
 * Thin-page rule. A record is indexable only when it has something beyond a name and a verdict:
 * brokers need a listed regulator, an FCA registration or an FCA warning, and a real (non-provisional) rating;
 * prop firms need a score. Everything else stays reachable (linked, canonical) but noindex.
 */
export function isIndexable(e: PublicEntity): boolean {
  if (e.type === "guru") {
    // Only publishable guru rows reach the register, and the three tiers are each substantive
    // (Verified = confirmed track record; Unverified = neutral default; Caution = cited action).
    return true;
  }
  if (e.verdict === "Not yet rated") return false;
  if (e.type === "propfirm") return e.score !== null;
  if (e.provisional) return false;
  return e.regulators.length > 0 || e.fcaRegistered || e.fcaWarning;
}

/**
 * Sitemap and robots index tag.
 *
 * Every broker and prop firm gets a reachable, indexed detail page — even "Not yet rated"
 * records. Brand-name queries ("[firm] review", "is [firm] legit") have high intent and we are
 * often the only independent source, so an honest "here is what the record says, rated or not"
 * page is useful content, not thin. The "look before you deposit" promise also depends on every
 * name on the list resolving to a record rather than a dead end.
 */
export function isSeoWorthy(_e: PublicEntity): boolean {
  return true;
}

/**
 * SEO PAGE GATE, not a visibility filter. Records that pass isSeoWorthy get a detail page;
 * the rest 404 and are dropped from regulator hubs and alternatives.
 *
 * Never use this to filter the Compare directory (/verify/brokers, /verify/prop-firms): that
 * lists every record in Supabase and only links these. Filtering it here once made the directory
 * fall from 777 brokers to 20; tests/components/site/compare-view.test.tsx guards against it.
 */
export const listableEntities = (entities: PublicEntity[]): PublicEntity[] => entities.filter(isSeoWorthy);

export const entityPath = (e: Pick<PublicEntity, "type" | "slug">) => {
  const base = e.type === "broker" ? "/verify/brokers" : e.type === "guru" ? "/verify/traders" : "/verify/prop-firms";
  return `${base}/${e.slug}`;
};

const hubSlugs = (e: PublicEntity) => e.regulatorDetails.flatMap((r) => (r.slug ? [r.slug] : []));

/** Same-type entities that share a regulator (brokers) and rate at least as well, best evidence first. */
export function pickAlternatives(entity: PublicEntity, all: PublicEntity[], limit = 4): PublicEntity[] {
  // Gurus are people; "alternatives" is a shopping metaphor that does not fit — no cross-recommendations.
  if (entity.type === "guru") return [];
  const mine = new Set(hubSlugs(entity));
  const floor = entity.score ?? -1;
  return all
    .filter((o) => o.slug !== entity.slug && o.type === entity.type && isIndexable(o) && !o.closed && !o.fcaWarning && o.score !== null && o.score >= floor)
    .map((o) => ({ o, shared: hubSlugs(o).filter((s) => mine.has(s)).length }))
    .filter(({ shared }) => entity.type === "propfirm" || shared > 0 || mine.size === 0)
    .sort((a, b) => b.shared - a.shared || (b.o.score ?? 0) - (a.o.score ?? 0) || a.o.name.localeCompare(b.o.name))
    .slice(0, limit)
    .map(({ o }) => o);
}

export type HubStats = { regulator: Regulator; entities: PublicEntity[]; verdicts: Partial<Record<Verdict, number>> };

/** Brokers listing each reference regulator, best score first. */
export function regulatorHubs(brokers: PublicEntity[]): HubStats[] {
  return REGULATORS.map((regulator) => {
    const entities = brokers
      .filter((b) => b.regulatorDetails.some((r) => r.slug === regulator.slug))
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.name.localeCompare(b.name));
    const verdicts: HubStats["verdicts"] = {};
    for (const e of entities) verdicts[e.verdict] = (verdicts[e.verdict] ?? 0) + 1;
    return { regulator, entities, verdicts };
  });
}

/** A hub is worth indexing only with enough listed firms to be a useful page. */
export const MIN_HUB_ENTITIES = 3;
export const hubIndexable = (h: HubStats) => h.entities.length >= MIN_HUB_ENTITIES;

export const hubFor = (brokers: PublicEntity[], slug: string): HubStats | null => {
  const regulator = getRegulator(slug);
  return regulator ? (regulatorHubs(brokers).find((h) => h.regulator.slug === slug) ?? null) : null;
};

/** Canonical order of a pair: alphabetical by slug. */
export const pairKey = (a: string, b: string) => (a < b ? [a, b] : [b, a]) as [string, string];

/** The one place the "X vs Y" URL shape lives: /compare/<type>/<a>-vs-<b>, slugs sorted. */
export const vsBasePath = (type: PublicEntityType) => (type === "propfirm" ? "/compare/prop-firms" : "/compare/brokers");
export const vsPath = (type: PublicEntityType, aSlug: string, bSlug: string) => {
  const [x, y] = pairKey(aSlug, bSlug);
  return `${vsBasePath(type)}/${x}-vs-${y}`;
};

/** Split a "<a>-vs-<b>" segment into its two slugs (first "-vs-" wins). Null when malformed or self-pair. */
export function parseVsPair(segment: string): [string, string] | null {
  const i = segment.indexOf("-vs-");
  if (i <= 0) return null;
  const a = segment.slice(0, i);
  const b = segment.slice(i + "-vs-".length);
  if (!a || !b || a === b) return null;
  return [a, b];
}

export const VS_PER_REGULATOR = 6;
/** Overall cap on indexed broker vs pages. The rest of a real pairing still renders, but noindex. */
export const VS_CAP = 80;
/** Prop firms have no regulators, so the indexed set is the top-scoring firms paired with each other. */
export const PROP_VS_TOP = 12;
export const PROP_VS_CAP = 60;

/**
 * Bounded set of broker "X vs Y" pages worth indexing: for each regulator with a reference entry, the
 * top-scoring indexable brokers that hold it, paired with each other. Capped overall.
 */
export function vsPairs(brokers: PublicEntity[]): Array<[PublicEntity, PublicEntity]> {
  const seen = new Set<string>();
  const out: Array<[PublicEntity, PublicEntity]> = [];
  for (const hub of regulatorHubs(brokers)) {
    const top = hub.entities.filter((e) => isIndexable(e) && e.score !== null && !e.fcaWarning).slice(0, VS_PER_REGULATOR);
    for (let i = 0; i < top.length; i++) {
      for (let j = i + 1; j < top.length; j++) {
        if (out.length >= VS_CAP) return out;
        const [a, b] = pairKey(top[i].slug, top[j].slug);
        const key = `${a}|${b}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(top[i].slug === a ? [top[i], top[j]] : [top[j], top[i]]);
      }
    }
  }
  return out;
}

/** Prop-firm indexed pairs: the top firms by score, paired with each other. No regulator dimension. */
export function propVsPairs(propFirms: PublicEntity[]): Array<[PublicEntity, PublicEntity]> {
  const top = propFirms
    .filter((e) => isIndexable(e) && e.score !== null && !e.closed)
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.name.localeCompare(b.name))
    .slice(0, PROP_VS_TOP);
  const out: Array<[PublicEntity, PublicEntity]> = [];
  for (let i = 0; i < top.length; i++) {
    for (let j = i + 1; j < top.length; j++) {
      if (out.length >= PROP_VS_CAP) return out;
      const [a] = pairKey(top[i].slug, top[j].slug);
      out.push(top[i].slug === a ? [top[i], top[j]] : [top[j], top[i]]);
    }
  }
  return out;
}

/** The indexed pair set for a register type. Brokers pair by shared regulator; prop firms by score. */
export function pairsForType(type: PublicEntityType, entities: PublicEntity[]): Array<[PublicEntity, PublicEntity]> {
  return type === "propfirm" ? propVsPairs(entities) : vsPairs(entities);
}

export const isIndexedVsPair = (type: PublicEntityType, entities: PublicEntity[], a: string, b: string) => {
  const [x, y] = pairKey(a, b);
  return pairsForType(type, entities).some(([p, q]) => p.slug === x && q.slug === y);
};

/** Top comparison partners for an entity, taken from its type's indexed pair set. */
export function vsPartners(entity: PublicEntity, entities: PublicEntity[], limit = 3): PublicEntity[] {
  return pairsForType(entity.type, entities)
    .filter(([a, b]) => a.slug === entity.slug || b.slug === entity.slug)
    .map(([a, b]) => (a.slug === entity.slug ? b : a))
    .slice(0, limit);
}

/* ─── FAQ (every answer is derived from the record) ─── */

const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
const fmt = (iso: string | null) => (iso && Number.isFinite(Date.parse(iso)) ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : null);

export function entityFaqs(e: PublicEntity): Array<{ q: string; a: string }> {
  const updated = fmt(e.updatedAt);
  const updatedQ = { q: `When was the ${e.name} record last updated?`, a: updated ? `The ${e.name} record was last updated on ${updated}. Records are refreshed as new regulator information is checked.` : `We do not have a recorded update date for ${e.name}.` };
  const verdictQ = {
    q: `What is the verdict for ${e.name}?`,
    a: `Our record gives ${e.name} a verdict of "${e.verdict}"${e.score !== null ? ` with a score of ${e.score.toFixed(1)} out of 10` : ""}. The verdict is computed from the regulator information we hold and is not a guarantee about the future.`,
  };

  if (e.type === "propfirm") {
    return [
      { q: `Is ${e.name} legit?`, a: e.closed ? `Our record marks ${e.name} as closed, so it is rated "${e.verdict}". Check the firm's own site and public sources before acting.` : `Our record rates ${e.name} "${e.verdict}"${e.score !== null ? ` (${e.score.toFixed(1)} / 10)` : ""}. A rating is not a guarantee: read the firm's rules and payout terms before you buy an evaluation.` },
      verdictQ,
      { q: `Is ${e.name} regulated?`, a: e.regulators.length ? `Our record lists these regulators for ${e.name}: ${list(e.regulators)}.` : `Our record lists no regulator for ${e.name}. Many prop firms sell evaluations on simulated accounts and are not regulated brokers, so the firm's own terms matter more.` },
      ...(e.yearFounded ? [{ q: `When was ${e.name} founded?`, a: `Our record gives ${e.yearFounded} as the founding year of ${e.name}.` }] : []),
      updatedQ,
    ];
  }

  if (e.type === "guru") {
    const tierExplainer: Record<string, string> = {
      Verified: `We have confirmed a public track record for ${e.name}. Verified is not an endorsement of any strategy — it means the evidence we hold is defensible, not that any trade or signal is a good idea.`,
      Unverified: `Unverified is the neutral default when we hold a record but have not confirmed a public track record. It is not an accusation, and it does not mean a person is a scammer.`,
      Caution: `A Caution is only issued when a documented regulator or court action backs it, with the source cited. ${e.citationUrl ? `See the source on our record.` : ""}`.trim(),
    };
    return [
      { q: `Is ${e.name} legit?`, a: `Our record rates ${e.name} "${e.verdict}". ${tierExplainer[e.verdict] ?? ""} Read the methodology for how a Caution has to be cited to be published.`.trim() },
      { q: `What does the ${e.verdict} verdict mean?`, a: tierExplainer[e.verdict] ?? `Our record gives ${e.name} a verdict of "${e.verdict}".` },
      { q: `Do you score ${e.name} out of 10?`, a: `No. We never put a numeric score on a person. A number implies a precision we cannot defend about an individual's conduct or results. Only brokers and prop firms carry a 10-point score.` },
      { q: `Has ${e.name}'s identity been checked?`, a: e.reviewed ? `Yes — our record is only listed once a person's public identity has been confirmed. Everything else published about ${e.name} is derived from public sources.` : `Our record for ${e.name} is listed once identity has been confirmed and research is complete; otherwise the row is held back from the register.` },
      updatedQ,
    ];
  }

  const where = e.regulatorDetails.map((r) => (r.country ? `${r.code} (${r.country})` : r.code));
  return [
    { q: `Is ${e.name} regulated?`, a: e.regulators.length ? `Our record lists ${e.name} as regulated by ${list(where)}. Confirm each licence on the regulator's own register, because a listing here is a pointer and not proof.` : `Our record lists no regulator for ${e.name}. That does not prove it is unlicensed, but we cannot point to a licence to check.` },
    { q: `Is ${e.name} FCA regulated?`, a: e.fcaWarning ? `The FCA has published a warning about ${e.name} in our record. Do not deposit before you read the warning on the FCA's own site.` : e.fcaRegistered ? `Yes, our record shows ${e.name} on the FCA register${e.fcaReference ? ` with reference ${e.fcaReference}` : ""}. Check the current status on register.fca.org.uk.` : `Our record does not show ${e.name} on the FCA register. Check register.fca.org.uk directly if you need to be sure.` },
    { q: `Where is ${e.name} regulated?`, a: where.length ? `${e.name} is listed with ${list(where)}.` : `Our record has no regulator location for ${e.name}.` },
    { q: `Is ${e.name} safe?`, a: `${verdictQ.a} Safety also depends on the entity you open an account with, so check the licence on the register before you deposit.` },
    updatedQ,
  ];
}
