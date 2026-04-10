import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { getAuthAdminClient } from "@/lib/supabase-auth-admin";
import { logAction } from "@/lib/audit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request) {
  try {
    const guard = await requireRole(100); // owner only
    if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status });

    const { userId, newPassword } = await request.json();

    if (!userId || !UUID_RE.test(userId)) {
      return NextResponse.json({ error: "Missing or invalid userId" }, { status: 400 });
    }

    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters" },
        { status: 400 }
      );
    }

    if (userId === guard.user.id) {
      return NextResponse.json(
        { error: "Use the Settings page to change your own password" },
        { status: 400 }
      );
    }

    const admin = getAuthAdminClient();

    // Check target user exists and is not an owner
    const { data: target, error: fetchErr } = await admin
      .from("profiles")
      .select("role, email, full_name")
      .eq("id", userId)
      .single();

    if (fetchErr || !target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (target.role === "owner") {
      return NextResponse.json(
        { error: "Cannot reset another owner's password" },
        { status: 403 }
      );
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await logAction({
      table: "profiles",
      operation: "PASSWORD_RESET",
      rowId: userId,
      oldData: null,
      newData: { email: target.email, full_name: target.full_name },
      actor: guard.user.fullName || guard.user.email,
      actorRole: guard.user.role,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
