"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type Vapi from "@vapi-ai/web";

export type VoiceTurn = { id: string; role: "user" | "assistant"; text: string; final: boolean };
export type ShownResult = { id: string; result_id?: string; view: "table" | "chart"; title?: string };

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
const ASSISTANT_ID = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;
const CONFIGURED = !!PUBLIC_KEY && !!ASSISTANT_ID;

type VapiMsg = {
  type: string;
  role?: "user" | "assistant";
  transcriptType?: "partial" | "final";
  transcript?: string;
  toolCallList?: { id: string; function?: { name?: string; arguments?: unknown }; name?: string; parameters?: unknown }[];
};

/**
 * Mic button + live transcript. Data tools run on the server (same backend
 * as chat); `show_result` is a client-side tool, so Vapi hands it to the
 * browser as a `tool-calls` message and we render the table/chart here.
 */
export function useVoice(opts: { onTurn: (t: VoiceTurn) => void; onShow: (r: ShownResult) => void }) {
  const vapiRef = useRef<Vapi | null>(null);
  const [state, setState] = useState<"idle" | "connecting" | "live" | "unavailable">(CONFIGURED ? "idle" : "unavailable");
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { onTurn, onShow } = opts;
  const partialIds = useRef<{ user?: string; assistant?: string }>({});

  useEffect(() => {
    if (!CONFIGURED) return;
    let v: Vapi | null = null;
    import("@vapi-ai/web").then(({ default: VapiCtor }) => {
      v = new VapiCtor(PUBLIC_KEY!);
      vapiRef.current = v;
      v.on("call-start", () => setState("live"));
      v.on("call-end", () => { setState("idle"); setSpeaking(false); });
      v.on("speech-start", () => setSpeaking(true));
      v.on("speech-end", () => setSpeaking(false));
      v.on("error", (e: unknown) => { setError(typeof e === "string" ? e : (e as { message?: string })?.message ?? "Voice error"); setState("idle"); });
      v.on("message", (m: VapiMsg) => {
        if (m.type === "transcript" && m.role && m.transcript) {
          const final = m.transcriptType === "final";
          const key = m.role;
          const id = partialIds.current[key] ?? `v_${Date.now()}_${key}`;
          partialIds.current[key] = final ? undefined : id;
          onTurn({ id, role: m.role, text: m.transcript, final });
        }
        if (m.type === "tool-calls" && Array.isArray(m.toolCallList)) {
          for (const c of m.toolCallList) {
            const name = c.function?.name ?? c.name;
            if (name !== "show_result") continue;
            let args: Record<string, unknown> = {};
            const raw = c.function?.arguments ?? c.parameters;
            try { args = typeof raw === "string" ? JSON.parse(raw) : ((raw as Record<string, unknown>) ?? {}); } catch { /* ignore */ }
            onShow({ id: c.id, result_id: typeof args.result_id === "string" ? args.result_id : undefined, view: args.view === "chart" ? "chart" : "table", title: typeof args.title === "string" ? args.title : undefined });
          }
        }
      });
    });
    return () => { v?.stop(); };
  }, [onTurn, onShow]);

  const toggle = useCallback(async () => {
    const v = vapiRef.current;
    if (!v) return;
    if (state === "live" || state === "connecting") { v.stop(); setState("idle"); return; }
    setError(null); setState("connecting");
    try { await v.start(ASSISTANT_ID!); } catch (e) { setError((e as Error).message); setState("idle"); }
  }, [state]);

  return { state, speaking, error, toggle };
}
