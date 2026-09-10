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
  /** Retired by a replacement. Still owns history, so it must stay resolvable — see below. */
  archived: boolean;
};

/**
 * The accounts a challenge can be attached to, and the entry form can log against.
 *
 * Archived accounts ARE included, flagged. They cannot be chosen — the picker drops them — but a
 * challenge configured before a broker replacement still points at one, and omitting it made that
 * lookup fail and the dashboard label read "Tracking all journal entries" over figures that were
 * in fact scoped to a single account. A name that cannot be resolved is worse than a retired one.
 */
export async function GET() {
  const session = await getSessionUser();
  if (!session) return jsonUnauthorized("Sign in to load your accounts.");

  const { data, error } = await session.supabase
    .from("trading_accounts")
    .select("id, name, kind, server, broker_name, archived_at")
    .eq("user_id", session.user.id)
    .order("kind", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return jsonApiError(500, "trading_accounts_unavailable", "Could not load your accounts.");

  const accounts: TradingAccountPayload[] = (data ?? []).map((row) => {
    const account = row as { id: string; name: string; kind: "connected" | "manual"; server: string | null; broker_name: string | null; archived_at: string | null };
    return {
      id: account.id,
      name: account.name,
      kind: account.kind,
      server: account.server,
      brokerName: account.broker_name,
      archived: Boolean(account.archived_at),
    };
  });

  return NextResponse.json({ accounts }, { headers: PRIVATE_CACHE_HEADERS });
}
