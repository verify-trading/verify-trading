import { after } from "next/server";

import type { AskCard, AskUiMeta, BrokerCard, GuruCard } from "@/lib/ask/contracts";
import { findEntityCandidates, lookupVerifiedEntity, type EntityCandidate, type LookupVerifiedEntityResult } from "@/lib/ask/entities";
import { getFcaStatus } from "@/lib/ask/fca";
import type { AskServiceDependencies } from "@/lib/ask/service/types";
import { cardStatus, DATABASE_ONLY, countryName, statusColor } from "@/lib/compare/bts";
import { getBtsAskContext, getBtsAskContextByBrand, getRequestCountrySafe, type BtsAskContext } from "@/lib/compare/bts-data";
import { getL2Assessment, isDisputed, type L2Result, type L2Subject } from "@/lib/compare/bts-l2";
import { btsVerificationGate } from "@/lib/compare/bts-research";
import { regulationLabel } from "@/lib/compare/regulators";

/** The verify_entity tool: looks a firm or person up, runs the live check and builds the card. */
function buildBrokerCard(
  lookup: LookupVerifiedEntityResult,
  fcaStatus: Awaited<ReturnType<typeof getFcaStatus>>,
): BrokerCard | null {
  const hint = lookup.brokerCardHint;
  const entity = lookup.entity;
  if (!hint || !entity) {
    return null;
  }

  let status = hint.status;
  let fca = hint.fca;

  // For a firm we already class as avoid, a live FCA name-search usually hits a
  // same-name or clone entity, so don't let it upgrade FCA standing or surface
  // its note.
  const dbDistrusted = entity.status === "avoid" || entity.band === "Avoid";

  if (fcaStatus.authorised === false) {
    fca = "No";
    if (status === "LEGITIMATE") {
      status = "WARNING";
    }
  } else if (fcaStatus.authorised === true && !dbDistrusted) {
    fca = "Yes";
  }

  if (fcaStatus.warning === true) {
    status = "WARNING";
  }

  // Founder note wins, then the live FCA text, then our reviewed note.
  const fcaText = dbDistrusted ? null : fcaStatus.note ?? fcaStatus.statusText;
  const fallbackVerdict =
    status === "LEGITIMATE"
      ? "Our reviewed record lists this broker as legitimate. Check the regulator register before depositing."
      : status === "WARNING"
        ? "Our reviewed record flags this broker for caution. Check the regulator register before depositing."
        : "Our reviewed record flags this broker to avoid.";
  const verdict = hint.founderNote || fcaText || entity.notes || fallbackVerdict;

  return {
    type: "broker",
    name: hint.name,
    score: hint.score,
    status,
    fca,
    complaints: hint.complaints,
    verdict,
    color: hint.color,
  };
}

function buildPropFirmCard(lookup: LookupVerifiedEntityResult): BrokerCard | null {
  const hint = lookup.propFirmCardHint;
  const entity = lookup.entity;
  if (!hint || !entity) {
    return null;
  }

  // This card is type "broker", so the pipeline always re-synthesizes the verdict
  // from the structured facts (score, band, Trustpilot — all in propFirmUiMeta).
  // So we pass curated text or a terse fact, never hand-written prose; the model
  // writes the natural line and keeps the numbers.
  const verdict = hint.closed
    ? hint.founderNote || entity.notes || "Closed down — avoid depositing."
    : hint.notRated
      ? "Not enough public data to rate yet."
      : hint.founderNote || entity.notes || "Reviewed prop firm.";

  return {
    type: "broker",
    name: hint.name,
    score: hint.score,
    status: hint.status,
    fca: "No",
    complaints: hint.complaints,
    verdict,
    color: hint.color,
  };
}

function propFirmUiMeta(lookup: LookupVerifiedEntityResult): AskUiMeta {
  const hint = lookup.propFirmCardHint;
  const trustpilot = hint?.trustpilot ?? null;
  const cardFacts = hint?.cardFacts ?? null;
  // One authoritative "developing" decision, computed here and threaded through
  // uiMeta, so the card, the badge label, and the score state can't disagree.
  const developing = Boolean(
    hint?.researchStatus || cardFacts?.confirmed.length || cardFacts?.unconfirmed.length,
  );
  return {
    verificationKind: "propfirm",
    // A developing record must never carry the reassuring "Reviewed record" badge;
    // the label is pure presentation derived from the developing flag.
    verificationSourceLabel: developing ? "Not yet scoreable" : "Reviewed record",
    // Optional fields left undefined are omitted on serialize.
    propFirm: {
      band: hint?.band ?? undefined,
      notRated: hint?.notRated ? true : undefined,
      developing: developing || undefined,
      trustpilotRating: trustpilot?.rating,
      trustpilotCount: trustpilot?.count ?? undefined,
      trustpilotDate: trustpilot?.date ?? undefined,
      researchStatus: hint?.researchStatus ?? undefined,
      confirmedFacts: cardFacts?.confirmed.map((fact) => ({
        text: fact.text,
        sourceLabel: fact.sourceLabel ?? undefined,
        sourceUrl: fact.sourceUrl ?? undefined,
      })),
      unconfirmedClaims: cardFacts?.unconfirmed,
      reverifyTrigger: cardFacts?.footer ?? undefined,
    },
  };
}

function buildGuruCard(lookup: LookupVerifiedEntityResult): GuruCard | null {
  const hint = lookup.guruCardHint;
  const entity = lookup.entity;
  if (!hint || !entity) {
    return null;
  }

  // bio_summary is the public-facing body, gated on research completeness and a
  // confirmed identity (no longer on a separate founder-review flag). Internal
  // founder notes are never loaded into the entity, so they cannot reach the card.
  return {
    type: "guru",
    name: hint.name,
    tier: hint.tier,
    trackRecord: hint.trackRecord,
    citationUrl: hint.tier === "Caution" ? hint.citationUrl : null,
    verdict: entity.bioSummary || entity.notes || "No documented regulatory action found.",
  };
}

function extractHostnameLabel(hostname: string) {
  const labels = hostname.toLowerCase().split(".").flatMap((label) => {
    const trimmed = label.trim();
    return trimmed ? [trimmed] : [];
  });

  if (labels.length === 0) {
    return null;
  }

  const filtered = labels.filter((label) => !["www", "m", "app"].includes(label));
  if (filtered.length === 0) {
    return null;
  }

  if (
    filtered.length >= 3 &&
    filtered.at(-1)?.length === 2 &&
    ["co", "com", "org", "net"].includes(filtered.at(-2) ?? "")
  ) {
    return filtered.at(-3) ?? null;
  }

  return filtered.length >= 2 ? (filtered.at(-2) ?? null) : filtered[0];
}

function humanizeEntityName(value: string) {
  const withSpaces = value
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([a-z])(?=(funded|markets|market|trading|capital|forex|funding|broker|group)\b)/gi, "$1 ")
    .trim();

  return withSpaces
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeVerificationName(name: string) {
  const trimmed = name.trim();
  const urlMatch = trimmed.match(/https?:\/\/[^\s]+|www\.[^\s]+/i);
  const asTyped = (fromUrl: boolean) => ({ lookupName: trimmed, displayName: trimmed, fromUrl });
  if (!urlMatch) return asTyped(false);

  try {
    const url = new URL(urlMatch[0].startsWith("http") ? urlMatch[0] : `https://${urlMatch[0]}`);
    const hostnameLabel = extractHostnameLabel(url.hostname);
    return hostnameLabel ? { lookupName: hostnameLabel, displayName: humanizeEntityName(hostnameLabel), fromUrl: true } : asTyped(true);
  } catch {
    return asTyped(true);
  }
}

export function withCard(card: AskCard, uiMeta?: AskUiMeta) {
  return uiMeta ? { card, uiMeta } : { card };
}

/** Any verification result can carry the BTS engine's evidence for the firm. */
type VerificationToolResponse = (
  | ReturnType<typeof withCard>
  | {
      fcaData: {
        queriedName: string;
        frn: string | null;
        statusText: string | null;
        authorised: boolean | null;
        warning: boolean | null;
        note: string | null;
        source: string;
      };
    }
  | { coverage: CoverageEvidence }
) & { bts?: CheckedBts };

/**
 * No confident record for the queried name. We hand the model the facts — the
 * closest LABELLED candidates and their standing — and it writes the reply
 * (ask for the exact name, or "did you mean X?"). It must never treat a
 * candidate as a confirmed verdict; that is enforced in the prompt.
 */
interface CoverageEvidence {
  queriedName: string;
  fromUrl: boolean;
  /** Closest brands on file, each a suggestion only — never the queried name. */
  candidates: Array<{
    name: string;
    /** "lookalike" = shares a distinctive word; "similar" = close spelling. */
    match: EntityCandidate["label"];
    type: string;
    /** Why it's notable, e.g. "regulator warning on file", "rated Avoid". */
    standing: string;
  }>;
}

function candidateStanding(candidate: EntityCandidate): string {
  if (candidate.entity.type === "guru") {
    if (candidate.entity.guruTier === "Caution") return "regulator warning on file";
    return "reviewed record on file";
  }
  // Brokers and prop firms: the verdict comes from the BTS engine via verify_entity, not old record fields.
  return "record on file; call verify_entity for its verdict";
}

async function coverageEvidence(
  queriedName: string,
  fromUrl: boolean,
): Promise<{ coverage: CoverageEvidence }> {
  const candidates = await findEntityCandidates(queriedName);
  return {
    coverage: {
      queriedName,
      fromUrl,
      candidates: candidates.map((candidate) => ({
        name: candidate.entity.name,
        match: candidate.label,
        type: candidate.entity.type,
        standing: candidateStanding(candidate),
      })),
    },
  };
}

/** How long Ask waits for a live check before answering from the database. The run keeps going and is cached. */
const L2_WAIT_MS = 120_000; // the mobile app gives up on Ask at 180s

/** Any ISO country the user named; the live check researches countries the engine has no rows for (e.g. Morocco). */
const isoCountry = (c?: string) => (c && /^[A-Za-z]{2}$/.test(c.trim()) ? c.trim().toUpperCase() : undefined);

/**
 * Layer 2 owns the displayed number when it succeeds; Layer 1 stays in the database for audit and is
 * removed from what the model sees, so the user never gets two competing scores. When the live check
 * is unavailable, the Layer 1 rating is shown and labelled as a database assessment.
 */
async function withLiveCheck(bts: BtsAskContext, getL2: typeof getL2Assessment = getL2Assessment, country?: string, waitMs = L2_WAIT_MS) {
  if (bts.type === "tool" || btsVerificationGate(bts.operatingStatus, bts.researchStatus) || bts.global.verdict === "Not active" || bts.global.verdict === "Under review") return bts;
  const l2 = await waitForLiveCheck({ firm: bts.firm, kind: bts.type, country: isoCountry(country) ?? bts.countryCode, entityId: bts.entityId, baseline: { score: bts.global.score, verdict: bts.global.verdict } }, getL2, waitMs);
  // Same standing as the website: thin evidence keeps the baseline (pending); a disputed check shows no score.
  if (!l2 || (l2.status !== "published" && !isDisputed(l2))) return { ...bts, scoreSource: "Baseline · verification pending" };
  if (isDisputed(l2)) {
    const reason = "Our independent check found evidence that changes this rating, so it's being reviewed. No score is shown until that's done; check the regulator's register yourself before depositing.";
    return {
      ...bts,
      scoreSource: "Under review",
      shown: { ...bts.shown, verdict: "Under review" as const, score: null, note: null, global: true },
      global: { ...bts.global, verdict: "Under review" as const, score: null, reason, capApplied: null, evidenceConfidence: null, pillars: {} },
      country: null,
    };
  }
  const live = fromLiveCheck(l2);
  // Register-verified licences (e.g. FCA) stay from the research record; the live check scores, it doesn't re-list them.
  return { ...bts, ...live, global: { ...live.global, cloneAlert: bts.global.cloneAlert, licencesVerified: bts.global.licencesVerified } };
}

async function waitForLiveCheck(subject: L2Subject, getL2: typeof getL2Assessment = getL2Assessment, waitMs = L2_WAIT_MS) {
  const run = getL2(subject).catch(() => null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([run, new Promise<null>((resolve) => { timer = setTimeout(resolve, waitMs, null); })]);
    if (!result) {
      try { after(run); } catch { /* Tests and scripts have no request lifetime. */ }
    }
    return result;
  } finally {
    clearTimeout(timer);
  }
}

function fromLiveCheck(l2: L2Result) {
  const conduct = l2.pillars.find((p) => p.key === "conduct");
  const summary = l2.summary.trim();
  const risks = l2.risks.filter((risk) => !summary.toLowerCase().includes(risk.toLowerCase())).slice(0, 2);
  // The card leads with the short plain answer; the full summary and evidence sit underneath it.
  const note = l2.answer || (summary.length < 180 && risks.length ? `${summary} ${risks.join(" ")}` : summary);
  return {
    scoreSource: l2.country === "XX" ? "Official score" : `Official score · ${countryName(l2.country)}`,
    conductRecord: l2.findings.some((f) => f.adverse) ? ("On record" as const) : conduct?.sourced ? ("None found" as const) : ("Not checked" as const),
    shown: { country: "", verdict: l2.verdict, score: l2.finalScore, note, global: false },
    global: {
      verdict: l2.verdict,
      score: l2.finalScore,
      reason: null,
      capApplied: null,
      evidenceConfidence: l2.confidence,
      pillars: Object.fromEntries(l2.pillars.map((p) => [p.label, `${p.awarded} / ${p.max}${p.sourced ? "" : " (no source found)"}: ${p.reason}`])),
      licencesVerified: "",
      cloneAlert: null,
      lastChecked: l2.checkedAt.slice(0, 10),
    },
    country: null,
    liveCheck: {
      checkedAt: l2.checkedAt,
      confidence: l2.confidence,
      countryFit: l2.countryFit,
      legalEntity: l2.identity.legal_entity,
      officialWebsite: l2.identity.official_website,
      findings: l2.findings.map(({ source_id: _id, ...f }) => f),
      summary,
      regulators: l2.regulators,
      // From the firm's own pages: what a shortlist compares on (spreads, platforms, scalping).
      tradingConditions: l2.conditions,
      concern: l2.concern,
      recommendation: l2.recommendation,
      pillars: l2.pillars.map(({ label, awarded, max, reason }) => ({ label, awarded, max, reason })),
      strengths: l2.strengths,
      risks: l2.risks,
      sources: l2.sources.map(({ title, url, type }) => ({ title, url, type })),
    },
  };
}

type CheckedBts = Awaited<ReturnType<typeof withLiveCheck>>;

function verificationMeta(bts: CheckedBts): Pick<AskUiMeta, "verification" | "verificationSourceLabel" | "cloneNotice" | "regulation"> {
  const cloneNotice = bts.global.cloneAlert ? { message: bts.global.cloneAlert, ...(bts.research?.cloneNoticeSource ? { sourceUrl: bts.research.cloneNoticeSource } : {}) } : undefined;
  const regulation = regulationLabel(bts.global.licencesVerified, bts.countryCode, "liveCheck" in bts ? bts.liveCheck.regulators : []) ?? undefined;
  if (!("liveCheck" in bts)) return { cloneNotice, regulation, verificationSourceLabel: "scoreSource" in bts ? bts.scoreSource : "Reviewed record" };
  const live = bts.liveCheck;
  return {
    cloneNotice,
    regulation,
    verificationSourceLabel: bts.scoreSource,
    verification: {
      verdict: bts.shown.verdict,
      confidence: live.confidence,
      checkedAt: live.checkedAt,
      score: bts.shown.score,
      summary: live.summary,
      concern: live.concern || undefined,
      recommendation: live.recommendation || undefined,
      pillars: live.pillars,
      sources: live.sources.map(({ title, url }) => ({ title, url })),
      findings: live.findings.map((f) => ({ authority: f.authority, legalEntity: f.legal_entity, jurisdiction: f.jurisdiction, date: f.date, finding: f.finding, outcome: f.outcome, url: f.url })),
    },
  };
}


/** First sentence of a baseline (Layer 1) answer, in the same plain voice as the live check. */
function baselineOpener(verdict: string, firm: string, country: string | null): string {
  const where = country ? ` in ${country}` : "";
  if (verdict === "Verified" || verdict === "Record reviewed") return `Our preliminary record suggests ${firm}${where} is sound, as long as you confirm which company holds your account.`;
  if (verdict === "Caution") return `Our preliminary record suggests being careful with ${firm}${where}.`;
  if (verdict === "High risk") return `Our preliminary record suggests avoiding ${firm}${where}.`;
  if (verdict === "Insufficient data") return `There isn't enough verified evidence to rate ${firm}${where} yet.`;
  return `${verdict}${where}.`;
}

/** A disputed live check shows no score until a person decides (amber: not a negative finding). */
function disputedBrokerFields(firm: string): Pick<BrokerCard, "score" | "status" | "color" | "complaints" | "verdict"> {
  return {
    score: "No score",
    status: "CAUTION",
    color: "amber",
    complaints: "Not checked",
    verdict: `Our latest check found new evidence about ${firm} that changes its rating, so we're reviewing it before publishing a score. Until then, check the regulator's register yourself before depositing.`,
  };
}

/**
 * The card shows the final verdict and score verbatim: the live check's when it ran, else the
 * engine's for the user's country. Live FCA data and old record fields never change it.
 */
function applyBtsToCard(card: BrokerCard, bts: CheckedBts): BrokerCard {
  const gate = btsVerificationGate(bts.operatingStatus, bts.researchStatus);
  if (!gate && "scoreSource" in bts && bts.scoreSource === "Under review") {
    return { ...card, ...disputedBrokerFields(bts.firm) };
  }
  if (gate || bts.global.verdict === "Under review") {
    return { ...card, score: "No score", status: "WARNING", color: "red", complaints: "Not checked", verdict: gate === "inactive" ? `${bts.firm} is recorded as inactive, redirected or merged. This record does not confirm an active service.` : gate === "unknown" ? `We haven't confirmed whether ${bts.firm} is operating.` : "We're still verifying this firm." };
  }
  const { verdict, score, note } = bts.shown;
  const status = cardStatus(verdict);
  const live = "liveCheck" in bts && bts.liveCheck ? bts.liveCheck : null;
  const reason = bts.global.reason ? `${bts.global.reason.charAt(0).toUpperCase()}${bts.global.reason.slice(1)}.` : "";
  const sameAsReason = note && bts.global.reason && note.toLowerCase().includes(bts.global.reason.toLowerCase());
  return {
    ...card,
    score: score === null ? "No score" : `${score}/100`,
    status,
    // FCA standing from register-verified licences (engine), or the live check's local licence finding.
    fca: (live?.countryFit === "CONFIRMED_LOCALLY" && bts.countryCode === "GB") || /(^|\|)FCA:/.test(bts.global.licencesVerified) ? "Yes" : "No",
    complaints: bts.conductRecord,
    color: statusColor(status),
    // The live check's own summary reads naturally; the database answer says where it came from.
    verdict: live
      ? (note ?? "")
      // The card keeps 3 sentences, so the fallback drops the note to keep its "stored assessment" label.
      : [baselineOpener(verdict, bts.firm, bts.shown.global ? null : countryName(bts.countryCode)), reason && `Main reason: ${reason}`, "scoreSource" in bts ? DATABASE_ONLY : sameAsReason ? "" : (note ?? "")]
          .filter(Boolean)
          .join(" "),
  };
}

export async function resolveVerificationToolResult(
  name: string,
  dependencies: AskServiceDependencies,
  country?: string,
): Promise<VerificationToolResponse> {
  const lookupVerifiedEntityImpl =
    dependencies.lookupVerifiedEntityImpl ?? lookupVerifiedEntity;
  const getFcaStatusImpl = dependencies.getFcaStatusImpl ?? getFcaStatus;

  const normalized = normalizeVerificationName(name);
  const lookup = await lookupVerifiedEntityImpl(normalized.lookupName);
  if (lookup.entity && lookup.entity.type !== "guru" && !normalized.fromUrl) {
    const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
    const aliases = [lookup.entity.name, lookup.entity.id, ...(lookup.entity.aliases ?? [])];
    if (!aliases.some((alias) => key(alias) === key(normalized.lookupName))) return coverageEvidence(normalized.lookupName, false);
  }

  // No page on our site, but the engine may still have scored the firm (new brokers, tools).
  const engineByBrand = async () => {
    const bts = await (dependencies.getBtsAskContextByBrandImpl ?? getBtsAskContextByBrand)(normalized.lookupName, country);
    return bts ? withLiveCheck(bts, dependencies.getL2AssessmentImpl, country, dependencies.liveCheckWaitMs) : undefined;
  };

  // Brokers and prop firms: the BTS engine's verdict and score go on the card verbatim.
  const withEngine = async (result: ReturnType<typeof withCard>, slug: string) => {
    if (result.card.type !== "broker") return result;
    const engine = await (dependencies.getBtsAskContextImpl ?? getBtsAskContext)(slug, country);
    if (!engine) return (await checkWithoutBaseline(result.card.name, lookup.entity?.type === "propfirm" ? "propfirm" : "broker")) ?? result;
    if (normalized.fromUrl && engine.research?.website) {
      const host = (url: string) => new URL(url.startsWith("http") ? url : `https://${url}`).hostname.toLowerCase().replace(/^www\./, "");
      try {
        const supplied = name.match(/https?:\/\/[^\s]+|www\.[^\s]+/i)?.[0] ?? name;
        if (host(supplied) !== host(engine.research.website)) return coverageEvidence(name, true);
      } catch { return coverageEvidence(name, true); }
    }
    const bts = await withLiveCheck(engine, dependencies.getL2AssessmentImpl, country, dependencies.liveCheckWaitMs);
    return {
      ...result,
      card: applyBtsToCard(result.card, bts),
      bts,
      uiMeta: {
        ...result.uiMeta,
        ...verificationMeta(bts),
        // Old developing flags and trust bands must not hide or contradict the new final score.
        ...("liveCheck" in bts ? { propFirm: undefined } : {}),
      },
    };
  };

  const checkWithoutBaseline = async (firm: string, kind?: "broker" | "propfirm") => {
    const countryCode = isoCountry(country) ?? await getRequestCountrySafe();
    const l2 = await waitForLiveCheck({ firm, kind, country: countryCode }, dependencies.getL2AssessmentImpl, dependencies.liveCheckWaitMs);
    // Same standing rules as engine firms: thin evidence shows nothing new, a disputed check shows no score.
    if (!l2 || (l2.status !== "published" && !isDisputed(l2))) return null;
    if (isDisputed(l2)) {
      return withCard({ type: "broker", name: firm, fca: "No", ...disputedBrokerFields(firm) }, { verificationKind: l2.kind, verificationSourceLabel: "Under review" });
    }
    const bts: CheckedBts = {
      firm,
      entityId: `name:${firm.trim().toLowerCase()}`,
      type: l2.kind,
      operatingStatus: null,
      researchStatus: null,
      research: null,
      countryCode,
      userCountry: countryCode === "XX" ? "unknown" : `${countryName(countryCode)} (${countryCode})`,
      ...fromLiveCheck(l2),
    };
    const card = applyBtsToCard({ type: "broker", name: firm, score: "No score", status: "WARNING", fca: "No", complaints: "Not checked", verdict: "Score unavailable", color: "red" }, bts);
    return { ...withCard(card, { verificationKind: l2.kind, ...verificationMeta(bts) }), bts };
  };

  if (lookup.found && lookup.entity) {
    if (lookup.entity.type === "guru") {
      const card = buildGuruCard(lookup);
      if (card) return withCard(card);
    } else if (lookup.entity.type === "propfirm") {
      const card = buildPropFirmCard(lookup);
      if (card) return withEngine(withCard(card, propFirmUiMeta(lookup)), lookup.entity.id);
    } else {
      const fcaStatus = await getFcaStatusImpl({
        name: lookup.entity.name,
        frn: lookup.entity.fcaReference ?? undefined,
      });
      const card = buildBrokerCard(lookup, fcaStatus);
      if (card) {
        return withEngine(
          withCard(card, { verificationKind: "broker", verificationSourceLabel: fcaStatus.available ? "Live FCA confirmed" : "Reviewed record" }),
          lookup.entity.id,
        );
      }
    }
  } else if (!normalized.fromUrl) {
    // A plain name we don't hold — check the live FCA register before giving up.
    const bts = await engineByBrand();
    if (!bts) {
      const live = await checkWithoutBaseline(normalized.lookupName);
      if (live) return live;
    }
    const fcaStatus = await getFcaStatusImpl({ name: normalized.lookupName, frn: undefined });
    if (fcaStatus.available && fcaStatus.statusText) {
      return {
        bts,
        fcaData: {
          queriedName: fcaStatus.queriedName,
          frn: fcaStatus.frn,
          statusText: fcaStatus.statusText,
          authorised: fcaStatus.authorised,
          warning: fcaStatus.warning,
          note: fcaStatus.note,
          source: fcaStatus.source,
        },
      };
    }
    return {
      ...(await coverageEvidence(normalized.lookupName, false)),
      bts,
    };
  }

  if (normalized.fromUrl) {
    const live = await checkWithoutBaseline(name);
    if (live) return live;
  }

  // No confident record: hand the model the closest labelled candidates and let
  // it write the reply ("did you mean X?" or ask for the exact name).
  return {
    ...(await coverageEvidence(normalized.fromUrl ? normalized.displayName : normalized.lookupName, normalized.fromUrl)),
    bts: await engineByBrand(),
  };
}
