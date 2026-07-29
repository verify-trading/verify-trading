import { vi } from "vitest";

import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Shared stand-ins for the broker route tests. The importing test file still owns the
 * vi.mock calls for "@/lib/auth/session" and "@/lib/supabase/admin" — those are hoisted
 * per file — this only drives the mocks they install.
 */

// Chainable thenable stand-in for a PostgREST query: every builder method returns the
// builder, awaiting it (or .single()/.maybeSingle()) resolves the provided result.
export function createQueryBuilder(
  result: { data?: unknown; error?: unknown } = { data: null, error: null },
) {
  const builder = {} as Record<string, ReturnType<typeof vi.fn>> & PromiseLike<unknown>;

  for (const method of ["select", "eq", "is", "not", "or", "in", "order", "limit", "insert", "update", "upsert", "delete"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.single = vi.fn().mockResolvedValue(result);
  builder.maybeSingle = vi.fn().mockResolvedValue(result);
  builder.then = (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected);

  return builder;
}

export type Builder = ReturnType<typeof createQueryBuilder>;

/** Hands each table its queued builders in call order, then repeats the last one. */
export function createFrom(tables: Record<string, Builder[]>) {
  const counters: Record<string, number> = {};
  return vi.fn((table: string) => {
    const queue = tables[table] ?? [createQueryBuilder()];
    const index = Math.min(counters[table] ?? 0, queue.length - 1);
    counters[table] = index + 1;
    return queue[index];
  });
}

export function mockSession(tier: string | null = "pro") {
  vi.mocked(getSessionUser).mockResolvedValue({
    user: { id: "user-1" },
    supabase: { from: createFrom({ profiles: [createQueryBuilder({ data: { tier }, error: null })] }) },
  } as never);
}

export function mockAdmin(tables: Record<string, Builder[]>) {
  const from = createFrom(tables);
  vi.mocked(getSupabaseAdminClient).mockReturnValue({ from } as never);
  return from;
}
