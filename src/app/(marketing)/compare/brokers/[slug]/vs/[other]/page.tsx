import { notFound } from "next/navigation";

// Broker-vs-broker comparison pages have been removed from the site. Any such URL now 404s.
export const dynamicParams = false;
export function generateStaticParams() {
  return [];
}

export default function Page() {
  notFound();
}
