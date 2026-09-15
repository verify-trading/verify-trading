import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({ getSessionUser: vi.fn() }));

import { getSessionUser } from "@/lib/auth/session";
import { POST as postReport } from "@/app/api/moderation/reports/route";
import { GET as getBlocks, POST as postBlock } from "@/app/api/moderation/blocks/route";

const USER = "10000000-0000-4000-8000-000000000001";
const OTHER = "10000000-0000-4000-8000-000000000002";
const AI_MESSAGE = "10000000-0000-4000-8000-000000000010";

type FakeOptions = {
  aiTarget?: boolean;
  communityTarget?: { id: string; user_id: string; room_id: string } | null;
  reportCount?: number;
  duplicateCount?: number;
  blocks?: Array<{ blocked_user_id: string }>;
  insertError?: { message: string } | null;
};

function fakeSupabase(options: FakeOptions = {}) {
  const calls = { reportInsert: 0, reportRpc: 0, blockUpsert: 0 };
  let reportSelects = 0;
  const builder = (table: string) => {
    let head = false;
    const chain: Record<string, (...args: never[]) => unknown> = {};
    chain.select = ((_: unknown, config?: { count?: string }) => { head = config?.count === "exact"; return chain; }) as never;
    chain.eq = (() => chain) as never;
    chain.gte = (() => chain) as never;
    chain.maybeSingle = (() => Promise.resolve({
      data: table === "chat_messages" ? (options.aiTarget ? { id: AI_MESSAGE } : null) : (options.communityTarget ?? null),
      error: null,
    })) as never;
    chain.insert = (() => { calls.reportInsert += 1; return Promise.resolve({ error: options.insertError ?? null }); }) as never;
    chain.upsert = (() => { calls.blockUpsert += 1; return Promise.resolve({ error: null }); }) as never;
    chain.rpc = (() => {
      calls.reportRpc += 1;
      const result = options.reportCount && options.reportCount >= 20 ? "rate_limited" : options.duplicateCount ? "duplicate" : "submitted";
      return Promise.resolve({ data: result, error: null });
    }) as never;
    chain.then = ((resolve: (value: unknown) => unknown) => Promise.resolve(resolve({
      count: table === "moderation_reports" && head ? (reportSelects++ === 0 ? (options.reportCount ?? 0) : (options.duplicateCount ?? 0)) : null,
      data: table === "user_blocks" ? (options.blocks ?? []) : null,
      error: null,
    }))) as never;
    return chain;
  };
  return { supabase: { from: vi.fn((table: string) => builder(table)), rpc: vi.fn((_name: string, _args: unknown) => builder("moderation_reports").rpc!()) }, calls };
}

function session(options: FakeOptions = {}) {
  const fake = fakeSupabase(options);
  vi.mocked(getSessionUser).mockResolvedValue({ user: { id: USER }, supabase: fake.supabase } as never);
  return fake;
}

function request(body: unknown) {
  return new Request("http://localhost/api/moderation/reports", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
}

describe("moderation routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires ownership of generated AI responses and persists valid reports", async () => {
    session({ aiTarget: false });
    const denied = await postReport(request({ category: "ai_response", reason: "other", source: "ask", sourceId: AI_MESSAGE }));
    expect(denied.status).toBe(404);

    const valid = session({ aiTarget: true });
    const accepted = await postReport(request({ category: "ai_response", reason: "other", source: "ask", sourceId: AI_MESSAGE }));
    expect(accepted.status).toBe(201);
    expect(valid.calls.reportRpc).toBe(1);
  });

  it("returns idempotently for duplicates and rejects rate-limited reporters", async () => {
    const duplicate = session({ aiTarget: true, duplicateCount: 1 });
    const duplicateResponse = await postReport(request({ category: "ai_response", reason: "spam", source: "ask", sourceId: AI_MESSAGE }));
    expect(duplicateResponse.status).toBe(200);
    expect(duplicate.calls.reportRpc).toBe(0);

    session({ aiTarget: true, reportCount: 20 });
    const limited = await postReport(request({ category: "ai_response", reason: "spam", source: "ask", sourceId: AI_MESSAGE }));
    expect(limited.status).toBe(429);
  });

  it("keeps self-reporting and self-blocking invalid", async () => {
    session({ communityTarget: { id: AI_MESSAGE, user_id: USER, room_id: OTHER } });
    const report = await postReport(request({ category: "community_user", reason: "other", messageId: AI_MESSAGE, targetUserId: USER }));
    expect(report.status).toBe(400);

    const block = await postBlock(new Request("http://localhost/api/moderation/blocks", { method: "POST", body: JSON.stringify({ targetUserId: USER }) }));
    expect(block.status).toBe(400);
  });

  it("returns only the signed-in user's blocked list", async () => {
    session({ blocks: [{ blocked_user_id: OTHER }] });
    const response = await getBlocks();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ blockedUserIds: [OTHER] });
  });
});
