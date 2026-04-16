/**
 * Legal destinations for footers and auth screens.
 * OAuth / store fronts often require the literal label "Privacy policy" on the home page.
 */
export const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy policy", shortLabel: "Privacy" },
  { href: "/terms", label: "Terms of use", shortLabel: "Terms" },
  { href: "/cookies", label: "Cookie Notice", shortLabel: "Cookies" },
  { href: "/risk-disclosure", label: "Risk disclosure", shortLabel: "Risk" },
] as const;

export type LegalLink = (typeof LEGAL_LINKS)[number];
