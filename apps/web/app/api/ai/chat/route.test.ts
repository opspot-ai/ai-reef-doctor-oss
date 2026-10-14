/**
 * Tests for POST /api/ai/chat (streaming chat route).
 *
 * Everything that touches the network or env is mocked: the Anthropic wrapper
 * (`streamChat`/`isAiConfigured`), the request-context resolver, and the
 * entitlements gate. No ANTHROPIC_API_KEY is required to run these.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─────────────────────────── mocks ───────────────────────────

const mocks = vi.hoisted(() => ({
  getRequestContext: vi.fn(),
  isAiConfigured: vi.fn(),
  streamChat: vi.fn(),
  enforceChat: vi.fn(),
  incrementUsage: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  getRequestContext: mocks.getRequestContext,
}));

vi.mock("@/lib/ai/anthropic", () => ({
  isAiConfigured: mocks.isAiConfigured,
  streamChat: mocks.streamChat,
  // The route imports `type Anthropic` only — no runtime value needed.
}));

vi.mock("@/lib/entitlements-server", () => ({
  enforceChat: mocks.enforceChat,
  incrementUsage: mocks.incrementUsage,
}));

import { POST } from "@/app/api/ai/chat/route";

// ─────────────────────────── fakes ───────────────────────────

interface StreamEvent {
  type: string;
  delta?: { type: string; text?: string };
}

/** A text_delta content_block_delta event. */
function textDelta(text: string): StreamEvent {
  return { type: "content_block_delta", delta: { type: "text_delta", text } };
}

/**
 * Build a fake MessageStream: an async-iterable over `events` plus a
 * `finalMessage()` that resolves to `final`.
 */
function fakeStream(events: StreamEvent[], final: unknown) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const ev of events) yield ev;
    },
    finalMessage: vi.fn().mockResolvedValue(final),
  };
}

/** A minimal end_turn final message carrying the given text. */
function endTurnMessage(text: string) {
  return {
    stop_reason: "end_turn",
    content: text ? [{ type: "text", text }] : [],
  };
}

/** Chainable Supabase stub: every read resolves to `{ data: null }`, writes succeed. */
function fakeSupabase() {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = vi.fn(chain);
  builder.eq = vi.fn(chain);
  builder.order = vi.fn(chain);
  builder.limit = vi.fn(chain);
  builder.insert = vi.fn(chain);
  builder.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  builder.then = undefined;
  return {
    from: vi.fn(() => builder),
  } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  messages: [{ role: "user", content: "Why are my zoas closed up?" }],
};

/** Drain a streaming Response body into a single decoded string. */
async function readBody(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  out += decoder.decode();
  return out;
}

// ─────────────────────────── setup ───────────────────────────

beforeEach(() => {
  mocks.getRequestContext.mockResolvedValue({
    user: { id: "user-1", email: "reefer@example.com" },
    supabase: fakeSupabase(),
  });
  mocks.isAiConfigured.mockReturnValue(true);
  mocks.enforceChat.mockResolvedValue({ allowed: true, entitlements: {} });
  mocks.incrementUsage.mockResolvedValue(undefined);
  mocks.streamChat.mockReturnValue(
    fakeStream([textDelta("Hello reefer")], endTurnMessage("Hello reefer")),
  );
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────── tests ───────────────────────────

describe("POST /api/ai/chat — guards", () => {
  it("returns 401 when there is no user", async () => {
    mocks.getRequestContext.mockResolvedValue({
      user: null,
      supabase: fakeSupabase(),
    });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(401);
    expect(mocks.streamChat).not.toHaveBeenCalled();
  });

  it("returns 503 when AI is not configured", async () => {
    mocks.isAiConfigured.mockReturnValue(false);
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(503);
    const json = (await res.json()) as { code?: string };
    expect(json.code).toBe("not_configured");
    expect(mocks.streamChat).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid body", async () => {
    const res = await POST(makeRequest({ messages: [] }));
    expect(res.status).toBe(400);
    expect(mocks.streamChat).not.toHaveBeenCalled();
  });

  it("returns 402 with upgradeTo when over the chat cap", async () => {
    mocks.enforceChat.mockResolvedValue({
      allowed: false,
      upgradeTo: "pro",
      entitlements: {},
    });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(402);
    const json = (await res.json()) as { code?: string; upgradeTo?: string };
    expect(json.code).toBe("over_limit");
    expect(json.upgradeTo).toBe("pro");
    expect(mocks.streamChat).not.toHaveBeenCalled();
  });
});

describe("POST /api/ai/chat — streaming", () => {
  it("returns an SSE Response that forwards text deltas and a done event", async () => {
    mocks.streamChat.mockReturnValue(
      fakeStream(
        [textDelta("White spots "), textDelta("suggest ich.")],
        endTurnMessage("White spots suggest ich."),
      ),
    );

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
    expect(res.headers.get("Cache-Control")).toContain("no-cache");

    const text = await readBody(res);
    expect(text).toContain('data: {"type":"text","text":"White spots "}');
    expect(text).toContain('data: {"type":"text","text":"suggest ich."}');
    expect(text).toContain('data: {"type":"done"}');
  });

  it("increments usage after streaming completes", async () => {
    const res = await POST(makeRequest(VALID_BODY));
    await readBody(res);
    // Persistence is fired after the stream closes; give microtasks a tick.
    await new Promise((r) => setTimeout(r, 0));
    expect(mocks.incrementUsage).toHaveBeenCalledWith("user-1", "ai_chats");
  });

  it("runs a bounded tool loop: tool_use round then a text round", async () => {
    // First stream: model asks to call get_tank_parameters (no text yet).
    const toolUseFinal = {
      stop_reason: "tool_use",
      content: [
        {
          type: "tool_use",
          id: "toolu_1",
          name: "get_tank_parameters",
          input: {},
        },
      ],
    };
    // Second stream: model produces its final answer using the tool result.
    mocks.streamChat
      .mockReturnValueOnce(fakeStream([], toolUseFinal))
      .mockReturnValueOnce(
        fakeStream(
          [textDelta("Your nitrate is fine.")],
          endTurnMessage("Your nitrate is fine."),
        ),
      );

    const res = await POST(makeRequest(VALID_BODY));
    const text = await readBody(res);

    // streamChat was invoked twice (one tool round + one text round).
    expect(mocks.streamChat).toHaveBeenCalledTimes(2);
    expect(text).toContain('data: {"type":"text","text":"Your nitrate is fine."}');
    expect(text).toContain('data: {"type":"done"}');

    // The second call must include the tool_result turn we appended.
    const secondCallArgs = mocks.streamChat.mock.calls[1]![0] as {
      messages: Array<{ role: string; content: unknown }>;
    };
    const hasToolResult = secondCallArgs.messages.some(
      (m) =>
        Array.isArray(m.content) &&
        (m.content as Array<{ type?: string }>).some(
          (b) => b.type === "tool_result",
        ),
    );
    expect(hasToolResult).toBe(true);
  });

  it("stops the tool loop at MAX_TOOL_ROUNDS even if the model keeps calling tools", async () => {
    const toolUseFinal = {
      stop_reason: "tool_use",
      content: [
        { type: "tool_use", id: "t", name: "get_tank_parameters", input: {} },
      ],
    };
    // Always ask for a tool — the route must still terminate.
    mocks.streamChat.mockReturnValue(fakeStream([], toolUseFinal));

    const res = await POST(makeRequest(VALID_BODY));
    const text = await readBody(res);

    expect(mocks.streamChat).toHaveBeenCalledTimes(3); // MAX_TOOL_ROUNDS
    expect(text).toContain('data: {"type":"done"}');
  });
});
