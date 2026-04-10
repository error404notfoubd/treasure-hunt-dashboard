import { createClient } from "@supabase/supabase-js";

// DATA client (survey_responses, audit_log, rate_limit_log)
// Uses secret key — server-side ONLY, never expose to client
let dataClient = null;

export function getDataClient() {
  if (dataClient) return dataClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SECRET_KEY in environment variables"
    );
  }

  dataClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return dataClient;
}
