import { describe, expect, it } from "vitest";

import { pageMetadata } from "@/lib/marketing/seo";

describe("pageMetadata OG image", () => {
  const meta = pageMetadata({
    title: "Pip value calculator",
    description: "What one pip is worth for your pair and lot size.",
    path: "/tools/pip-value-calculator",
  });

  it("attaches the site OG image to openGraph.images", () => {
    const images = meta.openGraph?.images;
    expect(images).toBeDefined();
    expect(Array.isArray(images) ? images[0] : images).toMatchObject({
      url: "/opengraph-image",
      width: 1200,
      height: 630,
    });
  });

  it("attaches the site OG image to twitter.images", () => {
    const images = meta.twitter?.images;
    expect(images).toBeDefined();
    expect(Array.isArray(images) ? images[0] : images).toBe("/opengraph-image");
  });

  it("sets twitter title and description so the card renders without inheritance", () => {
    expect(meta.twitter?.title).toContain("Pip value calculator");
    expect(meta.twitter?.description).toContain("pip");
  });
});
