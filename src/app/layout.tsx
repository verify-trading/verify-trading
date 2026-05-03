import type { Metadata, Viewport } from "next";
import Script from "next/script";
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
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-QKRRYV1XKF"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-QKRRYV1XKF');
          `}
        </Script>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
