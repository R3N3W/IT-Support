import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Service-role Supabase client. This key BYPASSES Row-Level Security, so it is
 * the single most dangerous object in the codebase.
 *
 * Rules (enforced by review — see .claude/agents/security-reviewer.md):
 *  - Server-side only. Never import into client code or expose the key.
 *  - Use ONLY in vetted trusted paths: tenant provisioning and background jobs.
 *  - Every read and write through this client MUST set/filter tenant_id
 *    explicitly, because the database will not do it for you here.
 */
export function createSupabaseAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("createSupabaseAdminClient must never run in the browser");
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
