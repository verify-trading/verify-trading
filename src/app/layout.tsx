import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "verify.trading — The ChatGPT built for traders",
  description:
    "Verify any broker in 2 seconds. Get briefed before the market opens. Calculate your exact risk.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
