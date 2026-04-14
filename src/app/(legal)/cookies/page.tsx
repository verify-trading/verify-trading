import type { Metadata } from "next";

import { LegalDocument } from "@/components/legal/legal-document";
import { getAppName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Cookie Notice",
  description: `Cookie and storage information for ${getAppName()}.`,
};

export default function CookiesPage() {
  return (
    <LegalDocument
      eyebrow="Cookies"
      title="Cookie Notice"
      summary="When you first visit the site, a banner lets you choose Essential only or Accept all. Essential cookies are required for sign-in and core features; optional cookies are only used if you accept all (for example future analytics). You can change behaviour later by clearing site data for this domain in your browser."
      sections={[
        {
          title: "Why cookies and storage",
          paragraphs: [
            "Cookies and similar technologies help keep users signed in, protect sessions, and support core product functionality.",
            "The app may use browser storage for short-term UI behaviour, for example remembering that a promotional banner was dismissed for the current session.",
          ],
        },
        {
          title: "Types",
          paragraphs: [
            "Strictly necessary storage supports authentication, security, routing, and session continuity and is generally required for the product to work.",
            "Optional cookies (for example measurement or product improvement) are only enabled if you choose Accept all on the cookie banner. If you choose Essential only, those optional tags are not loaded.",
          ],
        },
        {
          title: "Your controls",
          paragraphs: [
            "Use the cookie banner on first visit to choose Essential only or Accept all. To withdraw consent, clear cookies and local storage for this site in your browser — you will see the banner again on the next visit.",
            "Disabling essential storage in the browser may break sign-in or other features.",
          ],
        },
      ]}
    />
  );
}
