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
  // Only site-wide OG fields live here. Per-page title/description/url are
  // intentionally omitted so each route's own <title>/description drive its
  // social card (Next inherits the whole openGraph object, not field-by-field).
  // The opengraph-image.tsx route supplies og:image + twitter:image site-wide.
  openGraph: {
    type: "website",
    siteName: appName,
  },
  twitter: {
    card: "summary_large_image",
  },
  icons: {
    icon: "/favicon.svg?v=4",
    apple: "/favicon.svg?v=4",
  },
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
        <Script id="rewardful-queue" strategy="lazyOnload">
          {`(function(w,r){w._rwq=r;w[r]=w[r]||function(){(w[r].q=w[r].q||[]).push(arguments)}})(window,'rewardful');`}
        </Script>
        <Script
          src="https://r.wdfl.co/rw.js"
          data-rewardful="2f6e2f"
          strategy="lazyOnload"
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
