import type { Metadata } from "next";

import SignupPageContent from "./signup-page-content";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create your verify.trading account.",
};

export default function SignupPage() {
  return <SignupPageContent />;
}
