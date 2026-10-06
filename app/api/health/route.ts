import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Keep-alive + smoke check. Runs one tiny query so the Supabase free tier
 * never pauses for inactivity (GitHub Action hits this every 2 days).
 */
export async function GET() {
  const { count, error } = await db()
    .from("subscribers")
    .select("*", { count: "exact", head: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, subscribers: count ?? 0, ts: new Date().toISOString() });
}
