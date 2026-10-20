// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PageHero, Section, Tldr } from "@/components/marketing/primitives";

afterEach(cleanup);

describe("Tldr", () => {
  it("renders every bullet inside a labelled landmark", () => {
    render(<Tldr items={["First point", "Second point"]} updated="Reviewed 20 Oct 2026" />);
    const box = screen.getByRole("complementary", { name: "TL;DR" });
    expect(box).toHaveTextContent("First point");
    expect(box).toHaveTextContent("Second point");
    expect(box).toHaveTextContent("Reviewed 20 Oct 2026");
  });

  it("renders nothing for an empty list", () => {
    const { container } = render(<Tldr items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("is shown in the hero when a page passes tldr", () => {
    render(<PageHero eyebrow="Compare" title="Title" lede="Lede" location="test" tldr={["Hero point"]} />);
    expect(screen.getByRole("complementary", { name: "TL;DR" })).toHaveTextContent("Hero point");
  });
});

describe("Section summary", () => {
  it("shows the takeaway and keeps the full body in the HTML behind Read more", () => {
    const { container } = render(
      <Section title="Drawdown" summary="Short takeaway">
        <p>Full explanation</p>
      </Section>,
    );
    expect(screen.getByText("Short takeaway")).toBeVisible();
    expect(screen.getByText("Read more")).toBeInTheDocument();
    // Collapsed content must stay in the markup so crawlers still index it.
    expect(container.querySelector("details")).toHaveTextContent("Full explanation");
  });

  it("renders the body open when there is no summary", () => {
    const { container } = render(
      <Section title="Plain">
        <p>Body</p>
      </Section>,
    );
    expect(container.querySelector("details")).toBeNull();
    expect(screen.getByText("Body")).toBeVisible();
  });
});
