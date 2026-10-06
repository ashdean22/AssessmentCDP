import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runTool, toolDefs } from "@/lib/ai/tools";
import { findPii } from "@/lib/pii/guard";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Vapi function-tool webhook. Same tool backend as chat, same PII guard.
 * Vapi authenticates with the `x-vapi-secret` header we set on the assistant.
 * Vapi expects HTTP 200 always, with per-call `result` or `error` strings.
 */
function secretOk(req: Request): boolean {
  const expected = process.env.VAPI_SERVER_SECRET;
  const got = req.headers.get("x-vapi-secret");
  if (!expected || !got) return false;
  const a = Buffer.from(got), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

type ToolCall = { id: string; name?: string; function?: { name?: string; arguments?: unknown }; parameters?: unknown };

export async function POST(req: Request) {
  if (!secretOk(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { message?: { type?: string; toolCallList?: ToolCall[] } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const msg = body.message;
  if (msg?.type !== "tool-calls" || !Array.isArray(msg.toolCallList)) {
    // Vapi may send other server messages (status-update etc.); acknowledge quietly.
    return NextResponse.json({ ok: true });
  }

  const results = await Promise.all(
    msg.toolCallList.map(async (call) => {
      const name = call.function?.name ?? call.name ?? "";
      let args: unknown = call.function?.arguments ?? call.parameters ?? {};
      if (typeof args === "string") {
        try { args = JSON.parse(args || "{}"); } catch { args = {}; }
      }
      if (!(name in toolDefs)) {
        return { toolCallId: call.id, error: `Unknown tool ${name}. Email lookups are not available by voice; use the Lookup page.` };
      }
      try {
        const out = await runTool(name, args);
        if (findPii(out).length) return { toolCallId: call.id, error: "Result blocked by the PII guard." };
        return { toolCallId: call.id, name, result: JSON.stringify(out) };
      } catch (e) {
        return { toolCallId: call.id, name, error: (e as Error).message.slice(0, 300) };
      }
    }),
  );

  return NextResponse.json({ results });
}
