import { ZodError } from "zod";
import { segmentRows } from "@/lib/segments/run";
import { toCsv } from "@/lib/csv";

/** Server-built CSV download of a segment (behind login via proxy.ts). */
export async function POST(req: Request) {
  try {
    const { filter, name = "segment" } = await req.json();
    const { rows } = await segmentRows(filter, { limit: 5000 });
    const csv = toCsv(
      ["email", "status", "source", "signup_date", "last_open_date", "engagement_score", "churn_tier"],
      rows.map((r) => [r.email, r.status, r.source, r.signup_date, r.last_open_date, r.engagement_score, r.churn_tier]),
    );
    const safeName = String(name).replace(/[^a-z0-9-_]+/gi, "-").slice(0, 60) || "segment";
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeName}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof ZodError) return Response.json({ error: "invalid filter" }, { status: 400 });
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
