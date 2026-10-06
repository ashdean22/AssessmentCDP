import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { assertNoPii } from "@/lib/pii/guard";
import { segmentRows } from "@/lib/segments/run";
import { WINBACK_SYSTEM, segmentStats, winbackPrompt } from "@/lib/winback";

export const maxDuration = 60;

const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CHAT_MODEL ?? "claude-sonnet-5-5";

/**
 * Drafts a win-back email from segment aggregates only. The rows are read on
 * the server to compute stats; the stats pass the PII guard before the model
 * sees them, and the response includes exactly what was sent ("what the AI saw").
 */
export async function POST(req: Request) {
  try {
    const { filter, name } = await req.json();
    const segmentName = String(name ?? "").trim().slice(0, 80) || "segment";
    const { rows, compiled } = await segmentRows(filter, { limit: 5000 });
    if (!rows.length) return NextResponse.json({ error: "segment is empty" }, { status: 400 });
    const stats = assertNoPii(segmentStats(rows, segmentName));
    // The model thinks before writing (can't be disabled on this model), so
    // the budget covers reasoning + ~140 words; low effort keeps it short.
    const { text, finishReason } = await generateText({
      model: anthropic(MODEL),
      system: WINBACK_SYSTEM,
      prompt: winbackPrompt(stats),
      maxOutputTokens: 4000,
      providerOptions: { anthropic: { effort: "low" } },
    });
    if (finishReason === "length") return NextResponse.json({ error: "draft was cut off; try again" }, { status: 502 });
    return NextResponse.json({ draft: text.trim(), stats, ran: compiled.description, model: MODEL });
  } catch (e) {
    if (e instanceof ZodError) return NextResponse.json({ error: "invalid filter" }, { status: 400 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
