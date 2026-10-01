import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";

/** Public marketing pages: site nav + footer, no Ask app chrome. */
export default function MarketingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col bg-[var(--vt-navy)] text-white">
      <SiteNav slim />
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      <SiteFooter />
    </div>
  );
}
