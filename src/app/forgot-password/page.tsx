import type { Metadata } from "next";

import ForgotPasswordPageContent from "./forgot-password-page-content";

export const metadata: Metadata = {
  title: "Reset password",
  description: "Reset your verify.trading password.",
  alternates: { canonical: "/forgot-password" },
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordPageContent />;
}
