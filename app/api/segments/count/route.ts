import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { countSegment } from "@/lib/segments/run";

export async function POST(req: Request) {
  try {
    const { filter } = await req.json();
    const { count, compiled } = await countSegment(filter);
    return NextResponse.json({ count, description: compiled.description });
  } catch (e) {
    if (e instanceof ZodError) return NextResponse.json({ error: "invalid filter", issues: e.issues }, { status: 400 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
