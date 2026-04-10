/**
 * Legal destinations for footers and auth screens.
 * Terms and privacy live on one page (`/terms`); use `#privacy` for the privacy section.
 */
export const LEGAL_LINKS = [
  { href: "/terms", label: "Terms & Privacy", shortLabel: "Terms" },
  { href: "/cookies", label: "Cookie Notice", shortLabel: "Cookies" },
  { href: "/risk-disclosure", label: "Risk disclosure", shortLabel: "Risk" },
] as const;

export type LegalLink = (typeof LEGAL_LINKS)[number];
