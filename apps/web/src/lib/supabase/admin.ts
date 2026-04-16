import { createClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase admin client using the service_role_key.
 * This client bypasses RLS and has full access to Auth Admin API.
 * ⚠️ ONLY use in server actions within the admin namespace.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
