import type { getSessionUser } from "@/lib/auth/session";

type Session = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;

/**
 * True when the signed-in user holds Pro. `profiles.tier` is the authoritative
 * entitlement (Stripe webhooks write it); the read is user-scoped so RLS applies.
 * Fails closed — a lookup error is treated as "not Pro" rather than granting access.
 */
export async function hasProAccess(session: Session): Promise<boolean> {
  const { data, error } = await session.supabase
    .from("profiles")
    .select("tier")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error) return false;
  return (data as { tier: string | null } | null)?.tier === "pro";
}
