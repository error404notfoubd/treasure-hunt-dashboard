import { createClient } from "@supabase/supabase-js";

// Admin client (profiles, auth.users, role management)
// Uses secret key — server-side ONLY
let authAdminClient = null;

export function getAuthAdminClient() {
  if (authAdminClient) return authAdminClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SECRET_KEY in environment variables"
    );
  }

  authAdminClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return authAdminClient;
}
