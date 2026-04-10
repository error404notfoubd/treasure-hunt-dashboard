"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createAuthBrowserClient } from "@/lib/supabase-auth-browser";
import Link from "next/link";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [nameTaken, setNameTaken] = useState(false);
  const [emailTaken, setEmailTaken] = useState(false);
  const [checking, setChecking] = useState({ name: false, email: false });
  const router = useRouter();
  const nameTimer = useRef(null);
  const emailTimer = useRef(null);

  const checkAvailability = useCallback(async (field, value) => {
    if (!value.trim()) return;
    setChecking((prev) => ({ ...prev, [field]: true }));
    try {
      const param = field === "name" ? `name=${encodeURIComponent(value.trim())}` : `email=${encodeURIComponent(value.trim())}`;
      const res = await fetch(`/api/auth/check-availability?${param}`);
      const json = await res.json();
      if (field === "name") setNameTaken(json.nameTaken || false);
      if (field === "email") setEmailTaken(json.emailTaken || false);
    } catch {
      // Silently fail — backend constraint will catch it
    }
    setChecking((prev) => ({ ...prev, [field]: false }));
  }, []);

  const debouncedCheckName = (value) => {
    setNameTaken(false);
    clearTimeout(nameTimer.current);
    if (value.trim()) {
      nameTimer.current = setTimeout(() => checkAvailability("name", value), 500);
    }
  };

  const debouncedCheckEmail = (value) => {
    setEmailTaken(false);
    clearTimeout(emailTimer.current);
    if (value.trim()) {
      emailTimer.current = setTimeout(() => checkAvailability("email", value), 500);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    // Final uniqueness check before submitting
    try {
      const res = await fetch(
        `/api/auth/check-availability?name=${encodeURIComponent(fullName.trim())}&email=${encodeURIComponent(email.trim())}`
      );
      const json = await res.json();
      if (json.nameTaken) {
        setNameTaken(true);
        setError("This name is already taken");
        setLoading(false);
        return;
      }
      if (json.emailTaken) {
        setEmailTaken(true);
        setError("This email is already registered");
        setLoading(false);
        return;
      }
    } catch {
      // Continue — backend will enforce constraints
    }

    try {
      const supabase = createAuthBrowserClient();
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role: "viewer",
          },
        },
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-0">
        <div className="card p-10 max-w-[400px] mx-4 text-center animate-slide-up">
          <div className="w-16 h-16 rounded-2xl bg-accent-muted flex items-center justify-center mx-auto mb-6">
            <span className="text-accent text-2xl">⏳</span>
          </div>
          <h1 className="text-xl font-bold mb-2">Request submitted</h1>
          <p className="text-ink-3 text-sm mb-6">
            We sent a confirmation link to <strong className="text-ink-1">{email}</strong>.
            After confirming your email, an owner will review and approve your access.
          </p>
          <Link href="/login" className="btn btn-primary w-full">
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-0 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[20%] right-[25%] w-[450px] h-[350px] rounded-full bg-success/[0.04] blur-[100px]" />
      </div>

      <div className="relative w-full max-w-[400px] mx-4 animate-slide-up">
        <div className="card p-10">
          <div className="w-16 h-16 rounded-2xl bg-accent-muted flex items-center justify-center mx-auto mb-7">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="20" y1="8" x2="20" y2="14" />
              <line x1="23" y1="11" x2="17" y2="11" />
            </svg>
          </div>

          <h1 className="text-xl font-bold text-center mb-1 tracking-tight">Request Access</h1>
          <p className="text-ink-3 text-sm text-center mb-8">
            Your account will need to be approved by an owner before you can access the dashboard.
          </p>

          {error && (
            <div className="bg-danger-muted text-danger text-xs font-medium px-4 py-3 rounded-lg mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleSignup}>
            <div className="mb-4">
              <label className="label">Full Name</label>
              <input
                type="text"
                className="input"
                placeholder="Jane Doe"
                value={fullName}
                onChange={(e) => { setFullName(e.target.value); debouncedCheckName(e.target.value); }}
                required
              />
              {checking.name && (
                <p className="text-[11px] text-ink-4 mt-1">Checking…</p>
              )}
              {!checking.name && nameTaken && (
                <p className="text-[11px] text-danger mt-1">This name is already taken</p>
              )}
            </div>

            <div className="mb-4">
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); debouncedCheckEmail(e.target.value); }}
                required
                autoComplete="email"
              />
              {checking.email && (
                <p className="text-[11px] text-ink-4 mt-1">Checking…</p>
              )}
              {!checking.email && emailTaken && (
                <p className="text-[11px] text-danger mt-1">This email is already registered</p>
              )}
            </div>

            <div className="mb-6">
              <label className="label">Password</label>
              <input
                type="password"
                className="input"
                placeholder="Min 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <button type="submit" className="btn btn-primary w-full" disabled={loading || nameTaken || emailTaken}>
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating account…
                </span>
              ) : (
                "Sign Up"
              )}
            </button>
          </form>

          <p className="text-center text-ink-3 text-xs mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-accent hover:text-accent-hover font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
