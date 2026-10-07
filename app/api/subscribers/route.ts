import { NextResponse } from "next/server";
import { listSubscribers } from "@/lib/subscribers";
import { parseListParams } from "@/lib/subscribers-list";

export const dynamic = "force-dynamic";

/** Live-filter data for /subscribers. Behind the login (proxy.ts). */
export async function GET(req: Request) {
  try {
    const out = await listSubscribers(parseListParams(new URL(req.url).searchParams));
    return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
