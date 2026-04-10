import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Auth server component client (reads cookies, uses publishable key)
export function createAuthServerClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from Server Component — ignore
          }
        },
      },
    }
  );
}
