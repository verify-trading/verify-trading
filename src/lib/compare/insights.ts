import { getRegulator, REGULATORS, type Regulator } from "@/lib/compare/regulators";
import type { PublicEntity, Verdict } from "@/lib/compare/entities";

/** Best first. Used to order alternatives and to say which record rates higher. */
export const VERDICT_RANK: Record<Verdict, number> = {
  "Strongly Trusted": 0,
  Trusted: 1,
  "Proceed With Caution": 2,
  "High Risk": 3,
  Avoid: 4,
  "Not yet rated": 5,
};

/**
 * Thin-page rule. A record is indexable only when it has something beyond a name and a verdict:
 * brokers need a listed regulator, an FCA registration or an FCA warning, and a real (non-provisional) rating;
 * prop firms need a score. Everything else stays reachable (linked, canonical) but noindex.
 */
export function isIndexable(e: PublicEntity): boolean {
  if (e.verdict === "Not yet rated") return false;
  if (e.type === "propfirm") return e.score !== null;
  if (e.provisional) return false;
  return e.regulators.length > 0 || e.fcaRegistered || e.fcaWarning;
}

export const entityPath = (e: Pick<PublicEntity, "type" | "slug">) =>
  `${e.type === "broker" ? "/compare/brokers" : "/compare/prop-firms"}/${e.slug}`;

const hubSlugs = (e: PublicEntity) => e.regulatorDetails.flatMap((r) => (r.slug ? [r.slug] : []));

/** Same-type entities that share a regulator (brokers) and rate at least as well, best evidence first. */
export function pickAlternatives(entity: PublicEntity, all: PublicEntity[], limit = 4): PublicEntity[] {
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

export const VS_PER_REGULATOR = 6;
export const VS_CAP = 120;

/**
 * Bounded set of "X vs Y" pages worth indexing: for each regulator with a reference entry, the top-scoring
 * indexable brokers that hold it, paired with each other. Capped overall.
 */
export function vsPairs(brokers: PublicEntity[]): Array<[PublicEntity, PublicEntity]> {
  const seen = new Set<string>();
  const out: Array<[PublicEntity, PublicEntity]> = [];
  for (const hub of regulatorHubs(brokers)) {
    const top = hub.entities.filter((e) => isIndexable(e) && e.score !== null && !e.fcaWarning).slice(0, VS_PER_REGULATOR);
    for (let i = 0; i < top.length; i++) {
      for (let j = i + 1; j < top.length; j++) {
        const [a, b] = pairKey(top[i].slug, top[j].slug);
        const key = `${a}|${b}`;
        if (seen.has(key) || out.length >= VS_CAP) continue;
        seen.add(key);
        out.push(top[i].slug === a ? [top[i], top[j]] : [top[j], top[i]]);
      }
    }
  }
  return out;
}

export const isIndexedPair = (brokers: PublicEntity[], a: string, b: string) => {
  const [x, y] = pairKey(a, b);
  return vsPairs(brokers).some(([p, q]) => p.slug === x && q.slug === y);
};

/** Top-scoring comparison partners for an entity, taken from the indexed pair set. */
export function vsPartners(entity: PublicEntity, brokers: PublicEntity[], limit = 3): PublicEntity[] {
  return vsPairs(brokers)
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

  const where = e.regulatorDetails.map((r) => (r.country ? `${r.code} (${r.country})` : r.code));
  return [
    { q: `Is ${e.name} regulated?`, a: e.regulators.length ? `Our record lists ${e.name} as regulated by ${list(where)}. Confirm each licence on the regulator's own register, because a listing here is a pointer and not proof.` : `Our record lists no regulator for ${e.name}. That does not prove it is unlicensed, but we cannot point to a licence to check.` },
    { q: `Is ${e.name} FCA regulated?`, a: e.fcaWarning ? `The FCA has published a warning about ${e.name} in our record. Do not deposit before you read the warning on the FCA's own site.` : e.fcaRegistered ? `Yes, our record shows ${e.name} on the FCA register${e.fcaReference ? ` with reference ${e.fcaReference}` : ""}. Check the current status on register.fca.org.uk.` : `Our record does not show ${e.name} on the FCA register. Check register.fca.org.uk directly if you need to be sure.` },
    { q: `Where is ${e.name} regulated?`, a: where.length ? `${e.name} is listed with ${list(where)}.` : `Our record has no regulator location for ${e.name}.` },
    { q: `Is ${e.name} safe?`, a: `${verdictQ.a} Safety also depends on the entity you open an account with, so check the licence on the register before you deposit.` },
    updatedQ,
  ];
}
