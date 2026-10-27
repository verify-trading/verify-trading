import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resendSend = vi.fn();

vi.mock("@/lib/email/client", () => ({
  getResendClient: () => ({ emails: { send: resendSend } }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/email/lifecycle/emails", () => ({
  renderLifecycleEmail: vi.fn(() => ({ subject: "Subject", sender: "ai", html: "<p>Hi</p>", text: "Hi" })),
}));

vi.mock("@/lib/email/lifecycle/unsubscribe", () => ({
  buildUnsubscribeUrl: vi.fn((userId: string) => `https://www.verify.trading/api/email/unsubscribe?u=${userId}&t=x`),
  canSignUnsubscribe: vi.fn(() => true),
}));

import { renderLifecycleEmail } from "@/lib/email/lifecycle/emails";
import { sendLifecycleEmail } from "@/lib/email/lifecycle/send";
import type { SendLifecycleEmailInput } from "@/lib/email/lifecycle/types";
import { canSignUnsubscribe } from "@/lib/email/lifecycle/unsubscribe";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const UNSUB = "https://www.verify.trading/api/email/unsubscribe?u=user-1&t=x";

const input: SendLifecycleEmailInput = {
  userId: "user-1",
  to: "trader@example.com",
  emailId: "e2a",
  dedupeKey: "e2a",
  kind: "marketing",
  variant: null,
  vars: { firstName: "Afaq" },
};

const CLAIMED_AT = "2026-10-26T12:00:00.000Z";

function createSupabaseMock({
  status = "sending", claimed = true, claimError = null as unknown,
  firstAttemptAt = CLAIMED_AT, savedPayload = null as unknown, updateError = null as unknown,
} = {}) {
  const update = vi.fn();
  const updateEq = vi.fn();
  const chain = { eq: updateEq, then: undefined as unknown };
  updateEq.mockReturnValue(chain);
  // A fluent PostgREST update is awaited only after both ownership predicates.
  chain.then = (resolve: (value: unknown) => void) => Promise.resolve({ error: updateError }).then(resolve);
  const rpc = vi.fn((_name: string, args: { p_payload: unknown }) => Promise.resolve({
    data: claimed ? [{ id: "send-1", status, payload: savedPayload ?? args.p_payload,
      first_attempt_at: firstAttemptAt, processing_started_at: CLAIMED_AT }] : [],
    error: claimError,
  }));
  const client = {
    rpc,
    from: vi.fn(() => ({ update: (payload: unknown) => { update(payload); return chain; } })),
  };
  vi.mocked(getSupabaseAdminClient).mockReturnValue(client as never);
  return { rpc, update, updateEq };
}

describe("sendLifecycleEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM_SIGNUP", "verify.trading <ai@verify.trading>");
    vi.stubEnv("EMAIL_FROM_SUBSCRIPTION", "verify.trading <pro@verify.trading>");
    resendSend.mockResolvedValue({ data: { id: "re_123" }, error: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("skips without touching the database when email is not configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const calls = createSupabaseMock();

    expect(await sendLifecycleEmail(input)).toBe("skipped");
    expect(calls.rpc).not.toHaveBeenCalled();
    expect(resendSend).not.toHaveBeenCalled();
  });

  it("returns duplicate and never calls Resend when the claim already exists", async () => {
    const calls = createSupabaseMock({ status: "sent" });

    expect(await sendLifecycleEmail(input)).toBe("duplicate");
    expect(calls.rpc).toHaveBeenCalledWith(
      "claim_lifecycle_email",
      expect.objectContaining({ p_user_id: "user-1", p_email_id: "e2a", p_dedupe_key: "e2a", p_kind: "marketing" }),
    );
    expect(resendSend).not.toHaveBeenCalled();
  });

  it("returns failed without calling Resend when the claim errors", async () => {
    createSupabaseMock({ claimError: { message: "db down" } });

    expect(await sendLifecycleEmail(input)).toBe("failed");
    expect(resendSend).not.toHaveBeenCalled();
  });

  it("sends with unsubscribe headers and idempotency key, then stores the resend id", async () => {
    const calls = createSupabaseMock();

    expect(await sendLifecycleEmail(input)).toBe("sent");
    expect(renderLifecycleEmail).toHaveBeenCalledWith("e2a", { firstName: "Afaq" }, UNSUB);
    expect(resendSend).toHaveBeenCalledWith(
      {
        from: "verify.trading <ai@verify.trading>",
        to: "trader@example.com",
        subject: "Subject",
        text: "Hi",
        html: "<p>Hi</p>",
        headers: {
          "List-Unsubscribe": `<${UNSUB}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      },
      { idempotencyKey: "user-1:e2a" },
    );
    expect(calls.update).toHaveBeenCalledWith({ status: "sent", resend_id: "re_123", sent_at: expect.any(String), processing_started_at: null });
    expect(calls.updateEq).toHaveBeenCalledWith("id", "send-1");
  });

  it("sends emails rendered with the pro sender from the subscription address", async () => {
    vi.mocked(renderLifecycleEmail).mockReturnValueOnce({ subject: "S", sender: "pro", html: "<p>Hi</p>", text: "Hi" });
    createSupabaseMock();

    await sendLifecycleEmail({ ...input, emailId: "c4", dedupeKey: "c4" });

    expect(resendSend.mock.calls[0]?.[0]).toMatchObject({ from: "verify.trading <pro@verify.trading>" });
  });

  it("keeps the payload and releases the lease when Resend rejects an attempt", async () => {
    resendSend.mockResolvedValue({ data: null, error: { message: "rate limited", statusCode: 429 } });
    const calls = createSupabaseMock();

    expect(await sendLifecycleEmail(input)).toBe("failed");
    expect(calls.update).toHaveBeenCalledWith({ status: "pending", processing_started_at: null, first_attempt_at: null });
    expect(calls.updateEq).toHaveBeenCalledWith("processing_started_at", CLAIMED_AT);
  });

  it("does not claim an email when the unsubscribe secret is missing", async () => {
    vi.mocked(canSignUnsubscribe).mockReturnValueOnce(false);
    const calls = createSupabaseMock();

    expect(await sendLifecycleEmail(input)).toBe("failed");
    expect(resendSend).not.toHaveBeenCalled();
    expect(calls.rpc).not.toHaveBeenCalled();
  });

  it("still sends account emails (C5) without the header when the unsubscribe secret is missing", async () => {
    vi.mocked(canSignUnsubscribe).mockReturnValueOnce(false);
    createSupabaseMock();

    const result = await sendLifecycleEmail({ ...input, emailId: "c5", dedupeKey: "c5:sub_1", kind: "transactional" });

    expect(result).toBe("sent");
    expect(resendSend).toHaveBeenCalledTimes(1);
    expect(resendSend.mock.calls[0][0].headers).toBeUndefined();
  });
});

describe("lifecycle send recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("RESEND_API_KEY", "re_test");
    resendSend.mockResolvedValue({ data: { id: "re_recovered" }, error: null });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("replays the persisted payload even when newly rendered content changes", async () => {
    const savedPayload = { from: "old@example.com", to: input.to, subject: "Original", html: "Original HTML", text: "Original", idempotencyKey: "user-1:e2a" };
    createSupabaseMock({ savedPayload, firstAttemptAt: "2026-10-26T11:00:00.000Z" });
    expect(await sendLifecycleEmail(input)).toBe("sent");
    expect(resendSend).toHaveBeenCalledWith(
      { from: savedPayload.from, to: savedPayload.to, subject: savedPayload.subject, html: savedPayload.html, text: savedPayload.text, headers: undefined },
      { idempotencyKey: "user-1:e2a" },
    );
  });

  it("does not send while a sibling holds the lease", async () => {
    createSupabaseMock({ claimed: false });
    expect(await sendLifecycleEmail(input)).toBe("skipped");
    expect(resendSend).not.toHaveBeenCalled();
  });

  it("does not resend outside the safe idempotency retry window", async () => {
    createSupabaseMock({ status: "blocked" });
    expect(await sendLifecycleEmail(input)).toBe("skipped");
    expect(resendSend).not.toHaveBeenCalled();
  });

  it.each([null, 409, 500])("preserves the first-attempt time on an ambiguous error (%s)", async (statusCode) => {
    resendSend.mockResolvedValue({ data: null, error: { message: "uncertain", statusCode } });
    const calls = createSupabaseMock();
    expect(await sendLifecycleEmail(input)).toBe("failed");
    expect(calls.update).toHaveBeenCalledWith({ status: "pending", processing_started_at: null, first_attempt_at: CLAIMED_AT });
  });

  it("does not reset an earlier ambiguous attempt after a later rate limit", async () => {
    const firstAttemptAt = "2026-10-26T11:00:00.000Z";
    resendSend.mockResolvedValue({ data: null, error: { message: "rate limited", statusCode: 429 } });
    const calls = createSupabaseMock({ firstAttemptAt });
    await sendLifecycleEmail(input);
    expect(calls.update).toHaveBeenCalledWith({ status: "pending", processing_started_at: null, first_attempt_at: firstAttemptAt });
  });

  it("leaves a failed success write recoverable instead of deleting the claim", async () => {
    const calls = createSupabaseMock({ updateError: { message: "db down" } });
    expect(await sendLifecycleEmail(input)).toBe("failed");
    expect(calls.update).toHaveBeenCalledTimes(1);
    expect(calls.update).toHaveBeenCalledWith(expect.objectContaining({ status: "sent", resend_id: "re_recovered" }));
  });
});
