import { NextResponse } from "next/server";
import { AppEventSchema } from "@/lib/webhook/schema";
import { ingestAppEvent } from "@/lib/webhook/ingest";
import { MAX_BODY_BYTES, SIG_HEADER, TS_HEADER, verifySignature } from "@/lib/webhook/verify";

export const dynamic = "force-dynamic";

/**
 * POST /webhooks/app — live events from the mobile app.
 * 401 bad/missing/stale signature · 400 invalid body · 413 too large ·
 * 200 { duplicate: true } on a repeated event_id.
 */
export async function POST(req: Request) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "server not configured" }, { status: 500 });

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return NextResponse.json({ error: "payload too large" }, { status: 413 });
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: "payload too large" }, { status: 413 });

  const sig = verifySignature({
    secret,
    timestamp: req.headers.get(TS_HEADER),
    signature: req.headers.get(SIG_HEADER),
    rawBody: raw,
  });
  if (!sig.ok) return NextResponse.json({ error: "unauthorized", reason: sig.reason }, { status: 401 });

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = AppEventSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid event", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
      { status: 400 },
    );
  }

  try {
    const result = await ingestAppEvent(parsed.data);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[webhook] ingest failed", (e as Error).message);
    return NextResponse.json({ error: "ingest failed" }, { status: 500 });
  }
}

export function GET() {
  return NextResponse.json({ error: "method not allowed" }, { status: 405 });
}
