import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { effectiveNewsArchiveFromDate } from "@/lib/ask/newsdata";

describe("effectiveNewsArchiveFromDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("drops future YYYY-MM-DD so latest endpoint is used instead of bad archive", () => {
    expect(effectiveNewsArchiveFromDate("2026-04-23")).toBeUndefined();
  });

  it("keeps today and past dates", () => {
    expect(effectiveNewsArchiveFromDate("2026-04-06")).toBe("2026-04-06");
    expect(effectiveNewsArchiveFromDate("2026-03-01")).toBe("2026-03-01");
  });

  it("returns undefined for missing or invalid", () => {
    expect(effectiveNewsArchiveFromDate(undefined)).toBeUndefined();
    expect(effectiveNewsArchiveFromDate("")).toBeUndefined();
    expect(effectiveNewsArchiveFromDate("not-a-date")).toBeUndefined();
  });
});
