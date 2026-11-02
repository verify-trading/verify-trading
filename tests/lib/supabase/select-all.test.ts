import { describe, expect, it } from "vitest";

import { selectAll } from "@/lib/supabase/select-all";

describe("selectAll", () => {
  it("reads past Supabase's 1,000-row cap", async () => {
    const table = Array.from({ length: 2345 }, (_, i) => i);
    const rows = await selectAll(async (from, to) => ({ data: table.slice(from, Math.min(to + 1, from + 1000)), error: null }));
    expect(rows).toHaveLength(2345);
  });

  it("throws on a failed page", async () => {
    await expect(selectAll(async () => ({ data: null, error: { message: "boom" } }))).rejects.toThrow("boom");
  });
});
