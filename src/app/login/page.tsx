import type { Metadata } from "next";

import LoginPageContent from "./login-page-content";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to verify.trading.",
};

export default function LoginPage() {
  return <LoginPageContent />;
}
