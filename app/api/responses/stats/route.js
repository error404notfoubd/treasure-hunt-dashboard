import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { getDataClient } from "@/lib/supabase-data";

// GET /api/responses/stats
export async function GET() {
  const guard = await requireRole(10);
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const db = getDataClient();

  const [totalRes, flaggedRes, todayRes, verifiedRes] = await Promise.all([
    db.from("survey_responses").select("id", { count: "exact", head: true }),
    db.from("survey_responses").select("id", { count: "exact", head: true }).eq("is_flagged", true),
    db.from("survey_responses")
      .select("id", { count: "exact", head: true })
      .gte("submitted_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
    db.from("survey_responses").select("id", { count: "exact", head: true }).eq("verified", true),
  ]);

  return NextResponse.json({
    total: totalRes.count || 0,
    flagged: flaggedRes.count || 0,
    today: todayRes.count || 0,
    verified: verifiedRes.count || 0,
  });
}
