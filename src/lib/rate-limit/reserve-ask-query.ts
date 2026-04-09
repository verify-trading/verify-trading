import type { SupabaseClient } from "@supabase/supabase-js";

export type ReserveAskResult =
  | { ok: true; tier: "free" | "pro"; remaining: number | null }
  | { ok: false; reason: string; remaining?: number };

type RpcPayload = {
  ok?: boolean;
  reason?: string;
  tier?: string;
  remaining?: number | null;
};

export async function reserveAskQuery(supabase: SupabaseClient): Promise<ReserveAskResult> {
  const { data, error } = await supabase.rpc("reserve_ask_query");

  if (error) {
    throw new Error(error.message);
  }

  const row = data as RpcPayload | null;
  if (!row || typeof row !== "object") {
    throw new Error("Invalid reserve_ask_query response.");
  }

  if (row.ok === true) {
    return {
      ok: true,
      tier: row.tier === "pro" ? "pro" : "free",
      remaining: row.remaining === null || row.remaining === undefined ? null : Number(row.remaining),
    };
  }

  return {
    ok: false,
    reason: typeof row.reason === "string" ? row.reason : "unknown",
    remaining: row.remaining !== undefined && row.remaining !== null ? Number(row.remaining) : undefined,
  };
}
