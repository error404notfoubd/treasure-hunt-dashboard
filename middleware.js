import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

const CSRF_COOKIE = "_csrf";
const CSRF_HEADER = "x-csrf-token";
const SESSION_COOKIE = "_sid";

/** Normalize a hostname from env or URL (lowercase, no scheme, no port, no path). */
function normalizeHostname(raw) {
  if (raw == null || typeof raw !== "string") return "";
  let s = raw.trim().toLowerCase();
  if (!s) return "";
  s = s.replace(/^https?:\/\//i, "");
  s = s.split("/")[0] || "";
  s = s.replace(/:\d+$/, "");
  return s;
}

/**
 * Allowed hosts: ALLOWED_DOMAIN + Vercel system URLs.
 * VERCEL_URL is the deployment hostname; the stable project URL is often
 * VERCEL_PROJECT_PRODUCTION_URL (e.g. project.vercel.app) — they can differ, so include both.
 * @see https://vercel.com/docs/projects/environment-variables/system-environment-variables
 */
function getAllowedHosts() {
  const envRaw = process.env.ALLOWED_DOMAIN;
  const hosts = new Set();

  if (envRaw && String(envRaw).trim()) {
    for (const part of String(envRaw).split(",")) {
      const h = normalizeHostname(part);
      if (h) hosts.add(h);
    }
    for (const key of [
      "VERCEL_URL",
      "VERCEL_PROJECT_PRODUCTION_URL",
      "VERCEL_BRANCH_URL",
    ]) {
      const v = normalizeHostname(process.env[key]);
      if (v) hosts.add(v);
    }
  }

  return hosts.size > 0 ? hosts : null;
}

function requestHostname(request) {
  const host = request.headers.get("host")?.replace(/:\d+$/, "");
  if (host) return host;
  const xf = request.headers.get("x-forwarded-host");
  if (xf) return normalizeHostname(xf.split(",")[0]);
  return "";
}

function isDomainAllowed(request) {
  const allowed = getAllowedHosts();
  if (!allowed) return true;

  const host = requestHostname(request);
  if (host && !allowed.has(normalizeHostname(host))) return false;

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const originHost = normalizeHostname(new URL(origin).hostname);
      if (originHost && !allowed.has(originHost)) return false;
    } catch {
      return false;
    }
  }

  const referer = request.headers.get("referer");
  if (!origin && referer) {
    try {
      const refHost = normalizeHostname(new URL(referer).hostname);
      if (refHost && !allowed.has(refHost)) return false;
    } catch {
      return false;
    }
  }

  return true;
}

export async function middleware(request) {
  // ── Domain lock: reject requests from unauthorized hosts ──
  if (!isDomainAllowed(request)) {
    return NextResponse.json(
      { error: "Forbidden — unauthorized domain" },
      { status: 403 }
    );
  }

  let response = NextResponse.next({ request: { headers: request.headers } });
  const { pathname } = request.nextUrl;

  const csrfCookie = request.cookies.get(CSRF_COOKIE)?.value;

  // ── CSRF: reject API mutations without a valid token ──
  if (pathname.startsWith("/api/")) {
    if (["POST", "PATCH", "PUT", "DELETE"].includes(request.method)) {
      const headerToken = request.headers.get(CSRF_HEADER);
      if (!csrfCookie || !headerToken || csrfCookie !== headerToken) {
        return NextResponse.json(
          { error: "CSRF token missing or invalid" },
          { status: 403 }
        );
      }
    }
  }

  // ── Page routes: Supabase auth + session ID + redirects ──
  if (!pathname.startsWith("/api/")) {
    const supabase = createServerClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_PUBLISHABLE_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value);
              response = NextResponse.next({
                request: { headers: request.headers },
              });
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Session ID: generate on first authenticated page visit
    if (user && !request.cookies.get(SESSION_COOKIE)?.value) {
      response.cookies.set(SESSION_COOKIE, crypto.randomUUID(), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
    }

    // Clear session ID when logged out
    if (!user && request.cookies.get(SESSION_COOKIE)?.value) {
      response.cookies.delete(SESSION_COOKIE);
    }

    // Protect dashboard routes
    if (pathname.startsWith("/dashboard") && !user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Redirect logged-in users away from login/signup
    if ((pathname === "/login" || pathname === "/signup") && user) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // Redirect root to dashboard or login
    if (pathname === "/") {
      if (user) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // ── CSRF cookie: set if missing (after Supabase may have replaced response) ──
  if (!csrfCookie) {
    response.cookies.set(CSRF_COOKIE, crypto.randomUUID(), {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    });
  }

  // ── Security headers ──
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );

  return response;
}

export const config = {
  matcher: ["/", "/login", "/signup", "/dashboard/:path*", "/api/:path*"],
};
