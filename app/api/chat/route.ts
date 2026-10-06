import { createAnthropic } from "@ai-sdk/anthropic";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  tool,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { SYSTEM_PROMPT } from "@/lib/ai/prompt";
import { toolDefs } from "@/lib/ai/tools";
import { redactEmails } from "@/lib/pii/guard";

export const maxDuration = 60;

const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CHAT_MODEL ?? "claude-sonnet-5-5";

// Wrap each tool definition so the AI SDK gets `tool({...})` objects.
const tools = Object.fromEntries(
  Object.entries(toolDefs).map(([name, def]) => [
    name,
    tool({
      description: def.description,
      inputSchema: def.inputSchema,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      execute: def.execute as (input: any) => Promise<unknown>,
    }),
  ]),
);

/** Strip anything that looks like an email from what the user typed. */
function redactMessages(messages: UIMessage[]): UIMessage[] {
  return messages.map((m) =>
    m.role !== "user"
      ? m
      : {
          ...m,
          parts: m.parts.map((p) => (p.type === "text" ? { ...p, text: redactEmails(p.text) } : p)),
        },
  );
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  if (!Array.isArray(messages) || messages.length > 60) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }

  const result = streamText({
    model: anthropic(MODEL),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(redactMessages(messages)),
    tools,
    stopWhen: isStepCount(6),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
