"use client";

import { useState } from "react";
import { useUser } from "../dashboard-client";
import { useToast } from "@/components/toast";
import { apiFetch } from "@/lib/api-client";
import { ROLES } from "@/lib/roles";

export default function SettingsPage() {
  const user = useUser();
  const role = ROLES[user?.role] || ROLES.viewer;

  return (
    <>
      <div className="sticky top-0 z-10 bg-surface-1 border-b border-surface-3/50 px-7 py-4">
        <h2 className="text-lg font-bold tracking-tight">Settings</h2>
      </div>

      <div className="flex-1 p-7 overflow-y-auto">
        <div className="max-w-xl space-y-5">
          {/* Session Info */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-surface-3">
              <h3 className="text-sm font-semibold">Your Session</h3>
            </div>
            <div className="px-5 py-4 space-y-3">
              <Row label="Email" value={user?.email} mono />
              <Row label="Name" value={user?.fullName || "—"} />
              <Row label="User ID" value={user?.id} mono small />
              <Row
                label="Role"
                value={
                  <span className="badge" style={{ background: role.bgColor, color: role.color }}>
                    {role.icon} {role.label}
                  </span>
                }
              />
              <Row label="Joined" value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"} />
            </div>
          </div>

          {/* Change Password */}
          <ChangePasswordCard />

        </div>
      </div>
    </>
  );
}

function ChangePasswordCard() {
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  const isValid =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    newPassword === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid) return;

    setSaving(true);
    try {
      const res = await apiFetch("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error);

      toast("Password updated successfully", "success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast(err.message, "error");
    }
    setSaving(false);
  };

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3.5 border-b border-surface-3">
        <h3 className="text-sm font-semibold">Change Password</h3>
      </div>
      <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
        <div>
          <label className="label">Current Password</label>
          <input
            type={showPasswords ? "text" : "password"}
            className="input"
            placeholder="Enter current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        <div>
          <label className="label">New Password</label>
          <input
            type={showPasswords ? "text" : "password"}
            className="input"
            placeholder="At least 8 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
          {newPassword.length > 0 && newPassword.length < 8 && (
            <p className="text-[11px] text-warn mt-1">Must be at least 8 characters</p>
          )}
        </div>

        <div>
          <label className="label">Confirm New Password</label>
          <input
            type={showPasswords ? "text" : "password"}
            className="input"
            placeholder="Re-enter new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
          {confirmPassword.length > 0 && newPassword !== confirmPassword && (
            <p className="text-[11px] text-danger mt-1">Passwords do not match</p>
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showPasswords}
              onChange={(e) => setShowPasswords(e.target.checked)}
              className="accent-accent w-3.5 h-3.5"
            />
            <span className="text-[11px] text-ink-4">Show passwords</span>
          </label>

          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={!isValid || saving}
          >
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Updating…
              </span>
            ) : (
              "Update Password"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

function Row({ label, value, mono, small }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-ink-4">{label}</span>
      <span className={`text-sm ${mono ? "font-mono" : ""} ${small ? "text-[11px] text-ink-3" : "text-ink-1"}`}>
        {value}
      </span>
    </div>
  );
}
