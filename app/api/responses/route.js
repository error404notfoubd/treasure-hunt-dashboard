import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { getDataClient } from "@/lib/supabase-data";
import { logAction } from "@/lib/audit";

const MAX_LIMIT = 100;

// Strip characters that could manipulate PostgREST filter syntax
function sanitizeSearch(raw) {
  return raw.replace(/[,()"'\\]/g, "").trim().slice(0, 200);
}

// GET /api/responses?page=0&limit=15&search=...&flagged=true
export async function GET(request) {
  const guard = await requireRole(10); // viewer+
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { searchParams } = new URL(request.url);
  const page = Math.max(0, parseInt(searchParams.get("page") || "0") || 0);
  const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || "15") || 15), MAX_LIMIT);
  const search = sanitizeSearch(searchParams.get("search") || "");
  const flaggedOnly = searchParams.get("flagged") === "true";

  const db = getDataClient();
  let query = db
    .from("survey_responses")
    .select("*", { count: "exact" })
    .order("submitted_at", { ascending: false })
    .range(page * limit, page * limit + limit - 1);

  if (search) {
    query = query.or(
      `name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
    );
  }
  if (flaggedOnly) {
    query = query.eq("is_flagged", true);
  }

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, total: count });
}

// PATCH /api/responses — { id, updates }
export async function PATCH(request) {
  const guard = await requireRole(50); // editor+
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { id, updates } = body;
  if (!id || !Number.isInteger(id)) return NextResponse.json({ error: "Missing or invalid id" }, { status: 400 });
  if (!updates || typeof updates !== "object") return NextResponse.json({ error: "Missing updates" }, { status: 400 });

  // Only allow safe fields
  const allowed = ["name", "email", "phone", "frequency", "is_flagged", "notes"];
  const safe = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) safe[key] = updates[key];
  }

  const db = getDataClient();

  const { data: oldRow } = await db
    .from("survey_responses")
    .select("*")
    .eq("id", id)
    .single();

  const { data, error } = await db
    .from("survey_responses")
    .update(safe)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAction({
    table: "survey_responses",
    operation: "UPDATE",
    rowId: id,
    oldData: oldRow,
    newData: data,
    actor: guard.user.fullName || guard.user.email,
    actorRole: guard.user.role,
  });

  return NextResponse.json({ data });
}

// DELETE /api/responses — { id }
export async function DELETE(request) {
  const guard = await requireRole(80); // admin+
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { id } = body;
  if (!id || !Number.isInteger(id)) return NextResponse.json({ error: "Missing or invalid id" }, { status: 400 });

  const db = getDataClient();

  const { data: oldRow } = await db
    .from("survey_responses")
    .select("*")
    .eq("id", id)
    .single();

  const { error } = await db.from("survey_responses").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAction({
    table: "survey_responses",
    operation: "DELETE",
    rowId: id,
    oldData: oldRow,
    newData: null,
    actor: guard.user.fullName || guard.user.email,
    actorRole: guard.user.role,
  });

  return NextResponse.json({ success: true });
}
