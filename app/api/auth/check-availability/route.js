import { NextResponse } from "next/server";
import { getAuthAdminClient } from "@/lib/supabase-auth-admin";

const rateMap = new Map();
const MAX_CHECKS = 20;
const WINDOW_MS = 60 * 1000; // 1 minute per IP

function isRateLimited(ip) {
  const now = Date.now();
  const record = rateMap.get(ip);
  if (!record || now - record.start > WINDOW_MS) {
    rateMap.set(ip, { count: 1, start: now });
    return false;
  }
  record.count++;
  return record.count > MAX_CHECKS;
}

// GET /api/auth/check-availability?email=...&name=...
export async function GET(request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email")?.trim().toLowerCase();
  const name = searchParams.get("name")?.trim().toLowerCase();

  if (!email && !name) {
    return NextResponse.json({ error: "Provide email or name" }, { status: 400 });
  }

  const admin = getAuthAdminClient();
  const result = {};

  if (email) {
    const { data } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .limit(1);
    result.emailTaken = (data?.length || 0) > 0;
  }

  if (name) {
    const { data } = await admin
      .from("profiles")
      .select("id")
      .ilike("full_name", name)
      .limit(1);
    result.nameTaken = (data?.length || 0) > 0;
  }

  return NextResponse.json(result);
}
