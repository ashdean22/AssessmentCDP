/**
 * Vapi tool webhook: secret header required, tool-calls dispatched through the
 * shared tool backend, PII guard applied, unknown tools refused.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/tools", () => ({
  toolDefs: { count_segment: {}, leaky: {} },
  runTool: vi.fn(async (name: string) => {
    if (name === "count_segment") return { count: 42, filter: "source = instagram" };
    if (name === "leaky") return { note: "contact ann@example.com" };
    throw new Error("boom");
  }),
}));

const SECRET = "vapi_test_secret";

function post(body: unknown, secret: string | null = SECRET) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (secret !== null) headers["x-vapi-secret"] = secret;
  return new Request("http://localhost/api/vapi/tools", { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) });
}

const toolCalls = (calls: unknown[]) => ({ message: { type: "tool-calls", toolCallList: calls } });

describe("POST /api/vapi/tools", () => {
  beforeEach(() => { process.env.VAPI_SERVER_SECRET = SECRET; });

  it("rejects a missing or wrong secret, and refuses everything when none is configured", async () => {
    const { POST } = await import("@/app/api/vapi/tools/route");
    expect((await POST(post(toolCalls([]), null))).status).toBe(401);
    expect((await POST(post(toolCalls([]), "nope"))).status).toBe(401);
    delete process.env.VAPI_SERVER_SECRET;
    expect((await POST(post(toolCalls([]), SECRET))).status).toBe(401);
  });

  it("returns 400 on bad JSON and acknowledges non tool-call messages", async () => {
    const { POST } = await import("@/app/api/vapi/tools/route");
    expect((await POST(post("{not json"))).status).toBe(400);
    const res = await POST(post({ message: { type: "status-update" } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("runs a known tool and returns its result keyed by toolCallId", async () => {
    const { POST } = await import("@/app/api/vapi/tools/route");
    const res = await POST(post(toolCalls([{ id: "tc1", function: { name: "count_segment", arguments: '{"filter":{"op":"AND","rules":[]}}' } }])));
    const { results } = await res.json();
    expect(results).toHaveLength(1);
    expect(results[0].toolCallId).toBe("tc1");
    expect(JSON.parse(results[0].result)).toEqual({ count: 42, filter: "source = instagram" });
  });

  it("refuses unknown tools (email lookups) and blocks outputs that contain an email", async () => {
    const { POST } = await import("@/app/api/vapi/tools/route");
    const res = await POST(post(toolCalls([
      { id: "a", function: { name: "lookup_subscriber", arguments: "{}" } },
      { id: "b", function: { name: "leaky", arguments: "{}" } },
    ])));
    const { results } = await res.json();
    expect(results[0].error).toMatch(/Lookup page/);
    expect(results[0].result).toBeUndefined();
    expect(results[1].error).toMatch(/PII guard/);
    expect(JSON.stringify(results[1])).not.toMatch(/example\.com/);
  });
});
