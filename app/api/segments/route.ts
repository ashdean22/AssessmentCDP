import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { compileFilter } from "@/lib/segments/compile";

export async function GET() {
  const { data, error } = await db()
    .from("segments")
    .select("id,name,filter_json,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ segments: data });
}

export async function POST(req: Request) {
  try {
    const { name, filter } = await req.json();
    const cleanName = String(name ?? "").trim().slice(0, 80);
    if (!cleanName) return NextResponse.json({ error: "name required" }, { status: 400 });
    compileFilter(filter); // validate before saving
    const { data, error } = await db()
      .from("segments")
      .insert({ name: cleanName, filter_json: filter })
      .select("id,name,filter_json,created_at")
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ segment: data });
  } catch (e) {
    if (e instanceof ZodError) return NextResponse.json({ error: "invalid filter", issues: e.issues }, { status: 400 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await db().from("segments").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
