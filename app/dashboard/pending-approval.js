"use client";

import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";

export default function PendingApproval({ user }) {
  const router = useRouter();

  const handleLogout = async () => {
    await apiFetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const handleCheckStatus = () => {
    router.refresh();
  };

  const isRejected = user?.status === "rejected";

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-0 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[20%] left-[30%] w-[450px] h-[350px] rounded-full bg-accent/[0.04] blur-[100px]" />
      </div>

      <div className="relative w-full max-w-[440px] mx-4 animate-slide-up">
        <div className="card p-10 text-center">
          {isRejected ? (
            <>
              <div className="w-16 h-16 rounded-2xl bg-danger-muted flex items-center justify-center mx-auto mb-7">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-danger">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
              <h1 className="text-xl font-bold mb-2 tracking-tight">Access Denied</h1>
              <p className="text-ink-3 text-sm mb-8 leading-relaxed">
                Your request to join was declined. If you believe this is a mistake,
                contact the workspace owner.
              </p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-2xl bg-accent-muted flex items-center justify-center mx-auto mb-7">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <h1 className="text-xl font-bold mb-2 tracking-tight">Pending Approval</h1>
              <p className="text-ink-3 text-sm mb-2 leading-relaxed">
                Your request to join has been received. An owner needs to approve
                your account before you can access the dashboard.
              </p>
              <p className="text-ink-4 text-xs mb-8">
                Signed in as <strong className="text-ink-2">{user?.email}</strong>
              </p>
            </>
          )}

          <div className="flex gap-3">
            <button onClick={handleLogout} className="btn btn-secondary flex-1">
              Sign Out
            </button>
            {!isRejected && (
              <button onClick={handleCheckStatus} className="btn btn-primary flex-1">
                Check Status
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
