import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Keep-alive + smoke check. Once the database exists this will run one small
 * query so the Supabase free tier never pauses for inactivity.
 */
export async function GET() {
  return NextResponse.json({ ok: true, ts: new Date().toISOString() });
}
