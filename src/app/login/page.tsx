import type { Metadata } from "next";

import LoginPageContent from "./login-page-content";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to verify.trading.",
  alternates: { canonical: "/login" },
  // Auth pages carry no search value; keeping them out of the index also stops
  // the 1,500+ gated-route redirects into /login from accumulating as an indexable page.
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return <LoginPageContent />;
}
