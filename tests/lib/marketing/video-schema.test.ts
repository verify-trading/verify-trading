import { describe, expect, it } from "vitest";

import { videoObjectSchema } from "@/lib/marketing/seo";
import { getAppName, getSiteUrl } from "@/lib/site-config";

describe("videoObjectSchema", () => {
  const base = {
    name: "How to use the lot size calculator",
    description: "A short walkthrough.",
    contentUrl: "/videos/lot-size.mp4",
    thumbnailUrl: "/videos/lot-size.jpg",
    uploadDate: "2026-10-21",
    duration: "PT26S",
    embedUrl: "/tools/position-size-calculator",
  };

  it("includes every field Google requires for a VideoObject", () => {
    const site = getSiteUrl();
    const schema = videoObjectSchema(base);
    expect(schema["@type"]).toBe("VideoObject");
    expect(schema.name).toBe(base.name);
    expect(schema.description).toBe(base.description);
    expect(schema.thumbnailUrl).toBe(`${site}/videos/lot-size.jpg`);
    expect(schema.contentUrl).toBe(`${site}/videos/lot-size.mp4`);
    expect(schema.embedUrl).toBe(`${site}/tools/position-size-calculator`);
    expect(schema.uploadDate).toBe("2026-10-21");
    expect(schema.duration).toBe("PT26S");
    expect(schema.inLanguage).toBe("en");
    expect(schema.isFamilyFriendly).toBe(true);
    expect(schema.publisher).toEqual({
      "@type": "Organization",
      name: getAppName(),
      url: site,
      logo: { "@type": "ImageObject", url: `${site}/favicon.svg` },
    });
  });

  it("never uses the mp4 as the thumbnail (Google requires an image)", () => {
    const schema = videoObjectSchema({ ...base });
    expect(String(schema.thumbnailUrl)).not.toMatch(/\.mp4$/);
    expect(String(schema.thumbnailUrl)).toMatch(/\.(jpg|png|webp)$/);
  });

  it("keeps absolute YouTube URLs as-is for embedded videos", () => {
    const schema = videoObjectSchema({
      ...base,
      contentUrl: "https://www.youtube.com/watch?v=cvXv4898Ldk",
      embedUrl: "https://www.youtube-nocookie.com/embed/cvXv4898Ldk?rel=0",
      thumbnailUrl: "https://i.ytimg.com/vi/cvXv4898Ldk/maxresdefault.jpg",
    });
    expect(schema.contentUrl).toBe("https://www.youtube.com/watch?v=cvXv4898Ldk");
    expect(schema.embedUrl).toBe("https://www.youtube-nocookie.com/embed/cvXv4898Ldk?rel=0");
    expect(schema.thumbnailUrl).toBe("https://i.ytimg.com/vi/cvXv4898Ldk/maxresdefault.jpg");
  });
});
