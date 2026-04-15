import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

import { createSupabasePersistence } from "@/lib/ask/persistence/supabase";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

describe("createSupabasePersistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes stored Ask attachments before removing the session row", async () => {
    const list = vi.fn().mockResolvedValue({
      data: [{ name: "one.png" }, { name: "two.webp" }],
      error: null,
    });
    const remove = vi.fn().mockResolvedValue({ data: null, error: null });
    const deleteSecondEq = vi.fn().mockResolvedValue({ error: null });
    const deleteFirstEq = vi.fn(() => ({ eq: deleteSecondEq }));
    const deleteTable = vi.fn(() => ({ eq: deleteFirstEq }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          list,
          remove,
        })),
      },
      from: vi.fn((table: string) => {
        if (table !== "chat_sessions") {
          throw new Error(`Unexpected table: ${table}`);
        }

        return {
          delete: deleteTable,
        };
      }),
    } as never);

    const persistence = createSupabasePersistence("user-1");
    await persistence.deleteSession("session-1");

    expect(list).toHaveBeenCalledWith("user-1/session-1", { limit: 1000 });
    expect(remove).toHaveBeenCalledWith([
      "user-1/session-1/one.png",
      "user-1/session-1/two.webp",
    ]);
    expect(deleteTable).toHaveBeenCalledTimes(1);
    expect(deleteFirstEq).toHaveBeenCalledWith("id", "session-1");
    expect(deleteSecondEq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("skips storage removal when the session folder is empty", async () => {
    const list = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const remove = vi.fn();
    const deleteSecondEq = vi.fn().mockResolvedValue({ error: null });
    const deleteFirstEq = vi.fn(() => ({ eq: deleteSecondEq }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          list,
          remove,
        })),
      },
      from: vi.fn(() => ({
        delete: vi.fn(() => ({ eq: deleteFirstEq })),
      })),
    } as never);

    const persistence = createSupabasePersistence("user-1");
    await persistence.deleteSession("session-1");

    expect(remove).not.toHaveBeenCalled();
    expect(deleteSecondEq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("loads stored session memory for a user-owned thread", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        memory_summary: {
          activeAsset: "GOLD / XAUUSD",
          lastCardType: "setup",
          activeSide: "buy",
        },
      },
      error: null,
    });
    const secondEq = vi.fn(() => ({ maybeSingle }));
    const firstEq = vi.fn(() => ({ eq: secondEq }));
    const select = vi.fn(() => ({ eq: firstEq }));

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table !== "chat_sessions") {
          throw new Error(`Unexpected table: ${table}`);
        }

        return { select };
      }),
    } as never);

    const persistence = createSupabasePersistence("user-1");

    await expect(persistence.loadSessionMemory("session-1")).resolves.toEqual({
      activeAsset: "GOLD / XAUUSD",
      lastCardType: "setup",
      activeSide: "buy",
    });
    expect(select).toHaveBeenCalledWith("memory_summary");
    expect(firstEq).toHaveBeenCalledWith("id", "session-1");
    expect(secondEq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("stores session memory when saving an exchange", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const selectEq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq: selectEq }));
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const insert = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "chat_sessions") {
          return {
            select,
            upsert,
          };
        }

        if (table === "chat_messages") {
          return {
            insert,
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const persistence = createSupabasePersistence("user-1");
    await persistence.saveExchange({
      sessionId: "session-1",
      userMessage: "Should I buy gold?",
      assistantCard: {
        type: "insight",
        headline: "Wait First",
        body: "Let price confirm before you commit.",
        verdict: "Wait for confirmation.",
      },
      sessionMemory: {
        activeAsset: "GOLD / XAUUSD",
        lastCardType: "insight",
        recentUserGoals: ["Should I buy gold?"],
      },
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "session-1",
        user_id: "user-1",
        memory_summary: {
          activeAsset: "GOLD / XAUUSD",
          lastCardType: "insight",
          recentUserGoals: ["Should I buy gold?"],
        },
        memory_updated_at: expect.any(String),
      }),
      { onConflict: "id" },
    );
    expect(insert).toHaveBeenCalledTimes(1);
  });
});
