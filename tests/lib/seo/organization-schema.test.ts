import { describe, expect, it } from "vitest";

import { organizationSchema } from "@/lib/seo/schema";

describe("organizationSchema", () => {
  const schema = organizationSchema();

  it("has the fields Ahrefs' Organization check reads", () => {
    expect(schema["@type"]).toBe("Organization");
    expect(schema.name).toBeTruthy();
    expect(schema.url).toBeTruthy();
    expect(schema.description).toBeTruthy();
    expect(schema.email).toBe("ai@verify.trading");
  });

  it("ships logo as an ImageObject with dimensions", () => {
    expect(schema.logo).toMatchObject({
      "@type": "ImageObject",
      width: 512,
      height: 512,
    });
    expect(String((schema.logo as Record<string, unknown>).url)).toMatch(/\/icon-512\.png$/);
  });

  it("includes verified social URLs in sameAs and drops placeholders", () => {
    const sameAs = schema.sameAs as string[];
    expect(sameAs.length).toBeGreaterThan(0);
    expect(sameAs).not.toContain("#");
    expect(sameAs.some((u) => u.includes("instagram.com"))).toBe(true);
    expect(sameAs.some((u) => u.includes("linkedin.com"))).toBe(true);
    expect(sameAs.some((u) => u.includes("apps.apple.com"))).toBe(true);
  });

  it("has a contactPoint with support email", () => {
    const cp = schema.contactPoint as Array<Record<string, unknown>>;
    expect(Array.isArray(cp)).toBe(true);
    expect(cp[0]).toMatchObject({ "@type": "ContactPoint", email: "ai@verify.trading", contactType: "customer support" });
  });

  it("includes knowsAbout topics that match what the site covers", () => {
    const topics = schema.knowsAbout as string[];
    expect(topics.length).toBeGreaterThan(3);
    expect(topics.some((t) => /broker/i.test(t))).toBe(true);
    expect(topics.some((t) => /prop firm/i.test(t))).toBe(true);
  });
});
