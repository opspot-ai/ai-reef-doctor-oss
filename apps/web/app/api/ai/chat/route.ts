/**
 * POST /api/ai/chat — streaming Reef Doctor chat .
 *
 * Streams the assistant's reply as Server-Sent Events. Each event is a single
 * `data: <json>\n\n` line whose JSON is one of:
 *   { "type": "text", "text": "..." }   — a forwarded text delta
 *   { "type": "done" }                  — terminal marker
 *
 * Flow:
 *  1. Resolve the caller (cookies or Bearer). 401 if anonymous; 503 if the AI
 *     key isn't configured (NEVER crash — owner must add ANTHROPIC_API_KEY).
 *  2. Validate the body; enforce the monthly chat cap (402 over limit).
 *  3. If a tank is selected, load it + its latest reading (+ a livestock
 *     summary) for tank context; RAG-ground the last user message.
 *  4. Stream via the wrapper with a BOUNDED tool loop (max 3 rounds): forward
 *     text deltas; on stop_reason "tool_use", run each tool deterministically,
 *     feed the results back, and continue; otherwise finish.
 *  5. Best-effort persistence (never blocks the response): ensure a thread,
 *     insert the user + assistant messages, and bump usage.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRequestContext } from "@/lib/api-auth";
import { ApiErrors } from "@/lib/http";
import { isAiConfigured, streamChat, type Anthropic } from "@/lib/ai/anthropic";
import { buildSystemBlocks, buildTankContext } from "@/lib/ai/system-prompt";
import { groundFor } from "@/lib/ai/rag";
import { CHAT_TOOLS, executeTool, type ToolContext } from "@/lib/ai/tools";
import {
  enforceChat,
  incrementUsage,
  type SupabaseLike,
} from "@/lib/entitlements-server";
import {
  ChatRequestSchema,
  type ChatMessage,
  type ParameterReading,
  type Tank,
} from "@reef/shared";

export const runtime = "nodejs";

/** Cap on the agentic tool loop so a misbehaving model can't spin forever. */
const MAX_TOOL_ROUNDS = 3;

/** Encode an SSE event object as a `data:` line. */
function sse(event: Record<string, unknown>): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(req: Request): Promise<Response> {
  const { user, supabase } = await getRequestContext(req);
  if (!user) return ApiErrors.unauthorized();
  if (!isAiConfigured()) return ApiErrors.notConfigured("AI");

  // 1) Validate the request body.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return ApiErrors.badRequest("Expected a JSON body.");
  }
  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return ApiErrors.badRequest("Invalid chat request.");
  }
  const { tankId, threadId, messages } = parsed.data;

  // 2) Enforce the monthly chat cap. The RLS-scoped client is a structural
  //    superset of the SupabaseLike slice the gate reads through.
  const gate = await enforceChat(supabase as unknown as SupabaseLike, user.id);
  if (!gate.allowed) {
    return ApiErrors.overLimit(
      "You've used your free monthly chats.",
      gate.upgradeTo,
    );
  }

  // 3) Tank context + RAG grounding.
  let tankContext: string | undefined;
  let toolCtx: ToolContext = {};
  if (tankId) {
    try {
      const tank = await loadTank(supabase, tankId);
      if (tank) {
        const latest = await loadLatestParameters(supabase, tankId);
        const livestockSummary = await loadLivestockSummary(supabase, tankId);
        tankContext = buildTankContext(tank, latest, livestockSummary);
        toolCtx = {
          tankType: tank.type,
          volumeLiters: tank.volume_liters,
          // Re-read at tool-call time so the model gets the freshest reading.
          getParameters: () => loadLatestParameters(supabase, tankId),
        };
      }
    } catch {
      // Context is best-effort — never block the chat on a load error.
      tankContext = undefined;
    }
  }

  const lastUserText = lastUserMessage(messages);
  const grounding = groundFor(lastUserText);

  const system = buildSystemBlocks({
    knowledgeContext: grounding.context || undefined,
    tankContext,
  });

  // 4) Convert ChatRequest.messages into Anthropic message params.
  const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));

  // 5) Stream with a bounded tool loop, collecting the final assistant text for
  //    persistence.
  const encoder = new TextEncoder();
  let assistantText = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emitText = (text: string) => {
        if (!text) return;
        assistantText += text;
        controller.enqueue(encoder.encode(sse({ type: "text", text })));
      };

      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const ms = streamChat({
            system,
            messages: anthropicMessages,
            tools: CHAT_TOOLS,
          });

          for await (const ev of ms) {
            if (
              ev.type === "content_block_delta" &&
              ev.delta.type === "text_delta"
            ) {
              emitText(ev.delta.text);
            }
          }

          const final = await ms.finalMessage();

          if (final.stop_reason !== "tool_use") {
            break;
          }

          // Run each tool call deterministically and feed the results back.
          const toolUses = final.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
          );
          if (toolUses.length === 0) break;

          // Echo the model's assistant turn (its tool_use blocks) verbatim.
          anthropicMessages.push({ role: "assistant", content: final.content });

          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const tu of toolUses) {
            let resultText: string;
            let isError = false;
            try {
              const out = await executeTool(tu.name, tu.input, toolCtx);
              resultText = JSON.stringify(out ?? null);
            } catch (err) {
              isError = true;
              resultText = JSON.stringify({
                error: err instanceof Error ? err.message : "tool failed",
              });
            }
            toolResults.push({
              type: "tool_result",
              tool_use_id: tu.id,
              content: resultText,
              ...(isError ? { is_error: true } : {}),
            });
          }

          anthropicMessages.push({ role: "user", content: toolResults });
          // Loop continues for the next round (the model's text response).
        }
      } catch (err) {
        console.error("[ai/chat] stream error", err);
        controller.enqueue(
          encoder.encode(
            sse({
              type: "text",
              text:
                "\n\nSorry — something went wrong while answering. Please try again.",
            }),
          ),
        );
      } finally {
        controller.enqueue(encoder.encode(sse({ type: "done" })));
        controller.close();
      }

      // 6) Best-effort persistence — never block or throw into the stream.
      void persist({
        supabase,
        userId: user.id,
        tankId,
        threadId,
        userText: lastUserText,
        assistantText,
      });
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

// ─────────────────────────── helpers ───────────────────────────

/** The tank columns we read for context (a structural slice of {@link Tank}). */
type TankContextRow = Pick<Tank, "name" | "type" | "volume_liters"> & {
  started_at?: string | null;
};

/** Load the selected tank (owner-scoped via RLS). */
async function loadTank(
  supabase: SupabaseClient,
  tankId: string,
): Promise<TankContextRow | null> {
  const { data, error } = await supabase
    .from("tanks")
    .select("name, type, volume_liters, started_at")
    .eq("id", tankId)
    .maybeSingle();
  if (error || !data) return null;
  return data as TankContextRow;
}

/** Load the tank's most recent water-test reading, or null. */
async function loadLatestParameters(
  supabase: SupabaseClient,
  tankId: string,
): Promise<ParameterReading | null> {
  try {
    const { data, error } = await supabase
      .from("parameters")
      .select(
        "measured_at, salinity_sg, temp_c, ph, alkalinity_dkh, calcium_ppm, magnesium_ppm, ammonia_ppm, nitrite_ppm, nitrate_ppm, phosphate_ppm, orp_mv, source, notes",
      )
      .eq("tank_id", tankId)
      .order("measured_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return data as ParameterReading;
  } catch {
    return null;
  }
}

/** Build a short, human-readable summary of the tank's living livestock. */
async function loadLivestockSummary(
  supabase: SupabaseClient,
  tankId: string,
): Promise<string | undefined> {
  try {
    const { data, error } = await supabase
      .from("livestock")
      .select("common_name, kind, status")
      .eq("tank_id", tankId)
      .eq("status", "alive")
      .limit(40);
    if (error || !data || !Array.isArray(data) || data.length === 0) {
      return undefined;
    }
    const names = (data as Array<{ common_name?: string | null }>)
      .map((r) => r.common_name)
      .filter((n): n is string => typeof n === "string" && n.length > 0);
    return names.length > 0 ? names.join(", ") : undefined;
  } catch {
    return undefined;
  }
}

/** The text of the last user-role message (for RAG grounding + persistence). */
function lastUserMessage(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m && m.role === "user") return m.content;
  }
  return "";
}

/**
 * Best-effort persistence: ensure a chat thread, insert the latest user message
 * and the assistant reply, and bump the usage counter. Swallows every error so
 * a logging failure never affects the already-streamed response.
 */
async function persist(opts: {
  supabase: SupabaseClient;
  userId: string;
  tankId?: string;
  threadId?: string;
  userText: string;
  assistantText: string;
}): Promise<void> {
  const { supabase, userId, tankId, threadId, userText, assistantText } = opts;

  // Usage accounting is independent of message persistence — always attempt it
  // (even if thread/message writes fail) so the monthly cap stays accurate.
  try {
    await incrementUsage(userId, "ai_chats");
  } catch {
    // Best-effort accounting.
  }

  try {
    let resolvedThreadId = threadId;
    if (!resolvedThreadId) {
      const title = userText.slice(0, 80) || "New chat";
      const { data } = await supabase
        .from("chat_threads")
        .insert({
          user_id: userId,
          ...(tankId ? { tank_id: tankId } : {}),
          title,
        })
        .select("id")
        .maybeSingle();
      resolvedThreadId = (data as { id?: string } | null)?.id;
    }

    if (!resolvedThreadId) return;

    const rows: Array<{
      thread_id: string;
      user_id: string;
      role: "user" | "assistant";
      content: string;
    }> = [];
    if (userText) {
      rows.push({
        thread_id: resolvedThreadId,
        user_id: userId,
        role: "user",
        content: userText,
      });
    }
    if (assistantText) {
      rows.push({
        thread_id: resolvedThreadId,
        user_id: userId,
        role: "assistant",
        content: assistantText,
      });
    }
    if (rows.length > 0) {
      await supabase.from("chat_messages").insert(rows);
    }
  } catch {
    // Persistence is best-effort.
  }
}
