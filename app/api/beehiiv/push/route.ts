import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { buildBeehiivPush } from "@/lib/beehiiv";
import { segmentRows } from "@/lib/segments/run";

/**
 * MOCK push to beehiiv. Builds the exact per-subscriber requests beehiiv's
 * API expects, logs a summary, and returns the plan for the UI to show.
 * Nothing is sent to beehiiv. Behind the login (proxy.ts).
 */
export async function POST(req: Request) {
  try {
    const { filter, name } = await req.json();
    const segmentName = String(name ?? "").trim().slice(0, 80) || "segment";
    const { rows, compiled } = await segmentRows(filter, { limit: 5000 });
    const plan = buildBeehiivPush({
      segmentName,
      rows,
      publicationId: process.env.BEEHIIV_PUBLICATION_ID,
      apiKey: process.env.BEEHIIV_API_KEY,
    });
    console.log(`[beehiiv mock] would send ${plan.total_requests} × ${plan.method} ${plan.url} for "${segmentName}" (${compiled.description})`);
    return NextResponse.json({ ...plan, ran: compiled.description, logged_at: new Date().toISOString() });
  } catch (e) {
    if (e instanceof ZodError) return NextResponse.json({ error: "invalid filter" }, { status: 400 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
