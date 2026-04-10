import { createBrowserClient } from "@supabase/ssr";

// Auth browser client for login/signup
// Uses publishable key — safe for client-side
export function createAuthBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}
