import type { Metadata, Viewport } from "next";
import "./globals.css";

import { Providers } from "@/components/providers";
import { getSiteDescription, getSiteTitle } from "@/lib/site-config";

export const metadata: Metadata = {
  title: getSiteTitle(),
  description: getSiteDescription(),
  icons: {
    icon: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Default is resizes-visual: only the visual viewport shrinks with the keyboard.
  // resizes-content also shrinks the *layout* viewport and fights fixed/sticky UI + our
  // VisualViewport-based composer; it also triggers aggressive iOS focus scroll.
  interactiveWidget: "resizes-visual",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
