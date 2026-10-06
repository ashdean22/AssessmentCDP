import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Full tables the AI only referenced by id. Behind the login (proxy.ts), so
 * the browser can show emails the model never saw.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const { data, error } = await db().from("ai_results").select("kind,rows,created_at").eq("result_id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  const payload = data.rows as { rows: unknown[]; meta: Record<string, unknown> };
  return NextResponse.json({ kind: data.kind, created_at: data.created_at, rows: payload.rows, meta: payload.meta });
}
