/**
 * Doctor tools  — deterministic functions the chat model can call.
 *
 * The chat model never does dosing math or invents grounding facts itself: it
 * calls one of these tools, the server runs the *trusted* shared implementation
 * (clamped dosing math, the curated reef-knowledge retriever, the tank's real
 * latest reading), and the result is fed back into the conversation.
 *
 * - `CHAT_TOOLS` is the JSON-Schema tool list handed to `streamChat({ tools })`.
 * - `executeTool(name, input, ctx)` dispatches a tool call to its shared impl.
 *
 * Nothing here touches Anthropic or the network — these are pure/deterministic
 * (the only side-effect is the caller-supplied `ctx.getParameters` callback),
 * so they are safe to run (and test) with NO ANTHROPIC_API_KEY.
 */
import type { ChatTool } from "@/lib/ai/anthropic";
import {
  doseAlk,
  doseCalcium,
  doseMagnesium,
  copperDose,
  retrieve,
  type DoseResult,
  type KnowledgeEntry,
  type ParameterReading,
} from "@reef/shared";

export type { DoseResult };

// ─────────────────────────── tool definitions ───────────────────────────

/** Supported dosing parameters (mirrors the shared dosing wrappers). */
const DOSING_PARAMETERS = [
  "alkalinity",
  "calcium",
  "magnesium",
  "copper",
] as const;
type DosingParameter = (typeof DOSING_PARAMETERS)[number];

/**
 * JSON-Schema tool list for the chat model. `input_schema` is a plain JSON
 * Schema object (the SDK validates the model's tool input against it).
 */
export const CHAT_TOOLS: ChatTool[] = [
  {
    name: "get_tank_parameters",
    description:
      "Get the user's most recent water-test reading for the selected tank " +
      "(salinity, temperature, pH, alkalinity, calcium, magnesium, ammonia, " +
      "nitrite, nitrate, phosphate). Takes no input. Returns the latest " +
      "reading or null if none has been logged. Prefer this over asking the " +
      "user to retype numbers they have already recorded.",
    input_schema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "dosing_calculator",
    description:
      "Calculate the supplement volume (mL) to raise a water parameter from a " +
      "current value to a target, using safe, clamped reef dosing math. " +
      "Supports alkalinity (dKH), calcium (ppm), magnesium (ppm), and copper " +
      "(ppm, quarantine treatment only). Doses that would change a parameter " +
      "too fast are automatically split across multiple days; copper targets " +
      "are clamped into the therapeutic window. Always returns a dose warning.",
    input_schema: {
      type: "object",
      properties: {
        parameter: {
          type: "string",
          enum: [...DOSING_PARAMETERS],
          description: "Which parameter to dose.",
        },
        volumeLiters: {
          type: "number",
          description:
            "Total system water volume in litres. If omitted, the tank's " +
            "configured volume is used.",
        },
        current: {
          type: "number",
          description: "Current measured value of the parameter.",
        },
        target: {
          type: "number",
          description: "Desired target value of the parameter.",
        },
        copperType: {
          type: "string",
          enum: ["ionic", "chelated"],
          description:
            "Copper product type (required for parameter=copper). Ionic " +
            "(e.g. Cupramine) vs chelated (e.g. Copper Power) — NOT " +
            "interchangeable. Defaults to ionic.",
        },
        productPpmPerMlPerL: {
          type: "number",
          description:
            "For copper: how much ppm 1 mL of the product raises in 1 L of " +
            "water (from the product label).",
        },
      },
      required: ["parameter", "current", "target"],
      additionalProperties: false,
    },
  },
  {
    name: "lookup_species",
    description:
      "Look up curated reef knowledge about a species, disease, coral, algae, " +
      "pest, or care topic by keyword. Returns matching grounding entries " +
      "(title, body, source citation) from the reef knowledge base. Use this " +
      "to ground species/disease/care answers in citeable facts.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Search terms, e.g. a species or disease name ('clownfish', " +
            "'marine ich', 'bryopsis').",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "compatibility_check",
    description:
      "Check curated reef knowledge for compatibility/care notes about a set " +
      "of livestock or items kept together. Returns matching grounding " +
      "entries (title, body, source). Use this when the user asks whether " +
      "things can be kept together or how they interact.",
    input_schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: { type: "string" },
          description:
            "The livestock / items to check together, e.g. " +
            "['clownfish', 'cleaner shrimp', 'hammer coral'].",
        },
      },
      required: ["items"],
      additionalProperties: false,
    },
  },
];

// ─────────────────────────── execution context ───────────────────────────

export interface ToolContext {
  /** Resolve the selected tank's latest reading (route supplies this). */
  getParameters?: () => Promise<ParameterReading | null>;
  /** Selected tank type (for future tank-aware tools). */
  tankType?: string;
  /** Selected tank water volume in litres (fallback for dosing). */
  volumeLiters?: number;
}

/** Knowledge entry shape returned to the model (citeable subset). */
export interface KnowledgeMatch {
  id: string;
  title: string;
  body: string;
  source: string;
}

function toMatches(entries: KnowledgeEntry[]): KnowledgeMatch[] {
  return entries.map((e) => ({
    id: e.id,
    title: e.title,
    body: e.body,
    source: e.source,
  }));
}

// ─────────────────────────── dispatch ───────────────────────────

const RETRIEVE_K = 4;

function runDosingCalculator(
  input: Record<string, unknown>,
  ctx: ToolContext,
): DoseResult {
  const parameter = input.parameter as DosingParameter;
  if (!DOSING_PARAMETERS.includes(parameter)) {
    throw new Error(`Unsupported dosing parameter: ${String(parameter)}`);
  }

  const volumeLiters = Number(
    input.volumeLiters ?? ctx.volumeLiters ?? 0,
  );
  const current = Number(input.current);
  const target = Number(input.target);

  switch (parameter) {
    case "alkalinity":
      return doseAlk({ volumeLiters, currentDkh: current, targetDkh: target });
    case "calcium":
      return doseCalcium({ volumeLiters, currentPpm: current, targetPpm: target });
    case "magnesium":
      return doseMagnesium({ volumeLiters, currentPpm: current, targetPpm: target });
    case "copper": {
      const type = input.copperType === "chelated" ? "chelated" : "ionic";
      // Strength must be positive for a real number; copperDose returns 0 mL
      // with full warnings when it isn't, so default to 0 (safe, non-throwing).
      const productPpmPerMlPerL = Number(input.productPpmPerMlPerL ?? 0);
      return copperDose({
        volumeLiters,
        currentPpm: current,
        targetPpm: target,
        type,
        productPpmPerMlPerL,
      });
    }
  }
}

/**
 * Execute a named tool call with the given input and context. Returns the
 * deterministic result to feed back to the model.
 *
 * - `dosing_calculator` → the matching clamped/warned shared dosing fn.
 * - `lookup_species` / `compatibility_check` → reef-knowledge retrieval.
 * - `get_tank_parameters` → `ctx.getParameters?.()` (or null).
 * - unknown name → throws.
 */
export async function executeTool(
  name: string,
  input: unknown,
  ctx: ToolContext,
): Promise<unknown> {
  const args = (input ?? {}) as Record<string, unknown>;

  switch (name) {
    case "get_tank_parameters":
      return (await ctx.getParameters?.()) ?? null;

    case "dosing_calculator":
      return runDosingCalculator(args, ctx);

    case "lookup_species": {
      const query = typeof args.query === "string" ? args.query : "";
      return toMatches(retrieve(query, RETRIEVE_K));
    }

    case "compatibility_check": {
      const items = Array.isArray(args.items)
        ? args.items.filter((x): x is string => typeof x === "string")
        : [];
      return toMatches(retrieve(items.join(" "), RETRIEVE_K));
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
