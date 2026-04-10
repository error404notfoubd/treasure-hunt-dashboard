"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "./dashboard-client";
import { useToast } from "@/components/toast";
import { apiFetch } from "@/lib/api-client";
import { canEditData, canDeleteData, canVerifyData } from "@/lib/roles";
import { IconSearch, IconEdit, IconFlag, IconTrash, IconChevLeft, IconChevRight, IconRefresh, IconShieldCheck } from "@/components/icons";
import { SkeletonStatCard, SkeletonTableRows } from "@/components/skeleton";
import Modal from "@/components/modal";

export default function ResponsesPage() {
  const user = useUser();
  const toast = useToast();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, flagged: 0, today: 0, verified: 0 });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [editRow, setEditRow] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);
  const [verifyRow, setVerifyRow] = useState(null);
  const perPage = 15;

  const canEdit = canEditData(user?.role);
  const canDelete = canDeleteData(user?.role);
  const canVerify = canVerifyData(user?.role);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: perPage.toString(),
      });
      if (search) params.set("search", search);

      const [resData, resStats] = await Promise.all([
        apiFetch(`/api/responses?${params}`).then((r) => r.json()),
        apiFetch("/api/responses/stats").then((r) => r.json()),
      ]);

      setData(resData.data || []);
      setTotal(resData.total || 0);
      setStats(resStats);
    } catch (err) {
      toast("Failed to load data", "error");
    }
    setLoading(false);
  }, [page, search, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleFlag = async (row) => {
    try {
      const res = await apiFetch("/api/responses", {
        method: "PATCH",
        body: JSON.stringify({ id: row.id, updates: { is_flagged: !row.is_flagged } }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast(row.is_flagged ? "Unflagged" : "Flagged", "success");
      fetchData();
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const handleDelete = async () => {
    if (!deleteRow) return;
    try {
      const res = await apiFetch("/api/responses", {
        method: "DELETE",
        body: JSON.stringify({ id: deleteRow.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast("Record deleted", "success");
      setDeleteRow(null);
      fetchData();
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const handleEditSave = async (updates) => {
    try {
      const res = await apiFetch("/api/responses", {
        method: "PATCH",
        body: JSON.stringify({ id: editRow.id, updates }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast("Updated successfully", "success");
      setEditRow(null);
      fetchData();
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const handleToggleVerify = async () => {
    if (!verifyRow) return;
    try {
      const res = await apiFetch("/api/responses", {
        method: "PATCH",
        body: JSON.stringify({ id: verifyRow.id, updates: { verified: !verifyRow.verified } }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast(verifyRow.verified ? "Verification removed" : "Marked as verified", "success");
      setVerifyRow(null);
      fetchData();
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <>
      {/* Topbar */}
      <div className="sticky top-0 z-10 bg-surface-1 border-b border-surface-3/50 px-7 py-4 flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold tracking-tight">Leads</h2>
        <div className="flex items-center gap-3">
          <button
            className="btn btn-ghost btn-sm gap-1.5"
            onClick={fetchData}
            disabled={loading}
            title="Refresh data"
          >
            <IconRefresh size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <div className="flex items-center gap-2 bg-surface-2 border border-surface-4 rounded-lg px-3 py-2 focus-within:border-accent transition-colors">
            <IconSearch className="text-ink-4" />
            <input
              type="text"
              placeholder="Search name, email, phone…"
              className="bg-transparent border-none outline-none text-ink-1 text-sm w-[220px] placeholder:text-ink-4 font-sans"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 p-7 overflow-y-auto">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {loading ? (
            <>
              <SkeletonStatCard />
              <SkeletonStatCard />
              <SkeletonStatCard />
              <SkeletonStatCard />
            </>
          ) : (
            <>
              <StatCard label="Total Responses" value={stats.total} />
              <StatCard label="Today" value={stats.today} sub="submissions" />
              <StatCard
                label="Flagged"
                value={stats.flagged}
                valueColor={stats.flagged > 0 ? "text-danger" : "text-success"}
              />
              <StatCard
                label="Verified"
                value={stats.verified}
                valueColor={stats.verified > 0 ? "text-accent" : "text-ink-4"}
                sub={stats.total > 0 ? `${Math.round((stats.verified / stats.total) * 100)}% of total` : undefined}
              />
            </>
          )}
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-surface-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Survey Responses</h3>
            <span className="text-xs text-ink-4">{total} total</span>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Frequency</th>
                  <th>Status</th>
                  <th>Verified</th>
                  <th>Submitted</th>
                  {(canEdit || canDelete || canVerify) && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonTableRows rows={8} cols={(canEdit || canDelete || canVerify) ? 8 : 7} />
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-16 text-ink-4">
                      No records found
                    </td>
                  </tr>
                ) : (
                  data.map((row) => (
                    <tr key={row.id}>
                      <td className="font-semibold text-ink-1">{row.name}</td>
                      <td className="text-ink-2">{row.email || "—"}</td>
                      <td className="font-mono text-xs text-ink-2">{row.phone}</td>
                      <td>
                        {row.frequency ? (
                          <span className="badge bg-surface-3 text-ink-2">{row.frequency}</span>
                        ) : "—"}
                      </td>
                      <td>
                        <span className={`badge ${row.is_flagged ? "bg-danger-muted text-danger" : "bg-success-muted text-success"}`}>
                          {row.is_flagged ? "⚑ Flagged" : "✓ Clean"}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${row.verified ? "bg-accent/10 text-accent" : "bg-surface-3 text-ink-4"}`}>
                          {row.verified ? "✓ Verified" : "Unverified"}
                        </span>
                      </td>
                      <td className="font-mono text-[11px] text-ink-4">
                        {new Date(row.submitted_at).toLocaleString()}
                      </td>
                      {(canEdit || canDelete || canVerify) && (
                        <td>
                          <div className="flex gap-1">
                            {canEdit && (
                              <>
                                <button className="p-1.5 rounded-md text-ink-4 hover:text-ink-1 hover:bg-surface-3 transition-colors" title="Edit" onClick={() => setEditRow(row)}>
                                  <IconEdit />
                                </button>
                                <button className="p-1.5 rounded-md text-ink-4 hover:text-warn hover:bg-warn-muted transition-colors" title="Toggle flag" onClick={() => handleToggleFlag(row)}>
                                  <IconFlag />
                                </button>
                              </>
                            )}
                            {canVerify && (
                              <button
                                className={`p-1.5 rounded-md transition-colors ${row.verified ? "text-accent hover:text-danger hover:bg-danger-muted" : "text-ink-4 hover:text-accent hover:bg-accent/10"}`}
                                title={row.verified ? "Remove verification" : "Mark as verified"}
                                onClick={() => setVerifyRow(row)}
                              >
                                <IconShieldCheck />
                              </button>
                            )}
                            {canDelete && (
                              <button className="p-1.5 rounded-md text-ink-4 hover:text-danger hover:bg-danger-muted transition-colors" title="Delete" onClick={() => setDeleteRow(row)}>
                                <IconTrash />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-surface-3">
            <span className="text-xs text-ink-4">
              {data.length} of {total} records
            </span>
            <div className="flex gap-1.5">
              <button
                className="btn btn-ghost btn-sm"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                <IconChevLeft /> Prev
              </button>
              <span className="px-3 py-1.5 text-xs text-ink-3">
                {page + 1} / {totalPages || 1}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
              >
                Next <IconChevRight />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editRow && (
        <EditModal row={editRow} onClose={() => setEditRow(null)} onSave={handleEditSave} />
      )}

      {/* Delete Confirm */}
      {deleteRow && (
        <Modal
          title="Confirm Delete"
          onClose={() => setDeleteRow(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setDeleteRow(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
            </>
          }
        >
          <p className="text-sm text-ink-2 leading-relaxed">
            Permanently delete the response from <strong className="text-ink-1">{deleteRow.name}</strong>?
            This will be recorded in the audit log.
          </p>
        </Modal>
      )}

      {/* Verify Confirm */}
      {verifyRow && (
        <Modal
          title={verifyRow.verified ? "Remove Verification" : "Confirm Verification"}
          onClose={() => setVerifyRow(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setVerifyRow(null)}>Cancel</button>
              <button
                className={`btn ${verifyRow.verified ? "btn-danger" : "btn-primary"}`}
                onClick={handleToggleVerify}
              >
                {verifyRow.verified ? "Remove Verification" : "Mark as Verified"}
              </button>
            </>
          }
        >
          <p className="text-sm text-ink-2 leading-relaxed">
            {verifyRow.verified ? (
              <>Remove verification from <strong className="text-ink-1">{verifyRow.name}</strong>? Their phone number will be marked as unverified.</>
            ) : (
              <>Mark <strong className="text-ink-1">{verifyRow.name}</strong> as verified? This confirms their phone number has been validated.</>
            )}
          </p>
          <p className="text-xs text-ink-4 mt-2">This action will be recorded in the audit log.</p>
        </Modal>
      )}
    </>
  );
}

function StatCard({ label, value, sub, valueColor = "text-ink-1" }) {
  return (
    <div className="card px-5 py-4">
      <div className="text-[11px] font-semibold text-ink-4 uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-bold mt-1.5 tracking-tight ${valueColor}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      {sub && <div className="text-[11px] text-ink-4 mt-1">{sub}</div>}
    </div>
  );
}

function EditModal({ row, onClose, onSave }) {
  const [name, setName] = useState(row.name);
  const [email, setEmail] = useState(row.email || "");
  const [phone, setPhone] = useState(row.phone);
  const [notes, setNotes] = useState(row.notes || "");

  return (
    <Modal
      title="Edit Response"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() => onSave({ name, email: email || null, phone, notes: notes || null })}
          >
            Save Changes
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea className="input resize-y" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
