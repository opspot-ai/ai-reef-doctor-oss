import { fetch as expoFetch } from "expo/fetch";
import type { ChatMessage } from "@reef/shared";
import { publicEnv } from "@/lib/env";
import { getAccessToken } from "@/lib/supabase";

/**
 * Streaming transport for the Reef Doctor chat.
 *
 * POSTs { tankId, messages } to `${apiBaseUrl}/api/ai/chat` with a Supabase
 * bearer token and reads the SSE response body incrementally via Expo's
 * streaming `fetch` (response.body.getReader()). Each SSE event is a
 * `data: <json>` line whose JSON is one of:
 *   { type: "text", text }  → append the delta
 *   { type: "done" }        → terminal marker
 *   { type: "error", text } → render an error bubble
 *
 * If streaming throws or isn't supported, callers fall back to
 * {@link fetchChatOnce} which reads the whole body and parses the same SSE
 * frames in one shot. All AI secrets stay server-side — we only send a token.
 */

export interface StreamCallbacks {
  onText: (delta: string) => void;
  onError: (message: string) => void;
  onDone: () => void;
}

export interface ChatStreamRequest {
  tankId?: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
}

const CHAT_PATH = "/api/ai/chat";

function chatUrl(): string {
  return `${publicEnv.apiBaseUrl.replace(/\/+$/, "")}${CHAT_PATH}`;
}

async function buildHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "text/event-stream",
  };
  const token = await getAccessToken();
  if (token) headers["authorization"] = `Bearer ${token}`;
  return headers;
}

function body(req: ChatStreamRequest): string {
  // Only forward a tankId when it looks like a UUID — the server validates it
  // strictly and would 400 on a non-UUID id (e.g. a demo placeholder).
  const isUuid =
    !!req.tankId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      req.tankId,
    );
  return JSON.stringify({
    ...(isUuid ? { tankId: req.tankId } : {}),
    messages: req.messages,
  });
}

/** Parse complete SSE events out of a rolling buffer; returns leftover text. */
function drainEvents(buffer: string, cb: StreamCallbacks): {
  rest: string;
  done: boolean;
  sawText: boolean;
} {
  let rest = buffer;
  let done = false;
  let sawText = false;
  let sep: number;
  while ((sep = rest.indexOf("\n\n")) !== -1) {
    const rawEvent = rest.slice(0, sep);
    rest = rest.slice(sep + 2);
    for (const line of rawEvent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const json = trimmed.slice(5).trim();
      if (!json) continue;
      let event: { type?: string; text?: string };
      try {
        event = JSON.parse(json) as { type?: string; text?: string };
      } catch {
        continue;
      }
      if (event.type === "text" && event.text) {
        sawText = true;
        cb.onText(event.text);
      } else if (event.type === "error") {
        cb.onError(event.text || "");
        done = true;
        return { rest, done, sawText };
      } else if (event.type === "done") {
        done = true;
        return { rest, done, sawText };
      }
    }
  }
  return { rest, done, sawText };
}

/**
 * Stream a chat reply. Resolves true if any text was received (or a graceful
 * end), false if the request failed before producing content (so the caller can
 * try the non-streaming fallback). Aborts are surfaced via the `aborted` flag.
 */
export async function streamChat(
  req: ChatStreamRequest,
  cb: StreamCallbacks,
): Promise<{ ok: boolean; aborted: boolean }> {
  try {
    const res = await expoFetch(chatUrl(), {
      method: "POST",
      headers: await buildHeaders(),
      body: body(req),
      signal: req.signal,
    });

    if (!res.ok || !res.body) {
      return { ok: false, aborted: false };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let sawText = false;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const drained = drainEvents(buffer, cb);
      buffer = drained.rest;
      if (drained.sawText) sawText = true;
      if (drained.done) {
        cb.onDone();
        return { ok: true, aborted: false };
      }
    }
    // Flush any trailing buffered text.
    buffer += decoder.decode();
    const tail = drainEvents(buffer + "\n\n", cb);
    if (tail.sawText) sawText = true;
    cb.onDone();
    return { ok: sawText || tail.done, aborted: false };
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") {
      return { ok: true, aborted: true };
    }
    return { ok: false, aborted: false };
  }
}

/**
 * Non-streaming fallback: fetch the whole response and parse the buffered SSE
 * frames at once. Used when streaming fetch fails or isn't available.
 */
export async function fetchChatOnce(
  req: ChatStreamRequest,
  cb: StreamCallbacks,
): Promise<{ ok: boolean; aborted: boolean }> {
  try {
    // Use the global fetch here (full-body read, no streaming required).
    const res = await fetch(chatUrl(), {
      method: "POST",
      headers: await buildHeaders(),
      body: body(req),
      signal: req.signal,
    });
    if (!res.ok) return { ok: false, aborted: false };
    const text = await res.text();
    const drained = drainEvents(text.endsWith("\n\n") ? text : text + "\n\n", cb);
    cb.onDone();
    return { ok: drained.sawText || drained.done, aborted: false };
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") {
      return { ok: true, aborted: true };
    }
    return { ok: false, aborted: false };
  }
}
