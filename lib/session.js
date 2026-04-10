import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getAuthAdminClient } from "./supabase-auth-admin";

const SESSION_COOKIE = "_sid";

// Get the currently authenticated user + their profile (including role).
// Requires both a valid Supabase session AND a session-ID cookie (set by middleware).
export async function getSessionUser() {
  const cookieStore = cookies();

  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const supabase = createServerClient(
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
            // Ignore in server components
          }
        },
      },
    }
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return null;

  // Fetch profile with role using admin client (bypasses RLS)
  const admin = getAuthAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) return null;

  return {
    id: user.id,
    email: user.email,
    fullName: profile.full_name,
    role: profile.role,
    status: profile.status || "approved",
    avatarUrl: profile.avatar_url,
    createdAt: profile.created_at,
    sessionId,
  };
}

// Guard: require auth + approved status + minimum role level
export async function requireRole(minLevel = 10) {
  const user = await getSessionUser();
  if (!user) {
    return { error: "Unauthorized", status: 401 };
  }
  if (user.status !== "approved") {
    return { error: "Account pending approval", status: 403 };
  }
  const { getRoleLevel } = await import("./roles");
  if (getRoleLevel(user.role) < minLevel) {
    return { error: "Forbidden — insufficient permissions", status: 403 };
  }
  return { user };
}
