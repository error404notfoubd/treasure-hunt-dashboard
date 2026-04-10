import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { getAuthAdminClient } from "@/lib/supabase-auth-admin";
import { logAction } from "@/lib/audit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/users/requests — list pending signup requests
export async function GET() {
  const guard = await requireRole(80); // admin+
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const admin = getAuthAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// PATCH /api/users/requests — approve or reject { userId, action: "approve"|"reject" }
export async function PATCH(request) {
  const guard = await requireRole(80); // admin+
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { userId, action } = body;

  if (!userId || !UUID_RE.test(userId)) {
    return NextResponse.json({ error: "Missing or invalid userId" }, { status: 400 });
  }
  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Action must be 'approve' or 'reject'" }, { status: 400 });
  }

  const admin = getAuthAdminClient();

  const { data: target, error: fetchErr } = await admin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (fetchErr || !target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (target.status === "approved" && action === "approve") {
    return NextResponse.json({ error: "User is already approved" }, { status: 400 });
  }

  const newStatus = action === "approve" ? "approved" : "rejected";

  const { data, error } = await admin
    .from("profiles")
    .update({ status: newStatus })
    .eq("id", userId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAction({
    table: "profiles",
    operation: action === "approve" ? "APPROVE" : "REJECT",
    rowId: userId,
    oldData: { status: "pending", email: target.email, full_name: target.full_name },
    newData: { status: newStatus, email: target.email, full_name: target.full_name },
    actor: guard.user.fullName || guard.user.email,
    actorRole: guard.user.role,
  });

  return NextResponse.json({ data });
}
