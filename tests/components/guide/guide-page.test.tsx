// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import GuidePage, { metadata } from "@/app/(app)/guide/page";
import { GUIDE_DESCRIPTION, GUIDE_SETUP_STEPS, PROMPT_GROUPS } from "@/components/guide/guide-article";

afterEach(cleanup);

describe("/guide", () => {
  it("renders real HTML content, not just slide images", () => {
    const { container } = render(<GuidePage />);
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(container.querySelectorAll("h2").length).toBeGreaterThanOrEqual(5);
    const text = container.textContent ?? "";
    for (const step of GUIDE_SETUP_STEPS) expect(text).toContain(step.title);
    for (const group of PROMPT_GROUPS) expect(screen.getByRole("heading", { name: group.title })).toBeTruthy();
  });

  it("gives every slide image descriptive alt text", () => {
    const { container } = render(<GuidePage />);
    const imgs = Array.from(container.querySelectorAll("img"));
    expect(imgs.length).toBeGreaterThan(0);
    for (const img of imgs) expect(img.getAttribute("alt")?.length ?? 0).toBeGreaterThan(20);
  });

  it("owns its own scroll, since the app shell clips overflow", () => {
    const { container } = render(<GuidePage />);
    expect(container.firstElementChild?.className).toContain("overflow-y-auto");
  });

  it("links out to the core product pages", () => {
    const { container } = render(<GuidePage />);
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    for (const h of ["/tools", "/verify/brokers", "/verify/prop-firms", "/how-it-works", "/ask"]) expect(hrefs).toContain(h);
  });

  it("ships HowTo and TechArticle JSON-LD", () => {
    const { container } = render(<GuidePage />);
    const types = Array.from(container.querySelectorAll('script[type="application/ld+json"]')).map((s) => JSON.parse(s.textContent ?? "{}")["@type"]);
    expect(types).toEqual(expect.arrayContaining(["HowTo", "TechArticle", "BreadcrumbList", "FAQPage"]));
  });

  it("has a title and description inside the SEO length limits", () => {
    const title = `${metadata.title} | verify.trading`;
    expect(title.length).toBeGreaterThanOrEqual(50);
    expect(title.length).toBeLessThanOrEqual(60);
    expect(GUIDE_DESCRIPTION.length).toBeGreaterThanOrEqual(140);
    expect(GUIDE_DESCRIPTION.length).toBeLessThanOrEqual(155);
  });
});
