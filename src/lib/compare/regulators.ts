/**
 * Static reference for the regulators that appear in `verified_entities.regulators_listed`.
 * Every line here is a general, checkable fact about the regulator or its regime, never a claim
 * about a specific firm. Keep statements hedged where a scheme depends on licence category.
 * A client should re-verify this file before launch and when rules change.
 *
 * Keyed by hub slug. `match` lists the "CODE|Country" pairs from the data that map to the hub,
 * because codes alone are ambiguous (FSC is Mauritius, BVI or Belize; FSA is Seychelles or Japan).
 */

export type Standing = "major" | "regional" | "offshore" | "registration";

export const STANDING_LABEL: Record<Standing, string> = {
  major: "Major onshore regulator",
  regional: "National or regional regulator",
  offshore: "Offshore licensing",
  registration: "Registration, not a trading licence",
};

export const STANDING_NOTE: Record<Standing, string> = {
  major: "Full conduct-of-business rules, client-money segregation and an enforcement record. A licence here carries the most weight for retail clients.",
  regional: "A recognised national or financial-centre regulator. Protections depend on the jurisdiction and the licence category, so read the terms.",
  offshore: "Licensing regimes often aimed at clients outside the jurisdiction. Usually no investor compensation scheme, lighter rules and a harder route to redress.",
  registration: "An anti-money-laundering registration. It shows the firm is on a list, not that it is licensed to deal in leveraged products.",
};

export type Regulator = {
  slug: string;
  code: string;
  /** "CODE|Country" pairs as they appear in `regulators_listed`. */
  match: string[];
  name: string;
  country: string;
  standing: Standing;
  summary: string;
  protections: string[];
  /** Register or official site. Null when we have no URL we are confident in. */
  registerUrl: string | null;
  registerLabel: string;
  /** What to search for on the register. */
  lookupHint: string;
};

const R = (r: Regulator): Regulator => r;

export const REGULATORS: Regulator[] = [
  R({
    slug: "fca", code: "FCA", match: ["FCA|United Kingdom"], name: "Financial Conduct Authority", country: "United Kingdom", standing: "major",
    summary: "The FCA authorises and supervises UK financial firms, including CFD and forex brokers, and publishes a public Financial Services Register and a warning list of unauthorised firms.",
    protections: [
      "Client money must be held separately from the firm's own funds under the FCA's client asset rules.",
      "The Financial Services Compensation Scheme (FSCS) can pay up to £85,000 per eligible person per authorised firm if the firm fails.",
      "Eligible complaints can go to the Financial Ombudsman Service at no cost to the client.",
      "FCA product rules cap retail leverage on CFDs (30:1 on major currency pairs) and require negative balance protection.",
    ],
    registerUrl: "https://register.fca.org.uk", registerLabel: "FCA Financial Services Register", lookupHint: "the firm's name or its Firm Reference Number (FRN)",
  }),
  R({
    slug: "cysec", code: "CySEC", match: ["CySEC|Cyprus"], name: "Cyprus Securities and Exchange Commission", country: "Cyprus", standing: "major",
    summary: "CySEC licenses Cyprus investment firms under the EU's MiFID II regime. Many international brokers hold a CySEC licence to serve clients across the European Economic Area.",
    protections: [
      "The Investor Compensation Fund covers eligible clients of a failed CIF up to €20,000 per person.",
      "Client funds must be segregated from the firm's own money.",
      "ESMA-aligned retail rules cap CFD leverage (30:1 on major currency pairs) and require negative balance protection.",
      "A CySEC licence can be passported to other EEA countries; the protections that apply follow the licensed entity, so check which entity you contract with.",
    ],
    registerUrl: "https://www.cysec.gov.cy/en-GB/entities/investment-firms/", registerLabel: "CySEC investment firms register", lookupHint: "the firm's name or licence number",
  }),
  R({
    slug: "asic", code: "ASIC", match: ["ASIC|Australia"], name: "Australian Securities and Investments Commission", country: "Australia", standing: "major",
    summary: "ASIC regulates Australian financial services. A broker needs an Australian Financial Services (AFS) licence to deal with Australian retail clients.",
    protections: [
      "Licensees must meet conduct, disclosure and dispute-resolution obligations, including membership of the Australian Financial Complaints Authority (AFCA).",
      "ASIC's product intervention order caps retail CFD leverage (30:1 on major currency pairs) and requires negative balance protection.",
      "There is generally no compensation scheme for CFD clients comparable to the UK's FSCS, so client-money arrangements matter.",
    ],
    registerUrl: "https://asic.gov.au/online-services/search-asics-registers/", registerLabel: "ASIC registers", lookupHint: "the firm's name or AFS licence number",
  }),
  R({
    slug: "fsca", code: "FSCA", match: ["FSCA|South Africa"], name: "Financial Sector Conduct Authority", country: "South Africa", standing: "regional",
    summary: "The FSCA licenses Financial Services Providers (FSPs) in South Africa. Each FSP has an FSP number and a list of licensed product categories.",
    protections: [
      "Licensed FSPs are bound by the Financial Advisory and Intermediary Services (FAIS) Act and its conduct rules.",
      "Clients can complain to the FAIS Ombud about licensed providers.",
      "What a licence covers depends on the licensed categories, so confirm on the register that leveraged products are included.",
    ],
    registerUrl: "https://www.fsca.co.za", registerLabel: "FSCA website (FSP search)", lookupHint: "the FSP name or FSP number",
  }),
  R({
    slug: "fsa-seychelles", code: "FSA", match: ["FSA|Seychelles", "FSA|Saint Vincent and the Grenadines"], name: "Financial Services Authority (Seychelles)", country: "Seychelles", standing: "offshore",
    summary: "The Seychelles FSA licenses securities dealers, many of which serve clients outside Seychelles. Note that another FSA, in Japan, is a separate regulator.",
    protections: [
      "Licensed dealers are subject to Seychelles securities law and FSA supervision.",
      "There is typically no investor compensation scheme for clients of a Seychelles-licensed dealer.",
      "Leverage and marketing are often less restricted than under UK or EU rules, and cross-border redress can be slow.",
    ],
    registerUrl: "https://fsaseychelles.sc", registerLabel: "Seychelles FSA website", lookupHint: "the firm's name or licence number",
  }),
  R({
    slug: "fsc-mauritius", code: "FSC", match: ["FSC|Mauritius"], name: "Financial Services Commission (Mauritius)", country: "Mauritius", standing: "offshore",
    summary: "The Mauritius FSC licenses non-bank financial services, including investment dealers. Many licensees are set up to serve clients outside Mauritius.",
    protections: [
      "Licensees are supervised under Mauritian financial services law.",
      "There is typically no investor compensation scheme comparable to the FSCS.",
      "Leverage and marketing rules are often lighter than under UK or EU rules.",
    ],
    registerUrl: "https://www.fscmauritius.org", registerLabel: "Mauritius FSC website", lookupHint: "the licensee's name or licence number",
  }),
  R({
    slug: "fsc-bvi", code: "FSC", match: ["FSC|The British Virgin Islands"], name: "Financial Services Commission (British Virgin Islands)", country: "British Virgin Islands", standing: "offshore",
    summary: "The BVI FSC regulates financial services companies registered in the British Virgin Islands, a common offshore base for brokers serving clients elsewhere.",
    protections: [
      "Licensees are supervised under BVI law.",
      "There is typically no investor compensation scheme for clients.",
      "Retail-client protections such as leverage caps are generally lighter than in the UK or EU.",
    ],
    registerUrl: "https://www.bvifsc.vg", registerLabel: "BVI FSC website", lookupHint: "the entity's name or licence number",
  }),
  R({
    slug: "vfsc", code: "VFSC", match: ["VFSC|Vanuatu"], name: "Vanuatu Financial Services Commission", country: "Vanuatu", standing: "offshore",
    summary: "The VFSC licenses dealers in securities in Vanuatu, a popular offshore base for retail forex brokers.",
    protections: [
      "Licensees are supervised under Vanuatu law.",
      "There is typically no investor compensation scheme for clients.",
      "Leverage is generally not capped as it is in the UK or EU, and enforcing rights across borders is difficult.",
    ],
    registerUrl: "https://www.vfsc.vu", registerLabel: "Vanuatu FSC website", lookupHint: "the licensee's name",
  }),
  R({
    slug: "misa-comoros", code: "MISA", match: ["MISA|Comoros", "AOFA|Comoros"], name: "Mwali International Services Authority", country: "Comoros", standing: "offshore",
    summary: "MISA, in the Autonomous Island of Mwali (Comoros), issues offshore licences. A Comoros licence is an offshore registration and is not comparable to a UK, EU or Australian licence.",
    protections: [
      "There is typically no investor compensation scheme.",
      "Licences of this kind are not equivalent to supervision by a major regulator, so treat them as low weight.",
      "Cross-border redress is limited.",
    ],
    registerUrl: null, registerLabel: "the regulator's official site", lookupHint: "the licensee's name",
  }),
  R({
    slug: "fincen", code: "FinCEN", match: ["FinCEN|United States"], name: "Financial Crimes Enforcement Network", country: "United States", standing: "registration",
    summary: "FinCEN is a US Treasury bureau. Money services businesses register with it for anti-money-laundering purposes. That registration is not a licence to offer trading, and brokers dealing in US derivatives are supervised by the CFTC and NFA, or by the SEC and FINRA for securities.",
    protections: [
      "FinCEN registration shows AML compliance obligations apply; it does not by itself give clients any compensation scheme.",
      "For US forex and futures, check NFA membership (NFA BASIC) and the CFTC. For securities, check FINRA BrokerCheck and the SEC.",
    ],
    registerUrl: "https://www.fincen.gov/msb-registrant-search", registerLabel: "FinCEN MSB registrant search", lookupHint: "the business name",
  }),
  R({
    slug: "lfsa", code: "LFSA", match: ["LFSA|Malaysia"], name: "Labuan Financial Services Authority", country: "Malaysia (Labuan)", standing: "offshore",
    summary: "The LFSA regulates Labuan, Malaysia's offshore financial centre. Labuan entities are set up mainly to serve clients outside Malaysia.",
    protections: [
      "Labuan licensees are supervised under Labuan law, not Malaysia's onshore securities regime.",
      "There is typically no investor compensation scheme for clients.",
    ],
    registerUrl: "https://www.labuanfsa.gov.my", registerLabel: "Labuan FSA website", lookupHint: "the licensee's name",
  }),
  R({
    slug: "sca-uae", code: "SCA", match: ["SCA|United Arab Emirates"], name: "Securities and Commodities Authority", country: "United Arab Emirates", standing: "regional",
    summary: "The SCA is the UAE federal securities regulator, covering the UAE outside the Dubai and Abu Dhabi financial free zones.",
    protections: ["Licensed firms are supervised under UAE federal securities law.", "Check which entity holds the licence and which products it covers."],
    registerUrl: "https://www.sca.gov.ae", registerLabel: "SCA website", lookupHint: "the firm's name",
  }),
  R({
    slug: "dfsa", code: "DFSA", match: ["DFSA|United Arab Emirates"], name: "Dubai Financial Services Authority", country: "United Arab Emirates (DIFC)", standing: "regional",
    summary: "The DFSA regulates financial services in the Dubai International Financial Centre and publishes a public register of authorised firms.",
    protections: ["Authorised firms follow the DFSA rulebook, which is modelled on international standards.", "Retail-client protections depend on the client categorisation the firm assigns you."],
    registerUrl: "https://www.dfsa.ae/public-register", registerLabel: "DFSA public register", lookupHint: "the firm's name",
  }),
  R({
    slug: "adgm-fsra", code: "ADGM FSRA", match: ["ADGM FSRA|Abu Dhabi", "FSRA|Abu Dhabi"], name: "Financial Services Regulatory Authority (ADGM)", country: "United Arab Emirates (Abu Dhabi Global Market)", standing: "regional",
    summary: "The FSRA regulates financial services in the Abu Dhabi Global Market, an international financial centre with its own rulebook.",
    protections: ["Authorised firms follow the FSRA rulebook.", "Confirm the firm's permitted activities on the public register."],
    registerUrl: "https://www.adgm.com", registerLabel: "ADGM website", lookupHint: "the firm's name",
  }),
  R({
    slug: "bappebti", code: "BAPPEBTI", match: ["BAPPEBTI|Indonesia"], name: "Commodity Futures Trading Regulatory Agency (Bappebti)", country: "Indonesia", standing: "regional",
    summary: "Bappebti supervises commodity futures and related trading in Indonesia, including licensed brokers and exchanges.",
    protections: ["Licensed brokers are supervised under Indonesian commodity futures law.", "Its remit is domestic; check that the licence covers the product and the entity you are dealing with."],
    registerUrl: null, registerLabel: "the regulator's official site", lookupHint: "the broker's name",
  }),
  R({
    slug: "jfsa", code: "JFSA", match: ["JFSA|Japan"], name: "Japan Financial Services Agency", country: "Japan", standing: "major",
    summary: "The JFSA supervises Japanese financial institutions, including registered financial instruments business operators.",
    protections: ["Registered operators follow Japanese conduct and client-asset rules, including segregation of client money.", "Japanese rules cap retail forex leverage (25:1)."],
    registerUrl: "https://www.fsa.go.jp/en/", registerLabel: "JFSA website", lookupHint: "the operator's name or registration number",
  }),
  R({
    slug: "mas", code: "MAS", match: ["MAS|Singapore"], name: "Monetary Authority of Singapore", country: "Singapore", standing: "major",
    summary: "MAS is Singapore's central bank and integrated financial regulator, and publishes a Financial Institutions Directory.",
    protections: ["Licensed firms follow MAS conduct, capital and client-asset rules.", "Check the licence category on the directory to see which products the firm may offer."],
    registerUrl: "https://eservices.mas.gov.sg/fid", registerLabel: "MAS Financial Institutions Directory", lookupHint: "the firm's name",
  }),
  R({
    slug: "fma-nz", code: "FMA", match: ["FMA|New Zealand"], name: "Financial Markets Authority (New Zealand)", country: "New Zealand", standing: "major",
    summary: "The FMA regulates financial markets and services in New Zealand. Providers register on the Financial Service Providers Register (FSPR) and derivatives issuers hold an FMA licence.",
    protections: ["Licensed derivatives issuers follow FMA conduct and disclosure rules.", "Registration on the FSPR alone is not a licence, so check the licensed status."],
    registerUrl: "https://www.fma.govt.nz", registerLabel: "FMA website", lookupHint: "the provider's name or FSP number",
  }),
  R({
    slug: "mfsa", code: "MFSA", match: ["MFSA|Malta"], name: "Malta Financial Services Authority", country: "Malta", standing: "major",
    summary: "The MFSA licenses Maltese financial firms under EU rules, including MiFID II investment services, and can passport licences across the EEA.",
    protections: ["Investor Compensation Scheme cover for eligible clients of licensed investment firms, up to €20,000 per person.", "ESMA-aligned retail rules cap CFD leverage and require negative balance protection."],
    registerUrl: "https://www.mfsa.mt", registerLabel: "MFSA website", lookupHint: "the firm's name or licence number",
  }),
  R({
    slug: "cima", code: "CIMA", match: ["CIMA|Cayman Islands"], name: "Cayman Islands Monetary Authority", country: "Cayman Islands", standing: "offshore",
    summary: "CIMA regulates financial services in the Cayman Islands, a major offshore financial centre.",
    protections: ["Licensees are supervised under Cayman law.", "There is typically no investor compensation scheme for retail trading clients."],
    registerUrl: "https://www.cima.ky", registerLabel: "CIMA website", lookupHint: "the licensee's name",
  }),
  R({
    slug: "fintrac", code: "FINTRAC", match: ["FINTRAC|Canada"], name: "Financial Transactions and Reports Analysis Centre of Canada", country: "Canada", standing: "registration",
    summary: "FINTRAC is Canada's anti-money-laundering agency. Money services businesses register with it, but that registration is not an investment-dealer licence. Canadian investment dealers are overseen by CIRO and provincial securities regulators.",
    protections: ["FINTRAC registration shows AML obligations apply; it gives clients no compensation cover by itself.", "For Canadian dealers, check CIRO and your provincial securities regulator."],
    registerUrl: "https://fintrac-canafe.canada.ca", registerLabel: "FINTRAC website", lookupHint: "the business name",
  }),
  R({
    slug: "cnmv", code: "CNMV", match: ["CNMV|Spain"], name: "Comisión Nacional del Mercado de Valores", country: "Spain", standing: "major",
    summary: "The CNMV supervises Spanish securities markets and investment firms under EU MiFID II rules.",
    protections: ["Investment firms must segregate client assets.", "Spain's investor guarantee fund covers eligible clients of failed investment firms (up to €100,000 per person)."],
    registerUrl: "https://www.cnmv.es", registerLabel: "CNMV website", lookupHint: "the firm's name",
  }),
  R({
    slug: "sfc", code: "SFC", match: ["SFC|Hong Kong"], name: "Securities and Futures Commission", country: "Hong Kong", standing: "major",
    summary: "The SFC licenses firms and individuals that deal in securities and futures in Hong Kong and publishes a public register.",
    protections: ["Licensed corporations follow SFC conduct and client-money rules.", "The Investor Compensation Fund covers eligible losses from a licensed firm's default on exchange-traded products."],
    registerUrl: "https://apps.sfc.hk/publicregWeb/", registerLabel: "SFC public register", lookupHint: "the firm's name or CE number",
  }),
  R({
    slug: "scb-bahamas", code: "SCB", match: ["SCB|Bahamas"], name: "Securities Commission of The Bahamas", country: "The Bahamas", standing: "offshore",
    summary: "The Securities Commission of The Bahamas licenses securities firms in the Bahamas, a common offshore base for brokers serving clients elsewhere.",
    protections: ["Licensees are supervised under Bahamian law.", "There is typically no investor compensation scheme for clients of offshore-facing firms."],
    registerUrl: "https://www.scb.gov.bs", registerLabel: "Securities Commission of The Bahamas website", lookupHint: "the licensee's name",
  }),
];

const BY_SLUG = new Map(REGULATORS.map((r) => [r.slug, r]));
const BY_MATCH = new Map(REGULATORS.flatMap((r) => r.match.map((m) => [m, r] as const)));

export const getRegulator = (slug: string): Regulator | null => BY_SLUG.get(slug) ?? null;

/** Regulator reference for a parsed "CODE (Country)" pair; FCA-only rows carry no country. */
export function findRegulator(code: string, country: string | null): Regulator | null {
  if (code === "FCA" && !country) return BY_SLUG.get("fca") ?? null;
  return (country ? BY_MATCH.get(`${code}|${country}`) : null) ?? null;
}
