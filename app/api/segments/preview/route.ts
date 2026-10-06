import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { segmentRows, countSegment } from "@/lib/segments/run";

export async function POST(req: Request) {
  try {
    const { filter, limit = 100, offset = 0 } = await req.json();
    const [{ rows, compiled }, { count }] = await Promise.all([
      segmentRows(filter, { limit: Math.min(Number(limit) || 100, 500), offset: Number(offset) || 0 }),
      countSegment(filter),
    ]);
    return NextResponse.json({ rows, count, description: compiled.description, where: compiled.where });
  } catch (e) {
    if (e instanceof ZodError) return NextResponse.json({ error: "invalid filter", issues: e.issues }, { status: 400 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
