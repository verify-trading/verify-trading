// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/landing/hero-gold", () => ({
  getHeroGoldBriefing: vi.fn().mockResolvedValue({ price: "$4,118" }),
}));

vi.mock("@/components/landing/landing-page", () => ({
  LandingPage: ({ liveGold }: { liveGold: { price: string } | null }) => (
    <div>Landing with gold {liveGold?.price}</div>
  ),
}));

import Home from "@/app/page";

describe("Home page", () => {
  it("hands the live gold briefing to the landing page", async () => {
    render(await Home());
    expect(screen.getByText("Landing with gold $4,118")).toBeInTheDocument();
  });
});
