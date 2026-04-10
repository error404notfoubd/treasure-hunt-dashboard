"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/toast";
import { apiFetch } from "@/lib/api-client";
import { IconCheck, IconX, IconRefresh } from "@/components/icons";
import { SkeletonTableRows } from "@/components/skeleton";

export default function RequestsPage() {
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/users/requests");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setRequests(json.data || []);
    } catch (err) {
      toast("Failed to load requests: " + err.message, "error");
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleAction = async (userId, action) => {
    try {
      const res = await apiFetch("/api/users/requests", {
        method: "PATCH",
        body: JSON.stringify({ userId, action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast(
        action === "approve" ? "User approved" : "Request rejected",
        "success"
      );
      fetchRequests();
    } catch (err) {
      toast(err.message, "error");
    }
  };

  return (
    <>
      <div className="sticky top-0 z-10 bg-surface-1 border-b border-surface-3/50 px-7 py-4 flex items-center justify-between">
        <h2 className="text-lg font-bold tracking-tight">Requests</h2>
        <button
          className="btn btn-ghost btn-sm gap-1.5"
          onClick={fetchRequests}
          disabled={loading}
          title="Refresh requests"
        >
          <IconRefresh size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="flex-1 p-7 overflow-y-auto">
        <div className="card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-surface-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Pending Approvals</h3>
            <span className="text-xs text-ink-4">{requests.length} pending</span>
          </div>

          {loading ? (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Requested</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <SkeletonTableRows rows={4} cols={4} />
                </tbody>
              </table>
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-16 text-ink-4">
              <div className="text-3xl mb-3 opacity-30">✓</div>
              No pending requests
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Requested</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => (
                    <tr key={req.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-surface-4 flex items-center justify-center text-[11px] font-bold text-ink-2 flex-shrink-0">
                            {(req.full_name || req.email || "?")[0].toUpperCase()}
                          </div>
                          <span className="text-sm font-semibold text-ink-1">
                            {req.full_name || "—"}
                          </span>
                        </div>
                      </td>
                      <td className="text-ink-2">{req.email}</td>
                      <td className="font-mono text-[11px] text-ink-4">
                        {new Date(req.created_at).toLocaleString()}
                      </td>
                      <td>
                        <div className="flex gap-1.5">
                          <button
                            className="btn btn-sm gap-1 bg-success-muted text-success hover:bg-success hover:text-white transition-colors"
                            onClick={() => handleAction(req.id, "approve")}
                          >
                            <IconCheck size={13} />
                            Approve
                          </button>
                          <button
                            className="btn btn-sm gap-1 bg-danger-muted text-danger hover:bg-danger hover:text-white transition-colors"
                            onClick={() => handleAction(req.id, "reject")}
                          >
                            <IconX size={13} />
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
