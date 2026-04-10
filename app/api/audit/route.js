import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { getDataClient } from "@/lib/supabase-data";

const MAX_LIMIT = 200;

// GET /api/audit?limit=50
export async function GET(request) {
  const guard = await requireRole(80); // admin+
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || "50") || 50), MAX_LIMIT);
  const userId = searchParams.get("userId");
  const userName = searchParams.get("userName");

  const db = getDataClient();
  let query = db
    .from("audit_log")
    .select("*")
    .order("performed_at", { ascending: false })
    .limit(limit);

  if (userId || userName) {
    const filters = [];
    if (userId) filters.push(`row_id.eq.${userId}`);
    if (userName) filters.push(`performed_by.ilike.${userName}%`);
    query = query.or(filters.join(","));
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
