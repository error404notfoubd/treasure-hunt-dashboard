"use client";

function getCsrfToken() {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)_csrf=([^;]*)/);
  return match ? match[1] : null;
}

/**
 * Fetch wrapper that attaches the CSRF token and handles
 * session expiry (401 → redirect to login).
 */
export async function apiFetch(url, options = {}) {
  const headers = new Headers(options.headers);

  const csrf = getCsrfToken();
  if (csrf) headers.set("x-csrf-token", csrf);

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: "same-origin",
  });

  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("Session expired");
  }

  if (res.status === 403) {
    const data = await res.clone().json().catch(() => ({}));
    if (data.error?.includes("CSRF")) {
      window.location.reload();
      throw new Error("Security token expired");
    }
  }

  return res;
}
