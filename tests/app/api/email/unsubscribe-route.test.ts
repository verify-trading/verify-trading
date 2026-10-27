import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/observability/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { GET, POST } from "@/app/api/email/unsubscribe/route";
import { signUnsubscribeToken } from "@/lib/email/lifecycle/unsubscribe";
import { logger } from "@/lib/observability/logger";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const USER = "3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b";

type DbError = { message: string } | null;

/** Records profile reads and writes; returns `profile` for reads and `error` for both. */
function fakeAdmin({ profile = null, error = null }: { profile?: unknown; error?: DbError } = {}) {
  const calls = {
    from: [] as string[],
    select: [] as string[],
    update: [] as Array<Record<string, unknown>>,
    eq: [] as Array<[string, string]>,
  };
  const client = {
    from(table: string) {
      calls.from.push(table);
      return {
        select(columns: string) {
          calls.select.push(columns);
          return {
            eq(column: string, value: string) {
              calls.eq.push([column, value]);
              return { maybeSingle: async () => ({ data: error ? null : profile, error }) };
            },
          };
        },
        update(values: Record<string, unknown>) {
          calls.update.push(values);
          return {
            eq: async (column: string, value: string) => {
              calls.eq.push([column, value]);
              return { error };
            },
          };
        },
      };
    },
  };
  vi.mocked(getSupabaseAdminClient).mockReturnValue(client as never);
  return calls;
}

function link(token = signUnsubscribeToken(USER), userId = USER) {
  return `https://www.verify.trading/api/email/unsubscribe?${new URLSearchParams({ u: userId, t: token })}`;
}

function post(url: string, body: string) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

describe("/api/email/unsubscribe", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "test-secret-test-secret-test-secret");
    vi.mocked(getSupabaseAdminClient).mockReset();
    vi.mocked(logger.error).mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects a bad or missing token with 400 and touches nothing", async () => {
    const calls = fakeAdmin({ profile: { email_opt_out_at: null } });
    const bad = link("x".repeat(43));

    for (const response of [
      await GET(new Request(bad)),
      await GET(new Request("https://www.verify.trading/api/email/unsubscribe")),
      await POST(post(bad, "List-Unsubscribe=One-Click")),
      await POST(post(link(signUnsubscribeToken(USER), "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"), "")),
    ]) {
      expect(response.status).toBe(400);
      expect(await response.text()).toContain("This link isn&#39;t valid.");
    }
    expect(calls.from).toEqual([]);
    expect(calls.update).toEqual([]);
  });

  it("GET for a subscribed user shows the Unsubscribe form and writes nothing", async () => {
    const calls = fakeAdmin({ profile: { email_opt_out_at: null } });
    const response = await GET(new Request(link()));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(html).toContain("Unsubscribe from verify.trading emails?");
    expect(html).toContain("You&#39;ll still get emails about your account and billing.");
    expect(html).toContain('<form method="post"');
    expect(html).toContain(`action="/api/email/unsubscribe?u=${USER}&amp;t=`);
    expect(html).toContain(">Unsubscribe</button>");
    expect(calls.select).toEqual(["email_opt_out_at"]);
    expect(calls.eq).toEqual([["id", USER]]);
    expect(calls.update).toEqual([]);
  });

  it("GET for an opted-out user offers Resubscribe", async () => {
    const calls = fakeAdmin({ profile: { email_opt_out_at: "2026-10-01T00:00:00.000Z" } });
    const html = await (await GET(new Request(link()))).text();

    expect(html).toContain("You&#39;re unsubscribed.");
    expect(html).toContain('<input type="hidden" name="action" value="resubscribe">');
    expect(html).toContain(">Resubscribe</button>");
    expect(calls.update).toEqual([]);
  });

  it("POST one-click sets email_opt_out_at to now", async () => {
    const calls = fakeAdmin();
    const response = await POST(post(link(), "List-Unsubscribe=One-Click"));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("You won&#39;t get any more of these emails.");
    expect(calls.from).toEqual(["profiles"]);
    expect(calls.eq).toEqual([["id", USER]]);
    expect(calls.update).toHaveLength(1);
    const optOut = calls.update[0].email_opt_out_at as string;
    expect(Number.isNaN(Date.parse(optOut))).toBe(false);
    expect(Math.abs(Date.now() - Date.parse(optOut))).toBeLessThan(5000);
  });

  it("POST action=resubscribe clears email_opt_out_at", async () => {
    const calls = fakeAdmin();
    const response = await POST(post(link(), "action=resubscribe"));

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("You&#39;re subscribed again.");
    expect(calls.update).toEqual([{ email_opt_out_at: null }]);
    expect(calls.eq).toEqual([["id", USER]]);
  });

  it("returns 500 and logs on a database error", async () => {
    fakeAdmin({ error: { message: "boom" } });

    for (const response of [
      await GET(new Request(link())),
      await POST(post(link(), "List-Unsubscribe=One-Click")),
    ]) {
      expect(response.status).toBe(500);
      expect(await response.text()).toContain("Something went wrong. Please try again.");
    }
    expect(logger.error).toHaveBeenCalledTimes(2);
  });

  it("returns 500 when the admin client is missing", async () => {
    vi.mocked(getSupabaseAdminClient).mockReturnValue(null);
    expect((await POST(post(link(), "List-Unsubscribe=One-Click"))).status).toBe(500);
    expect(logger.error).toHaveBeenCalled();
  });
});
