import { SiteNav } from "@/components/site/site-nav";

/**
 * Public legal pages share the same shell as marketing (nav + theme) without the Ask app chrome.
 */
export default function LegalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-dvh flex-col bg-[var(--vt-navy)] text-white">
      <SiteNav />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
