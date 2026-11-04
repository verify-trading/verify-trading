// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

import { CountryVerdict } from "@/components/marketing/country-verdict";

const props = { verdict: "Verified" as const, score: 93, basis: "baseline" as const, checkedAt: null, countryScores: { GB: { score: 81, verdict: "Generally positive" as const, checkedAt: "2026-11-04T10:00:00Z" } } };

describe("CountryVerdict", () => {
  afterEach(() => { document.cookie = "vt_country=; max-age=0; path=/"; });

  it("shows the visitor's official country score, the same one Ask gives", () => {
    document.cookie = "vt_country=GB; path=/";
    render(<CountryVerdict {...props} />);
    expect(screen.getByText("81")).toBeInTheDocument();
    expect(screen.getByText(/Official score for United Kingdom · checked 4 Nov 2026/)).toBeInTheDocument();
  });

  it("falls back to the global score, labelled as baseline while verification is pending", () => {
    document.cookie = "vt_country=DE; path=/";
    render(<CountryVerdict {...props} />);
    expect(screen.getByText("93")).toBeInTheDocument();
    expect(screen.getByText("Baseline score · independent verification pending")).toBeInTheDocument();
  });
});
