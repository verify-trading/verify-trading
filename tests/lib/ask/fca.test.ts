import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getFcaStatus } from "@/lib/ask/fca";

describe("getFcaStatus", () => {
  const originalFetch = global.fetch;
  const originalLookupUrl = process.env.FCA_FIRM_LOOKUP_URL;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalLookupUrl === undefined) {
      delete process.env.FCA_FIRM_LOOKUP_URL;
    } else {
      process.env.FCA_FIRM_LOOKUP_URL = originalLookupUrl;
    }
  });

  it("falls back to reviewed seed data when live lookup is not configured", async () => {
    delete process.env.FCA_FIRM_LOOKUP_URL;

    const result = await getFcaStatus({ name: "Pepperstone" });

    expect(result.available).toBe(false);
    expect(result.authorised).toBe(true);
    expect(result.frn).toBe("684312");
  });

  it("parses a configured live FCA response", async () => {
    process.env.FCA_FIRM_LOOKUP_URL = "https://example.com/fca";
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Status: "FSR-API-02-01-00",
          Data: [
            {
              FRN: "684312",
              Status: "Authorised",
              "Business Type": "Regulated",
              "Exceptional Info Details": [],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Status: "FSR-API-02-09-00",
          Data: [
            {
              "Regulator Name": "Financial Conduct Authority",
            },
          ],
        }),
      }) as unknown as typeof fetch;

    const result = await getFcaStatus({ name: "Pepperstone", frn: "684312" });

    expect(result.available).toBe(true);
    expect(result.authorised).toBe(true);
    expect(result.warning).toBe(false);
    expect(result.frn).toBe("684312");
    expect(result.note).toContain("Regulators: Financial Conduct Authority");
  });

  it("falls back to seed data when the live lookup fails", async () => {
    process.env.FCA_FIRM_LOOKUP_URL = "https://example.com/fca";
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    }) as unknown as typeof fetch;

    const result = await getFcaStatus({ name: "Pepperstone" });

    expect(result.available).toBe(false);
    expect(result.authorised).toBe(true);
    expect(result.source).toContain("FCA Register");
  });

  it("falls back cleanly when the live payload is malformed", async () => {
    process.env.FCA_FIRM_LOOKUP_URL = "https://example.com/fca";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        Data: "broken",
      }),
    }) as unknown as typeof fetch;

    const result = await getFcaStatus({ name: "Pepperstone" });

    expect(result.available).toBe(false);
    expect(result.authorised).toBe(true);
    expect(result.frn).toBe("684312");
  });

  it("returns an unavailable result when no live lookup or reviewed fallback exists", async () => {
    delete process.env.FCA_FIRM_LOOKUP_URL;

    const result = await getFcaStatus({ name: "Unknown Broker 123" });

    expect(result.available).toBe(false);
    expect(result.authorised).toBeNull();
    expect(result.source).toBe("FCA lookup not configured");
  });

  it("retries a transient FCA failure before succeeding", async () => {
    process.env.FCA_FIRM_LOOKUP_URL = "https://example.com/fca";
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Status: "FSR-API-02-01-00",
          Data: [
            {
              FRN: "684312",
              Status: "Authorised",
              "Business Type": "Regulated",
              "Exceptional Info Details": [],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Status: "FSR-API-02-09-00",
          Data: [],
        }),
      }) as unknown as typeof fetch;

    const result = await getFcaStatus({ name: "Pepperstone", frn: "684312" });

    expect(result.available).toBe(true);
    expect(result.frn).toBe("684312");
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it("returns a live unavailable result when no FRN is available for lookup", async () => {
    process.env.FCA_FIRM_LOOKUP_URL = "https://example.com/fca";

    const result = await getFcaStatus({ name: "Unknown Broker 123" });

    expect(result.available).toBe(false);
    expect(result.frn).toBeNull();
    expect(result.note).toContain("No FRN was available");
  });

  it("falls back to reviewed data when the FCA request throws", async () => {
    process.env.FCA_FIRM_LOOKUP_URL = "https://example.com/fca";
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    const result = await getFcaStatus({ name: "Pepperstone" });

    expect(result.available).toBe(false);
    expect(result.authorised).toBe(true);
    expect(result.source).toContain("FCA Register");
  });
});
