import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { Providers } from "@/components/providers";
import { getSiteDescription, getSiteTitle } from "@/lib/site-config";

export const metadata: Metadata = {
  title: getSiteTitle(),
  description: getSiteDescription(),
  icons: {
    icon: "/favicon.svg?v=4",
    apple: "/favicon.svg?v=4",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
        {/* Google Analytics */}
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

        {/* Rewardful tracking */}
        <Script id="rewardful-queue" strategy="beforeInteractive">
          {`(function(w,r){w._rwq=r;w[r]=w[r]||function(){(w[r].q=w[r].q||[]).push(arguments)}})(window,'rewardful');`}
        </Script>
        <Script
          src="https://r.wdfl.co/rw.js"
          data-rewardful="2f6e2f"
          strategy="afterInteractive"
        />

        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
