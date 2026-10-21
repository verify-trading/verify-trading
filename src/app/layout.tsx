import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Script from "next/script";
import "./globals.css";
import { Providers } from "@/components/providers";
import { JsonLd } from "@/components/seo/json-ld";
import { organizationSchema, webSiteSchema } from "@/lib/seo/schema";
import { getAppName, getSiteDescription, getSiteTitle, getSiteUrl } from "@/lib/site-config";
const siteTitle = getSiteTitle();
const siteDescription = getSiteDescription();
const appName = getAppName();

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: siteTitle,
    template: `%s | ${appName}`,
  },
  description: siteDescription,
  alternates: {
    canonical: "/",
  },
  // Site-wide OG defaults. Pages that export their own metadata via
  // pageMetadata() replace this whole openGraph object (Next inherits the
  // whole object, not field-by-field) — pageMetadata re-attaches the shared
  // OG image so every page has one.
  openGraph: {
    type: "website",
    siteName: appName,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: `${appName} — Verify before you trade.` }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/opengraph-image"],
  },
  // Favicons: Google Search picks from <link rel="icon"> (needs a 48px+
  // raster — SVG alone was being ignored on the SERP, which is why results
  // were showing the globe fallback). PNG icons cover the modern browsers,
  // favicon.ico covers legacy crawlers, apple-icon covers iOS.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
  other: {
    "facebook-domain-verification": "ix9zqdtuj297rwy9b3pbptd4mq1ahu",
  },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // resizes-content: when the software keyboard opens, shrink the *layout* viewport
  // (dvh/vh and 100dvh containers) to the space above the keyboard instead of only
  // panning the visual viewport. Without this (resizes-visual, the iOS Safari default),
  // full-height auth pages (min-h-dvh, content fits the screen) have no scrollable
  // overflow when the keyboard opens, so a focused field below the fold stays hidden
  // behind the keyboard. Shrinking the layout viewport gives the page real scroll room
  // and lets Safari bring the focused input into view natively. Safe for the Ask
  // workspace: its viewport-truth keyboard inset degrades to ~0 once the layout
  // viewport shrinks, so its fixed-bottom composer rides above the keyboard without
  // double-compensating (its manual lift is Android-only).
  interactiveWidget: "resizes-content",
};

const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <JsonLd data={organizationSchema()} />
        <JsonLd data={webSiteSchema()} />
        {/* Google Analytics */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-QKRRYV1XKF"
          strategy="lazyOnload"
        />
        <Script id="google-analytics" strategy="lazyOnload">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-QKRRYV1XKF');
          `}
        </Script>
        {/* Rewardful tracking */}
<Script id="rewardful-queue" strategy="afterInteractive">
  {`(function(w,r){w._rwq=r;w[r]=w[r]||function(){(w[r].q=w[r].q||[]).push(arguments)}})(window,'rewardful');`}
</Script>
<Script
  src="https://r.wdfl.co/rw.js"
  data-rewardful="2f6e2f"
  strategy="afterInteractive"
/>
        {/* Meta Pixel */}
        {META_PIXEL_ID ? (
          <>
            <Script id="meta-pixel" strategy="lazyOnload">
              {`
                !function(f,b,e,v,n,t,s)
                {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)}(window, document,'script',
                'https://connect.facebook.net/en_US/fbevents.js');
                fbq('init', '${META_PIXEL_ID}');
                fbq('track', 'PageView');
              `}
            </Script>
            <noscript>
              <Image
                height="1"
                width="1"
                unoptimized
                style={{ display: "none" }}
                src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
                alt=""
              />
            </noscript>
          </>
        ) : null}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
