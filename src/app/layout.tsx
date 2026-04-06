import type { Metadata } from "next";
import "./globals.css";

import { getSiteDescription, getSiteTitle } from "@/lib/site-config";

export const metadata: Metadata = {
  title: getSiteTitle(),
  description: getSiteDescription(),
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
