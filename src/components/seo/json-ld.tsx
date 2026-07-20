import type { SchemaOrgObject } from "@/lib/seo/schema";

/**
 * Renders a single schema.org JSON-LD `<script>` block for crawlers (Google, AI engines).
 * Server component only — must not be marked "use client".
 */
export function JsonLd({ data }: { data: SchemaOrgObject }) {
  return (
    <script
      type="application/ld+json"
      // Escape "<" to avoid breaking out of the script tag with untrusted strings.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
