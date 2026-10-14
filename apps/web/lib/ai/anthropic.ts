import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { serverEnv, features } from "@/lib/env";
import type { SystemBlock } from "@/lib/ai/system-prompt";

/** Default model for everything, especially diagnosis & vision . */
export const DEFAULT_MODEL = "claude-opus-4-8";
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

let _client: Anthropic | null = null;

export function isAiConfigured(): boolean {
  return features.ai;
}

export function getAnthropic(): Anthropic {
  if (!features.ai) throw new Error("ANTHROPIC_API_KEY is not configured");
  if (!_client) _client = new Anthropic({ apiKey: serverEnv.anthropicApiKey });
  return _client;
}

function textFromMessage(msg: Anthropic.Message): string {
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

export type StructuredResult<T> =
  | { ok: true; data: T }
  | { ok: false; refusal: string };

/**
 * One-shot structured generation with adaptive thinking + high effort and a
 * JSON-schema output format. Re-validates the model's JSON with the zod schema.
 * NO temperature/top_p/top_k, NO budget_tokens (would 400 on Opus 4.8).
 */
export async function generateStructured<T>(opts: {
  schema: z.ZodType<T>;
  jsonSchema: Record<string, unknown>;
  system: SystemBlock[] | string;
  messages: Anthropic.MessageParam[];
  maxTokens?: number;
  effort?: Effort;
}): Promise<StructuredResult<T>> {
  const client = getAnthropic();
  const res = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: opts.maxTokens ?? 16000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: opts.effort ?? "high",
      format: { type: "json_schema", schema: opts.jsonSchema },
    },
    // SystemBlock is a structural subset of the SDK's TextBlockParam.
    system: opts.system as Anthropic.MessageCreateParams["system"],
    messages: opts.messages,
  });

  // Guard refusals BEFORE reading content .
  if (res.stop_reason === "refusal") {
    return { ok: false, refusal: "The assistant declined to answer this request." };
  }

  const text = textFromMessage(res);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("AI returned non-JSON structured output");
  }
  const parsed = opts.schema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`AI structured output failed validation: ${parsed.error.message}`);
  }
  return { ok: true, data: parsed.data };
}

export interface ChatTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/**
 * Streaming chat. Returns the SDK MessageStream; the route turns it into an
 * SSE/ReadableStream response and may call `.finalMessage()` to persist.
 */
export function streamChat(opts: {
  system: SystemBlock[] | string;
  messages: Anthropic.MessageParam[];
  tools?: ChatTool[];
  maxTokens?: number;
}) {
  const client = getAnthropic();
  return client.messages.stream({
    model: DEFAULT_MODEL,
    max_tokens: opts.maxTokens ?? 64000,
    system: opts.system as Anthropic.MessageCreateParams["system"],
    messages: opts.messages,
    ...(opts.tools
      ? { tools: opts.tools as unknown as Anthropic.Tool[] }
      : {}),
  });
}

export type { Anthropic };
