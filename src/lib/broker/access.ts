import type { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSessionUser } from "@/lib/auth/session";
import { hasProAccess } from "@/lib/billing/require-pro";
import { jsonApiError, jsonUnauthorized } from "@/lib/http/json-response";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type BrokerAccess =
  | { ok: true; userId: string; admin: SupabaseClient }
  | { ok: false; response: NextResponse };

// Signed-in Pro only: every connected account costs money per month, so this gate is the budget.
// Hands back the service-role client because broker_accounts is service-role-write (RLS lets the
// owner read their own row and nothing more). Every query must be scoped by the userId returned.
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

// Signed in, Pro or not. Reading and disconnecting must not require Pro, or a lapsed trader has no
// way to switch off an account that keeps costing us money.
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
