/** Historical research metadata. Linked sources are not represented as fresh verification. */
export type BtsResearch = {
  website: string | null;
  legalEntity: string | null;
  registeredCountry: string | null;
  servicingEntity: string | null;
  clientRegions: string | null;
  operatingStatus: string | null;
  researchStatus: string | null;
  researchDate: string | null;
  licences: Array<Record<string, unknown>>;
  sources: Array<{ url: string; roles: string[]; researchDate: string | null }>;
  actions: string | null;
  payoutTerms: string | null;
  tradingRules: string | null;
  disputes: string | null;
  auditIssues: string[];
};

const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function readBtsResearch(details: Record<string, unknown>): BtsResearch | null {
  const input = object(details.research_input);
  if (!Object.keys(input).length) return null;
  let licences: unknown = input.regulatory_licences_json ?? [];
  if (typeof licences === 'string') {
    try { licences = JSON.parse(licences); } catch { licences = []; }
  }
  const sources = Array.isArray(details.source_evidence) ? details.source_evidence.flatMap((value: unknown) => {
    const source = object(value);
    const url = text(source.url);
    if (!url || !/^https?:\/\//i.test(url)) return [];
    return [{ url, roles: Array.isArray(source.roles) ? source.roles.filter((role): role is string => typeof role === 'string') : [], researchDate: text(source.research_date) }];
  }) : [];
  const audit = object(details.research_audit);
  return {
    website: text(input.website_url), legalEntity: text(input.legal_entity), registeredCountry: text(input.registered_country),
    servicingEntity: text(input.retail_servicing_entity), clientRegions: text(input.retail_client_regions),
    operatingStatus: text(input.operating_status), researchStatus: text(input.research_status), researchDate: text(input.research_date),
    licences: Array.isArray(licences) ? licences.map(object) : [], sources,
    actions: text(input.verified_regulatory_actions ?? input.verified_official_actions),
    payoutTerms: text(input.payout_terms_summary), tradingRules: text(input.trading_rules_summary), disputes: text(input.documented_material_disputes),
    auditIssues: Array.isArray(audit.issues) ? audit.issues.filter((issue): issue is string => typeof issue === 'string') : [],
  };
}

export function btsVerificationGate(operatingStatus: string | null | undefined, researchStatus: string | null | undefined) {
  if (researchStatus === 'needs_review') return 'needs_review' as const;
  if (['inactive', 'redirected', 'merged', 'closed'].includes(operatingStatus ?? '')) return 'inactive' as const;
  if (operatingStatus === 'unknown') return 'unknown' as const;
  return null;
}

/** Collapse only name variants at the exact same website and legal identity. Products stay distinct. */
export function btsWebsiteIdentity(name: string, research: BtsResearch | null | undefined): string | null {
  if (!research?.website) return null;
  try {
    const url = new URL(research.website);
    let brand = name.toLowerCase().replace(/^the\s+/, '').replace(/\.com$/i, '').replace(/[^a-z0-9]/g, '');
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    // Both spellings occur in the supplied research at the same official website.
    if (host === 'uprofit.com' && brand === 'upprofit') brand = 'uprofit';
    const legal = (research.legalEntity ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${host}${url.pathname.replace(/\/$/, '')}|${brand}|${legal}`;
  } catch { return null; }
}
