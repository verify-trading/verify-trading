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
      summary="How we use cookies and similar storage. Update this when you add analytics, ads, or a consent banner so the notice matches what you actually deploy."
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
            "If analytics, advertising, or personalisation cookies are introduced, disclose them here with purpose and any consent controls you expose in the product.",
          ],
        },
        {
          title: "Your controls",
          paragraphs: [
            "Users can manage cookies through browser settings; disabling essential storage may break sign-in or other features.",
            "If you add a consent banner, align this notice with the categories and toggles shown there.",
          ],
        },
      ]}
    />
  );
}
