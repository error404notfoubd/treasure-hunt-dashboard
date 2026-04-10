import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { getAuthAdminClient } from "@/lib/supabase-auth-admin";
import { canAssignRole, canModifyUser } from "@/lib/roles";
import { logAction } from "@/lib/audit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_ROLES = ["owner", "admin", "editor", "viewer"];

// GET /api/users — list all profiles
export async function GET() {
  const guard = await requireRole(80); // admin+
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const admin = getAuthAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// PATCH /api/users — { userId, role }
export async function PATCH(request) {
  const guard = await requireRole(80); // admin+
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { userId, role } = body;
  if (!userId || !UUID_RE.test(userId)) {
    return NextResponse.json({ error: "Missing or invalid userId" }, { status: 400 });
  }
  if (!role || !VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Missing or invalid role" }, { status: 400 });
  }

  if (role === "owner") {
    return NextResponse.json(
      { error: "Owner role can only be assigned directly in Supabase" },
      { status: 403 }
    );
  }

  const admin = getAuthAdminClient();

  // Get target user's current role
  const { data: target, error: fetchErr } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (fetchErr || !target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Check permission: can this actor modify this user?
  if (!canModifyUser(guard.user.role, target.role)) {
    return NextResponse.json(
      { error: "Cannot modify a user with equal or higher role" },
      { status: 403 }
    );
  }

  // Check permission: can this actor assign this role?
  if (!canAssignRole(guard.user.role, role)) {
    return NextResponse.json(
      { error: `Your role cannot assign the "${role}" role` },
      { status: 403 }
    );
  }

  // Prevent self-demotion for owners (safety)
  if (userId === guard.user.id && guard.user.role === "owner" && role !== "owner") {
    return NextResponse.json(
      { error: "Owners cannot demote themselves. Ask another owner." },
      { status: 403 }
    );
  }

  const { data, error } = await admin
    .from("profiles")
    .update({ role })
    .eq("id", userId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAction({
    table: "profiles",
    operation: "ROLE_CHANGE",
    rowId: userId,
    oldData: { role: target.role, email: data.email },
    newData: { role, email: data.email },
    actor: guard.user.fullName || guard.user.email,
    actorRole: guard.user.role,
  });

  return NextResponse.json({ data });
}

// DELETE /api/users — { userId }
export async function DELETE(request) {
  const guard = await requireRole(80); // admin+
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { userId } = body;
  if (!userId || !UUID_RE.test(userId)) return NextResponse.json({ error: "Missing or invalid userId" }, { status: 400 });

  if (userId === guard.user.id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 403 });
  }

  const admin = getAuthAdminClient();

  // Check target role
  const { data: target } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (target && !canModifyUser(guard.user.role, target.role)) {
    return NextResponse.json(
      { error: "Cannot delete a user with equal or higher role" },
      { status: 403 }
    );
  }

  // Snapshot before deletion for the audit log
  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  // Delete from GoTrue (cascade deletes profile via FK)
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAction({
    table: "profiles",
    operation: "DELETE_USER",
    rowId: userId,
    oldData: profile ? { email: profile.email, full_name: profile.full_name, role: profile.role } : null,
    newData: null,
    actor: guard.user.fullName || guard.user.email,
    actorRole: guard.user.role,
  });

  return NextResponse.json({ success: true });
}
