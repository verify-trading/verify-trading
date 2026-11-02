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
  /** Regulator codes used by the BTS scoring engine (bts_scores.details.active_verified_licences). */
  engine: string[];
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
    slug: "fca", engine: ["FCA"], code: "FCA", match: ["FCA|United Kingdom"], name: "Financial Conduct Authority", country: "United Kingdom", standing: "major",
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
    slug: "cysec", engine: ["CYSEC"], code: "CySEC", match: ["CySEC|Cyprus"], name: "Cyprus Securities and Exchange Commission", country: "Cyprus", standing: "regional",
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
    slug: "asic", engine: ["ASIC"], code: "ASIC", match: ["ASIC|Australia"], name: "Australian Securities and Investments Commission", country: "Australia", standing: "major",
    summary: "ASIC regulates Australian financial services. A broker needs an Australian Financial Services (AFS) licence to deal with Australian retail clients.",
    protections: [
      "Licensees must meet conduct, disclosure and dispute-resolution obligations, including membership of the Australian Financial Complaints Authority (AFCA).",
      "ASIC's product intervention order caps retail CFD leverage (30:1 on major currency pairs) and requires negative balance protection.",
      "There is generally no compensation scheme for CFD clients comparable to the UK's FSCS, so client-money arrangements matter.",
    ],
    registerUrl: "https://asic.gov.au/online-services/search-asics-registers/", registerLabel: "ASIC registers", lookupHint: "the firm's name or AFS licence number",
  }),
  R({
    slug: "fsca", engine: ["FSCA"], code: "FSCA", match: ["FSCA|South Africa"], name: "Financial Sector Conduct Authority", country: "South Africa", standing: "regional",
    summary: "The FSCA licenses Financial Services Providers (FSPs) in South Africa. Each FSP has an FSP number and a list of licensed product categories.",
    protections: [
      "Licensed FSPs are bound by the Financial Advisory and Intermediary Services (FAIS) Act and its conduct rules.",
      "Clients can complain to the FAIS Ombud about licensed providers.",
      "What a licence covers depends on the licensed categories, so confirm on the register that leveraged products are included.",
    ],
    registerUrl: "https://www.fsca.co.za", registerLabel: "FSCA website (FSP search)", lookupHint: "the FSP name or FSP number",
  }),
  R({
    slug: "fsa-seychelles", engine: ["FSA_SC"], code: "FSA", match: ["FSA|Seychelles", "FSA|Saint Vincent and the Grenadines"], name: "Financial Services Authority (Seychelles)", country: "Seychelles", standing: "offshore",
    summary: "The Seychelles FSA licenses securities dealers, many of which serve clients outside Seychelles. Note that another FSA, in Japan, is a separate regulator.",
    protections: [
      "Licensed dealers are subject to Seychelles securities law and FSA supervision.",
      "There is typically no investor compensation scheme for clients of a Seychelles-licensed dealer.",
      "Leverage and marketing are often less restricted than under UK or EU rules, and cross-border redress can be slow.",
    ],
    registerUrl: "https://fsaseychelles.sc", registerLabel: "Seychelles FSA website", lookupHint: "the firm's name or licence number",
  }),
  R({
    slug: "fsc-mauritius", engine: ["FSC_MU"], code: "FSC", match: ["FSC|Mauritius"], name: "Financial Services Commission (Mauritius)", country: "Mauritius", standing: "offshore",
    summary: "The Mauritius FSC licenses non-bank financial services, including investment dealers. Many licensees are set up to serve clients outside Mauritius.",
    protections: [
      "Licensees are supervised under Mauritian financial services law.",
      "There is typically no investor compensation scheme comparable to the FSCS.",
      "Leverage and marketing rules are often lighter than under UK or EU rules.",
    ],
    registerUrl: "https://www.fscmauritius.org", registerLabel: "Mauritius FSC website", lookupHint: "the licensee's name or licence number",
  }),
  R({
    slug: "fsc-bvi", engine: ["BVI_FSC"], code: "FSC", match: ["FSC|The British Virgin Islands"], name: "Financial Services Commission (British Virgin Islands)", country: "British Virgin Islands", standing: "offshore",
    summary: "The BVI FSC regulates financial services companies registered in the British Virgin Islands, a common offshore base for brokers serving clients elsewhere.",
    protections: [
      "Licensees are supervised under BVI law.",
      "There is typically no investor compensation scheme for clients.",
      "Retail-client protections such as leverage caps are generally lighter than in the UK or EU.",
    ],
    registerUrl: "https://www.bvifsc.vg", registerLabel: "BVI FSC website", lookupHint: "the entity's name or licence number",
  }),
  R({
    slug: "vfsc", engine: ["VFSC"], code: "VFSC", match: ["VFSC|Vanuatu"], name: "Vanuatu Financial Services Commission", country: "Vanuatu", standing: "offshore",
    summary: "The VFSC licenses dealers in securities in Vanuatu, a popular offshore base for retail forex brokers.",
    protections: [
      "Licensees are supervised under Vanuatu law.",
      "There is typically no investor compensation scheme for clients.",
      "Leverage is generally not capped as it is in the UK or EU, and enforcing rights across borders is difficult.",
    ],
    registerUrl: "https://www.vfsc.vu", registerLabel: "Vanuatu FSC website", lookupHint: "the licensee's name",
  }),
  R({
    slug: "misa-comoros", engine: ["COMOROS"], code: "MISA", match: ["MISA|Comoros", "AOFA|Comoros"], name: "Mwali International Services Authority", country: "Comoros", standing: "registration",
    summary: "MISA, in the Autonomous Island of Mwali (Comoros), registers international businesses. We treat a Comoros registration as a registration, not a trading licence: it is not comparable to a UK, EU or Australian licence.",
    protections: [
      "There is typically no investor compensation scheme.",
      "Licences of this kind are not equivalent to supervision by a major regulator, so treat them as low weight.",
      "Cross-border redress is limited.",
    ],
    registerUrl: null, registerLabel: "the regulator's official site", lookupHint: "the licensee's name",
  }),
  R({
    slug: "fincen", engine: ["FINCEN"], code: "FinCEN", match: ["FinCEN|United States"], name: "Financial Crimes Enforcement Network", country: "United States", standing: "registration",
    summary: "FinCEN is a US Treasury bureau. Money services businesses register with it for anti-money-laundering purposes. That registration is not a licence to offer trading, and brokers dealing in US derivatives are supervised by the CFTC and NFA, or by the SEC and FINRA for securities.",
    protections: [
      "FinCEN registration shows AML compliance obligations apply; it does not by itself give clients any compensation scheme.",
      "For US forex and futures, check NFA membership (NFA BASIC) and the CFTC. For securities, check FINRA BrokerCheck and the SEC.",
    ],
    registerUrl: "https://www.fincen.gov/msb-registrant-search", registerLabel: "FinCEN MSB registrant search", lookupHint: "the business name",
  }),
  R({
    slug: "lfsa", engine: ["LFSA"], code: "LFSA", match: ["LFSA|Malaysia"], name: "Labuan Financial Services Authority", country: "Malaysia (Labuan)", standing: "offshore",
    summary: "The LFSA regulates Labuan, Malaysia's offshore financial centre. Labuan entities are set up mainly to serve clients outside Malaysia.",
    protections: [
      "Labuan licensees are supervised under Labuan law, not Malaysia's onshore securities regime.",
      "There is typically no investor compensation scheme for clients.",
    ],
    registerUrl: "https://www.labuanfsa.gov.my", registerLabel: "Labuan FSA website", lookupHint: "the licensee's name",
  }),
  R({
    slug: "sca-uae", engine: ["SCA"], code: "SCA", match: ["SCA|United Arab Emirates"], name: "Securities and Commodities Authority", country: "United Arab Emirates", standing: "regional",
    summary: "The SCA is the UAE federal securities regulator, covering the UAE outside the Dubai and Abu Dhabi financial free zones.",
    protections: ["Licensed firms are supervised under UAE federal securities law.", "Check which entity holds the licence and which products it covers."],
    registerUrl: "https://www.sca.gov.ae", registerLabel: "SCA website", lookupHint: "the firm's name",
  }),
  R({
    slug: "dfsa", engine: ["DFSA"], code: "DFSA", match: ["DFSA|United Arab Emirates"], name: "Dubai Financial Services Authority", country: "United Arab Emirates (DIFC)", standing: "regional",
    summary: "The DFSA regulates financial services in the Dubai International Financial Centre and publishes a public register of authorised firms.",
    protections: ["Authorised firms follow the DFSA rulebook, which is modelled on international standards.", "Retail-client protections depend on the client categorisation the firm assigns you."],
    registerUrl: "https://www.dfsa.ae/public-register", registerLabel: "DFSA public register", lookupHint: "the firm's name",
  }),
  R({
    slug: "adgm-fsra", engine: ["FSRA"], code: "ADGM FSRA", match: ["ADGM FSRA|Abu Dhabi", "FSRA|Abu Dhabi"], name: "Financial Services Regulatory Authority (ADGM)", country: "United Arab Emirates (Abu Dhabi Global Market)", standing: "regional",
    summary: "The FSRA regulates financial services in the Abu Dhabi Global Market, an international financial centre with its own rulebook.",
    protections: ["Authorised firms follow the FSRA rulebook.", "Confirm the firm's permitted activities on the public register."],
    registerUrl: "https://www.adgm.com", registerLabel: "ADGM website", lookupHint: "the firm's name",
  }),
  R({
    slug: "bappebti", engine: ["BAPPEBTI"], code: "BAPPEBTI", match: ["BAPPEBTI|Indonesia"], name: "Commodity Futures Trading Regulatory Agency (Bappebti)", country: "Indonesia", standing: "regional",
    summary: "Bappebti supervises commodity futures and related trading in Indonesia, including licensed brokers and exchanges.",
    protections: ["Licensed brokers are supervised under Indonesian commodity futures law.", "Its remit is domestic; check that the licence covers the product and the entity you are dealing with."],
    registerUrl: null, registerLabel: "the regulator's official site", lookupHint: "the broker's name",
  }),
  R({
    slug: "jfsa", engine: ["JFSA"], code: "JFSA", match: ["JFSA|Japan"], name: "Japan Financial Services Agency", country: "Japan", standing: "major",
    summary: "The JFSA supervises Japanese financial institutions, including registered financial instruments business operators.",
    protections: ["Registered operators follow Japanese conduct and client-asset rules, including segregation of client money.", "Japanese rules cap retail forex leverage (25:1)."],
    registerUrl: "https://www.fsa.go.jp/en/", registerLabel: "JFSA website", lookupHint: "the operator's name or registration number",
  }),
  R({
    slug: "mas", engine: ["MAS"], code: "MAS", match: ["MAS|Singapore"], name: "Monetary Authority of Singapore", country: "Singapore", standing: "major",
    summary: "MAS is Singapore's central bank and integrated financial regulator, and publishes a Financial Institutions Directory.",
    protections: ["Licensed firms follow MAS conduct, capital and client-asset rules.", "Check the licence category on the directory to see which products the firm may offer."],
    registerUrl: "https://eservices.mas.gov.sg/fid", registerLabel: "MAS Financial Institutions Directory", lookupHint: "the firm's name",
  }),
  R({
    slug: "fma-nz", engine: ["FMA_NZ"], code: "FMA", match: ["FMA|New Zealand"], name: "Financial Markets Authority (New Zealand)", country: "New Zealand", standing: "major",
    summary: "The FMA regulates financial markets and services in New Zealand. Providers register on the Financial Service Providers Register (FSPR) and derivatives issuers hold an FMA licence.",
    protections: ["Licensed derivatives issuers follow FMA conduct and disclosure rules.", "Registration on the FSPR alone is not a licence, so check the licensed status."],
    registerUrl: "https://www.fma.govt.nz", registerLabel: "FMA website", lookupHint: "the provider's name or FSP number",
  }),
  R({
    slug: "mfsa", engine: ["MFSA"], code: "MFSA", match: ["MFSA|Malta"], name: "Malta Financial Services Authority", country: "Malta", standing: "regional",
    summary: "The MFSA licenses Maltese financial firms under EU rules, including MiFID II investment services, and can passport licences across the EEA.",
    protections: ["Investor Compensation Scheme cover for eligible clients of licensed investment firms, up to €20,000 per person.", "ESMA-aligned retail rules cap CFD leverage and require negative balance protection."],
    registerUrl: "https://www.mfsa.mt", registerLabel: "MFSA website", lookupHint: "the firm's name or licence number",
  }),
  R({
    slug: "cima", engine: ["CIMA"], code: "CIMA", match: ["CIMA|Cayman Islands"], name: "Cayman Islands Monetary Authority", country: "Cayman Islands", standing: "offshore",
    summary: "CIMA regulates financial services in the Cayman Islands, a major offshore financial centre.",
    protections: ["Licensees are supervised under Cayman law.", "There is typically no investor compensation scheme for retail trading clients."],
    registerUrl: "https://www.cima.ky", registerLabel: "CIMA website", lookupHint: "the licensee's name",
  }),
  R({
    slug: "fintrac", engine: ["FINTRAC"], code: "FINTRAC", match: ["FINTRAC|Canada"], name: "Financial Transactions and Reports Analysis Centre of Canada", country: "Canada", standing: "registration",
    summary: "FINTRAC is Canada's anti-money-laundering agency. Money services businesses register with it, but that registration is not an investment-dealer licence. Canadian investment dealers are overseen by CIRO and provincial securities regulators.",
    protections: ["FINTRAC registration shows AML obligations apply; it gives clients no compensation cover by itself.", "For Canadian dealers, check CIRO and your provincial securities regulator."],
    registerUrl: "https://fintrac-canafe.canada.ca", registerLabel: "FINTRAC website", lookupHint: "the business name",
  }),
  R({
    slug: "cnmv", engine: ["CNMV"], code: "CNMV", match: ["CNMV|Spain"], name: "Comisión Nacional del Mercado de Valores", country: "Spain", standing: "regional",
    summary: "The CNMV supervises Spanish securities markets and investment firms under EU MiFID II rules.",
    protections: ["Investment firms must segregate client assets.", "Spain's investor guarantee fund covers eligible clients of failed investment firms (up to €100,000 per person)."],
    registerUrl: "https://www.cnmv.es", registerLabel: "CNMV website", lookupHint: "the firm's name",
  }),
  R({
    slug: "sfc", engine: ["SFC"], code: "SFC", match: ["SFC|Hong Kong"], name: "Securities and Futures Commission", country: "Hong Kong", standing: "major",
    summary: "The SFC licenses firms and individuals that deal in securities and futures in Hong Kong and publishes a public register.",
    protections: ["Licensed corporations follow SFC conduct and client-money rules.", "The Investor Compensation Fund covers eligible losses from a licensed firm's default on exchange-traded products."],
    registerUrl: "https://apps.sfc.hk/publicregWeb/", registerLabel: "SFC public register", lookupHint: "the firm's name or CE number",
  }),
  R({
    slug: "scb-bahamas", engine: ["SCB"], code: "SCB", match: ["SCB|Bahamas"], name: "Securities Commission of The Bahamas", country: "The Bahamas", standing: "offshore",
    summary: "The Securities Commission of The Bahamas licenses securities firms in the Bahamas, a common offshore base for brokers serving clients elsewhere.",
    protections: ["Licensees are supervised under Bahamian law.", "There is typically no investor compensation scheme for clients of offshore-facing firms."],
    registerUrl: "https://www.scb.gov.bs", registerLabel: "Securities Commission of The Bahamas website", lookupHint: "the licensee's name",
  }),
  // Added for BTS v2 (regulator_mapping.csv): regulators that hold active licences in the engine data.
  R({
    slug: "finra", engine: ["FINRA"], code: "FINRA/SEC", match: ["FINRA|United States", "SEC|United States"], name: "FINRA and the Securities and Exchange Commission", country: "United States", standing: "major",
    summary: "US broker-dealers register with the SEC and must be members of FINRA, the self-regulatory organisation that supervises them. FINRA BrokerCheck shows a firm's registration and disciplinary history.",
    protections: [
      "SIPC protects customers of a failed member broker-dealer up to $500,000, including up to $250,000 in cash. It does not cover market losses.",
      "The SEC Customer Protection Rule requires customer securities and cash to be kept separate from the firm's own.",
      "Disputes with a member firm can go to FINRA arbitration.",
    ],
    registerUrl: "https://brokercheck.finra.org", registerLabel: "FINRA BrokerCheck", lookupHint: "the firm's name or CRD number",
  }),
  R({
    slug: "cftc-nfa", engine: ["CFTC", "NFA"], code: "CFTC/NFA", match: ["CFTC|United States", "NFA|United States"], name: "Commodity Futures Trading Commission and National Futures Association", country: "United States", standing: "major",
    summary: "US futures brokers and retail forex dealers must register with the CFTC and be members of the National Futures Association, which publishes each member's record on NFA BASIC.",
    protections: [
      "Customer funds for futures trading must be segregated from the firm's own money.",
      "Retail forex leverage is capped at 50:1 on major currency pairs and 20:1 on others.",
      "There is no SIPC-style compensation scheme for futures or forex accounts.",
    ],
    registerUrl: "https://www.nfa.futures.org/BasicNet/", registerLabel: "NFA BASIC", lookupHint: "the firm's name or NFA ID",
  }),
  R({
    slug: "nydfs", engine: ["NYDFS"], code: "NYDFS", match: ["NYDFS|United States"], name: "New York State Department of Financial Services", country: "United States (New York)", standing: "major",
    summary: "NYDFS supervises banks, money transmitters and virtual currency businesses operating in New York, including firms holding a BitLicense or a New York trust charter.",
    protections: [
      "BitLicense holders must meet capital, custody, consumer-protection and cybersecurity requirements.",
      "Virtual currency holdings are not covered by FDIC or SIPC protection.",
    ],
    registerUrl: "https://www.dfs.ny.gov", registerLabel: "NYDFS website", lookupHint: "the company's name",
  }),
  R({
    slug: "bafin", engine: ["BAFIN"], code: "BaFin", match: ["BaFin|Germany", "BAFIN|Germany"], name: "Federal Financial Supervisory Authority (BaFin)", country: "Germany", standing: "major",
    summary: "BaFin supervises banks and investment firms in Germany under EU MiFID II rules and publishes a database of authorised companies.",
    protections: [
      "The compensation scheme for investment firms (EdW) covers 90% of eligible claims, up to €20,000 per client.",
      "ESMA-aligned retail rules cap CFD leverage (30:1 on major currency pairs) and require negative balance protection.",
    ],
    registerUrl: "https://portal.mvp.bafin.de/database/InstInfo/", registerLabel: "BaFin company database", lookupHint: "the company's name or BaFin ID",
  }),
  R({
    slug: "central-bank-of-ireland", engine: ["CBI"], code: "CBI", match: ["CBI|Ireland"], name: "Central Bank of Ireland", country: "Ireland", standing: "major",
    summary: "The Central Bank of Ireland authorises and supervises investment firms in Ireland under EU MiFID II rules. Several international brokers use an Irish entity to serve EU clients.",
    protections: [
      "The Investor Compensation Scheme covers 90% of eligible losses, up to €20,000 per client.",
      "ESMA-aligned retail rules cap CFD leverage (30:1 on major currency pairs) and require negative balance protection.",
    ],
    registerUrl: "https://registers.centralbank.ie", registerLabel: "Central Bank of Ireland registers", lookupHint: "the firm's name or reference number",
  }),
  R({
    slug: "acpr-amf", engine: ["ACPR"], code: "ACPR/AMF", match: ["ACPR|France", "AMF|France"], name: "ACPR and Autorité des marchés financiers", country: "France", standing: "major",
    summary: "In France the ACPR authorises investment firms and the AMF supervises how they deal with clients. Authorised firms are listed on the REGAFI register, and the AMF publishes blacklists of unauthorised sites.",
    protections: [
      "The FGDR guarantee covers eligible securities held with a failed firm up to €70,000 per client.",
      "ESMA-aligned retail rules cap CFD leverage (30:1 on major currency pairs) and require negative balance protection.",
    ],
    registerUrl: "https://www.regafi.fr", registerLabel: "REGAFI register", lookupHint: "the firm's name or REGAFI ID",
  }),
  R({
    slug: "cssf", engine: ["CSSF"], code: "CSSF", match: ["CSSF|Luxembourg"], name: "Commission de Surveillance du Secteur Financier", country: "Luxembourg", standing: "major",
    summary: "The CSSF supervises banks and investment firms in Luxembourg under EU rules and publishes a searchable register of supervised entities.",
    protections: [
      "Luxembourg's investor compensation scheme (SIIL) covers eligible claims up to €20,000 per client.",
      "ESMA-aligned retail rules cap CFD leverage (30:1 on major currency pairs) and require negative balance protection.",
    ],
    registerUrl: "https://searchentities.apps.cssf.lu", registerLabel: "CSSF entity search", lookupHint: "the entity's name",
  }),
  R({
    slug: "finma", engine: ["FINMA"], code: "FINMA", match: ["FINMA|Switzerland"], name: "Swiss Financial Market Supervisory Authority", country: "Switzerland", standing: "major",
    summary: "FINMA supervises Swiss banks and securities firms. Swiss forex and CFD providers generally need a banking or securities-firm licence from FINMA.",
    protections: [
      "Deposits at a Swiss bank are protected by esisuisse up to CHF 100,000 per client.",
      "Securities held in custody are kept apart from the bank's own assets if it fails.",
    ],
    registerUrl: "https://www.finma.ch/en/finma-public/authorised-institutions-individuals-and-products/", registerLabel: "FINMA list of authorised institutions", lookupHint: "the institution's name",
  }),
  R({
    slug: "sebi", engine: ["SEBI"], code: "SEBI", match: ["SEBI|India"], name: "Securities and Exchange Board of India", country: "India", standing: "regional",
    summary: "SEBI regulates India's securities markets and registers stockbrokers, who must be members of a recognised exchange such as NSE or BSE.",
    protections: [
      "Exchanges run investor protection funds that can compensate eligible clients if a member broker defaults, within set limits.",
      "Indian residents may trade forex only in permitted pairs on recognised Indian exchanges. The RBI publishes an alert list of unauthorised online forex platforms.",
    ],
    registerUrl: "https://www.sebi.gov.in/intermediaries.html", registerLabel: "SEBI registered intermediaries", lookupHint: "the broker's name or SEBI registration number",
  }),
  R({
    slug: "vara", engine: ["VARA"], code: "VARA", match: ["VARA|United Arab Emirates"], name: "Virtual Assets Regulatory Authority", country: "United Arab Emirates (Dubai)", standing: "regional",
    summary: "VARA licenses virtual asset service providers in Dubai, outside the DIFC, and publishes a public register of licensees.",
    protections: [
      "Licensees follow VARA rulebooks on custody, client assets and market conduct.",
      "There is no investor compensation scheme for virtual asset clients.",
    ],
    registerUrl: "https://www.vara.ae", registerLabel: "VARA website", lookupHint: "the company's name",
  }),
  R({
    slug: "ojk", engine: ["OJK"], code: "OJK", match: ["OJK|Indonesia"], name: "Financial Services Authority (OJK)", country: "Indonesia", standing: "regional",
    summary: "OJK is Indonesia's integrated financial regulator, supervising banks and capital-market firms such as securities brokers.",
    protections: [
      "Licensed securities firms are supervised under Indonesian capital-market law.",
      "Indonesia's Securities Investor Protection Fund can compensate eligible investors for lost assets, within set limits.",
    ],
    registerUrl: "https://www.ojk.go.id", registerLabel: "OJK website", lookupHint: "the firm's name",
  }),
  R({
    slug: "csrc", engine: ["CSRC"], code: "CSRC", match: ["CSRC|China"], name: "China Securities Regulatory Commission", country: "China", standing: "regional",
    summary: "The CSRC supervises mainland China's securities and futures markets and licenses securities and futures firms.",
    protections: [
      "Client trading funds at licensed firms are held in third-party custody at a bank.",
      "Mainland China does not license offshore online forex or CFD trading for retail clients.",
    ],
    registerUrl: "http://www.csrc.gov.cn", registerLabel: "CSRC website", lookupHint: "the firm's name",
  }),
  R({
    slug: "fss-korea", engine: ["FSS_KR"], code: "FSS", match: ["FSS|South Korea", "FSC|South Korea"], name: "Financial Supervisory Service (Korea)", country: "South Korea", standing: "regional",
    summary: "Korea's Financial Supervisory Service, working under the Financial Services Commission, supervises banks and financial investment businesses such as securities firms.",
    protections: [
      "Client deposits at securities firms are kept with the Korea Securities Finance Corporation, separate from the firm's own money.",
      "The Korea Deposit Insurance Corporation protects eligible cash balances up to a per-person limit.",
    ],
    registerUrl: "https://fine.fss.or.kr", registerLabel: "FSS FINE portal", lookupHint: "the company's name",
  }),
];

const BY_SLUG = new Map(REGULATORS.map((r) => [r.slug, r]));
const BY_ENGINE = new Map(REGULATORS.flatMap((r) => r.engine.map((c) => [c, r] as const)));

/** Engine codes with no hub page: display label and country only. */
const ENGINE_ONLY: Record<string, { code: string; country: string | null }> = {
  AFM: { code: "AFM", country: "Netherlands" }, CMA_KE: { code: "CMA", country: "Kenya" }, CMA_SA: { code: "CMA", country: "Saudi Arabia" },
  CNBV: { code: "CNBV", country: "Mexico" }, CNV: { code: "CNV", country: "Argentina" }, CONSOB: { code: "CONSOB", country: "Italy" },
  FI: { code: "FI", country: "Sweden" }, FMA_AT: { code: "FMA", country: "Austria" }, FSC_TW: { code: "FSC", country: "Taiwan" },
  IFSC_BZ: { code: "IFSC", country: "Belize" }, JSE: { code: "JSE member", country: "South Africa" }, KNF: { code: "KNF", country: "Poland" },
  QFCRA: { code: "QFCRA", country: "Qatar" }, SEC_TH: { code: "SEC", country: "Thailand" }, SSC_VN: { code: "SSC", country: "Vietnam" },
  KOFIU: { code: "KoFIU", country: "South Korea" }, AUSTRAC: { code: "AUSTRAC", country: "Australia" }, CIPF: { code: "CIPF", country: "Canada" },
  OTHER_NATIONAL: { code: "National regulator", country: null }, EXCHANGE_MEMBER: { code: "Exchange member", country: null },
};

/** Engine licence code -> display code, country and hub slug (null when we have no page for it). */
export function regulatorForEngineCode(code: string): { code: string; country: string | null; slug: string | null } {
  const r = BY_ENGINE.get(code);
  if (r) return { code: r.code, country: r.country, slug: r.slug };
  return { ...(ENGINE_ONLY[code] ?? { code: code.replace(/_/g, " "), country: null }), slug: null };
}
const BY_MATCH = new Map(REGULATORS.flatMap((r) => r.match.map((m) => [m, r] as const)));

export const getRegulator = (slug: string): Regulator | null => BY_SLUG.get(slug) ?? null;

/** Regulator reference for a parsed "CODE (Country)" pair; FCA-only rows carry no country. */
export function findRegulator(code: string, country: string | null): Regulator | null {
  if (code === "FCA" && !country) return BY_SLUG.get("fca") ?? null;
  return (country ? BY_MATCH.get(`${code}|${country}`) : null) ?? null;
}
