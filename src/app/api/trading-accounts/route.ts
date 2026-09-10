import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { jsonApiError, jsonUnauthorized, PRIVATE_CACHE_HEADERS } from "@/lib/http/json-response";

export type TradingAccountPayload = {
  id: string;
  name: string;
  kind: "connected" | "manual";
  /** Display identity for a connected account; null for a manual one. */
  server: string | null;
  /** What MetaApi says owns that server. Null means "not confirmed", NEVER "not a prop firm". */
  brokerName: string | null;
};

/**
 * The accounts a challenge can be attached to, and the entry form can log against. Archived ones
 * are left out: they still own history, but nothing new should land in them.
 */
export async function GET() {
  const session = await getSessionUser();
  if (!session) return jsonUnauthorized("Sign in to load your accounts.");

  const { data, error } = await session.supabase
    .from("trading_accounts")
    .select("id, name, kind, server, broker_name")
    .eq("user_id", session.user.id)
    .is("archived_at", null)
    .order("kind", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return jsonApiError(500, "trading_accounts_unavailable", "Could not load your accounts.");

  const accounts: TradingAccountPayload[] = (data ?? []).map((row) => {
    const account = row as { id: string; name: string; kind: "connected" | "manual"; server: string | null; broker_name: string | null };
    return {
      id: account.id,
      name: account.name,
      kind: account.kind,
      server: account.server,
      brokerName: account.broker_name,
    };
  });

  return NextResponse.json({ accounts }, { headers: PRIVATE_CACHE_HEADERS });
}
