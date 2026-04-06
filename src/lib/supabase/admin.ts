import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabaseAdminClient: SupabaseClient | null | undefined;
let hasLoadedNodeEnv = false;

function ensureSupabaseEnv() {
  if (hasLoadedNodeEnv || typeof window !== "undefined") {
    return;
  }

  loadEnvConfig(process.cwd());
  hasLoadedNodeEnv = true;
}

export function hasSupabaseAdminConfig() {
  ensureSupabaseEnv();

  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function getSupabaseAdminClient() {
  if (!hasSupabaseAdminConfig()) {
    return null;
  }

  if (supabaseAdminClient === undefined) {
    supabaseAdminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  return supabaseAdminClient;
}
