"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ResultTable } from "./result-table";
import { TrendChart } from "./trend-chart";

const STARTERS = [
  "How many Instagram signups went cold last month?",
  "Build me a list of our most engaged readers",
  "Which pages do new subscribers hit first?",
  "Which source brings the most loyal subscribers?",
  "How many app users never open the newsletter?",
];

const btn = "rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-medium hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-800";

export function Chat() {
  const [chatId, setChatId] = useState(() => `c_${Date.now()}`);
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, stop, regenerate, error } = useChat({
    id: chatId,
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, status]);

  const busy = status === "submitted" || status === "streaming";
  const send = (text: string) => { if (text.trim()) { sendMessage({ text }); setInput(""); } };

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-neutral-200 dark:border-neutral-800">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="mx-auto max-w-xl py-10 text-center">
            <p className="text-sm text-neutral-500">Try one of the Growth team&apos;s questions:</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {STARTERS.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800">{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => <Message key={m.id} m={m} />)}
        {status === "submitted" && <div className="text-sm text-neutral-400">Thinking…</div>}
        {error && <div className="text-sm text-red-600">Something went wrong: {error.message}</div>}
        <div ref={bottom} />
      </div>

      <div className="border-t border-neutral-200 p-3 dark:border-neutral-800">
        <div className="mb-2 flex gap-2">
          {busy ? <button className={btn} onClick={() => stop()}>Stop</button>
                : <button className={btn} onClick={() => regenerate()} disabled={messages.length === 0}>Regenerate</button>}
          <button className={btn} onClick={() => { setChatId(`c_${Date.now()}`); setInput(""); }}>New chat</button>
          <span className="ml-auto self-center text-xs text-neutral-400">Emails you type are replaced with [EMAIL] before the model sees them.</span>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about subscribers, sources, pages, the app…"
            disabled={busy}
            className="flex-1 rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-200"
          />
          <button type="submit" disabled={busy || !input.trim()} className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900">Send</button>
        </form>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ messages

type ToolPart = {
  type: `tool-${string}`;
  toolCallId: string;
  state: "input-streaming" | "input-available" | "output-available" | "output-error";
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

function Message({ m }: { m: UIMessage }) {
  const isUser = m.role === "user";
  const text = m.parts.filter((p) => p.type === "text").map((p) => (p as { text: string }).text).join("");
  const tools = m.parts.filter((p) => p.type.startsWith("tool-")) as unknown as ToolPart[];
  const copy = () => navigator.clipboard?.writeText(text);

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${isUser ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "bg-neutral-100 dark:bg-neutral-900"}`}>
        {tools.map((t) => <ToolCard key={t.toolCallId} t={t} />)}
        {text && (
          <div className="prose prose-sm max-w-none prose-neutral dark:prose-invert prose-p:my-1.5 prose-table:my-2 prose-th:px-2 prose-td:px-2">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
          </div>
        )}
        {!isUser && text && (
          <div className="mt-1 flex justify-end">
            <button onClick={copy} className="text-[11px] text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200">copy</button>
          </div>
        )}
      </div>
    </div>
  );
}

function ToolCard({ t }: { t: ToolPart }) {
  const name = t.type.replace(/^tool-/, "");
  const out = (t.output ?? {}) as Record<string, unknown>;
  const ran = typeof out.ran === "string" ? out.ran : null;

  return (
    <div className="mb-2 rounded-lg border border-neutral-200 bg-white p-2.5 text-xs dark:border-neutral-700 dark:bg-neutral-950">
      <div className="flex items-center gap-2">
        <span className="rounded bg-neutral-900 px-1.5 py-0.5 font-mono text-[10px] text-white dark:bg-white dark:text-neutral-900">{name}</span>
        {t.state === "output-available" ? (
          ran ? <span className="text-neutral-600 dark:text-neutral-300"><span className="text-neutral-400">ran:</span> {ran}</span> : <span className="text-neutral-400">done</span>
        ) : t.state === "output-error" ? (
          <span className="text-red-600">{t.errorText}</span>
        ) : (
          <span className="text-neutral-400">running…</span>
        )}
      </div>

      {t.state === "output-available" && typeof out.result_id === "string" && (
        <ResultTable resultId={out.result_id} />
      )}
      {t.state === "output-available" && name === "trend" && Array.isArray(out.series) && (
        <TrendChart series={out.series as { period: string; count: number }[]} metric={String(out.metric)} />
      )}

      {t.state === "output-available" && (
        <details className="mt-2">
          <summary className="cursor-pointer text-neutral-500">What the AI saw</summary>
          <pre className="mt-1 max-h-64 overflow-auto rounded bg-neutral-100 p-2 font-mono text-[11px] dark:bg-neutral-900">{JSON.stringify({ input: t.input, output: t.output }, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}
