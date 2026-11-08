import type { Metadata } from "next";

import SignupPageContent from "./signup-page-content";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create your verify.trading account.",
  alternates: { canonical: "/signup" },
  // Auth pages carry no search value; signup was already kept out of the sitemap.
  robots: { index: false, follow: true },
};

export default function SignupPage() {
  return <SignupPageContent />;
}
