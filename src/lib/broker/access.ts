import type { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSessionUser } from "@/lib/auth/session";
import { hasProAccess } from "@/lib/billing/require-pro";
import { jsonApiError, jsonUnauthorized } from "@/lib/http/json-response";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type BrokerAccess =
  | { ok: true; userId: string; admin: SupabaseClient }
  | { ok: false; response: NextResponse };

/**
 * Broker API access: signed-in Pro users only, mirroring requireMarketsProSession. Every connected
 * account costs real money per month, so this gate is the budget.
 *
 * Hands back the service-role client too: broker_accounts is service-role-write (RLS lets the
 * owner read their row and nothing more) and the importer writes journal rows on the trader's
 * behalf. Every query is scoped by the userId returned here.
 */
export async function requireBrokerProSession(): Promise<BrokerAccess> {
  const session = await getSessionUser();
  if (!session) {
    return { ok: false, response: jsonUnauthorized("Sign in to connect your broker.") };
  }

  if (!(await hasProAccess(session))) {
    return {
      ok: false,
      response: jsonApiError(403, "broker_pro_required", "Broker sync is a Pro feature."),
    };
  }

  return withAdmin(session.user.id);
}

/**
 * Signed in, Pro or not — for the broker actions that must not require Pro: reading the connection
 * and disconnecting it. Gating those behind Pro trapped a trader whose plan lapsed, leaving their
 * account at MetaApi costing us money with no way to switch it off short of resubscribing.
 */
export async function requireBrokerSession(): Promise<BrokerAccess> {
  const session = await getSessionUser();
  if (!session) {
    return { ok: false, response: jsonUnauthorized("Sign in to manage your broker connection.") };
  }
  return withAdmin(session.user.id);
}

function withAdmin(userId: string): BrokerAccess {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return {
      ok: false,
      response: jsonApiError(500, "broker_unconfigured", "Broker sync is not available right now."),
    };
  }

  return { ok: true, userId, admin };
}
