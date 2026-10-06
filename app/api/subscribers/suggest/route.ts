import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SUGGEST_LIMIT, emailPrefix } from "@/lib/search";

export const dynamic = "force-dynamic";

/** Prefix suggestions for the Lookup search box. Behind the login (proxy.ts). */
export async function GET(req: Request) {
  const prefix = emailPrefix(new URL(req.url).searchParams.get("q"));
  if (!prefix) return NextResponse.json({ suggestions: [] });
  const { data, error } = await db()
    .from("subscribers")
    .select("email,status,churn_tier")
    .like("email", `${prefix}%`)
    .order("email")
    .limit(SUGGEST_LIMIT);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ suggestions: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
