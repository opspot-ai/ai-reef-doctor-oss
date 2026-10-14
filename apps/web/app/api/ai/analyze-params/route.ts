/**
 * POST /api/ai/analyze-params — AI water-parameter trend analysis .
 *
 * Paid feature (Reef Keeper / pro+). Deterministic charts & classification are
 * free and rendered elsewhere; THIS route runs the model and is gated.
 *
 * Flow:
 *   1. Resolve caller; require auth; require ANTHROPIC_API_KEY (else 503).
 *   2. Validate body with AnalyzeParamsRequestSchema.
 *   3. Gate: free tier → 402 upgrade-to pro.
 *   4. Deterministic pre-pass: classifyReading on the most recent reading to
 *      compute objective findings; RAG-ground on the out-of-range params.
 *   5. Build cacheable system blocks + a user message summarizing readings.
 *   6. generateStructured → safe fallback on refusal/error, else enforce the
 *      deterministic safety layer (disclaimer + grounding sources).
 */
import {
  AnalyzeParamsRequestSchema,
  ParamAnalysisSchema,
  classifyReading,
  type ParamAnalysis,
  type ParameterReading,
  type TankType,
} from "@reef/shared";
import { getRequestContext } from "@/lib/api-auth";
import { ApiErrors, jsonOk } from "@/lib/http";
import { isAiConfigured, generateStructured, type Anthropic } from "@/lib/ai/anthropic";
import { buildSystemBlocks, buildTankContext } from "@/lib/ai/system-prompt";
import { PARAM_ANALYSIS_JSON_SCHEMA } from "@/lib/ai/json-schemas";
import { groundFor } from "@/lib/ai/rag";
import { enforceParamAnalysisSafety, paramAnalysisFallback } from "@/lib/ai/safety";
import {
  getUserEntitlements,
  type SupabaseLike,
} from "@/lib/entitlements-server";

export const runtime = "nodejs";

/** Default tank type when the request omits one (mixed reef is the safe middle). */
const DEFAULT_TANK_TYPE: TankType = "mixed";

/** Pick the most recent reading by `measured_at`, falling back to the last item. */
function mostRecentReading(parameters: ParameterReading[]): ParameterReading {
  let latest = parameters[0]!;
  let latestTime = Number.NEGATIVE_INFINITY;
  for (const r of parameters) {
    const t = r.measured_at ? Date.parse(r.measured_at) : NaN;
    if (Number.isFinite(t) && t >= latestTime) {
      latest = r;
      latestTime = t;
    }
  }
  // If none had a parseable timestamp, default to the last logged reading.
  if (latestTime === Number.NEGATIVE_INFINITY) latest = parameters[parameters.length - 1]!;
  return latest;
}

/** Compact, human/model-readable summary of every logged reading. */
function summarizeReadings(parameters: ParameterReading[]): string {
  return parameters
    .map((r, i) => {
      const parts: string[] = [];
      const push = (label: string, v: number | null | undefined, unit = "") => {
        if (v !== null && v !== undefined) parts.push(`${label} ${v}${unit}`);
      };
      push("SG", r.salinity_sg);
      push("temp", r.temp_c, "°C");
      push("pH", r.ph);
      push("alk", r.alkalinity_dkh, " dKH");
      push("Ca", r.calcium_ppm, " ppm");
      push("Mg", r.magnesium_ppm, " ppm");
      push("NH3", r.ammonia_ppm, " ppm");
      push("NO2", r.nitrite_ppm, " ppm");
      push("NO3", r.nitrate_ppm, " ppm");
      push("PO4", r.phosphate_ppm, " ppm");
      push("ORP", r.orp_mv, " mV");
      const when = r.measured_at ? ` (${r.measured_at})` : "";
      return `#${i + 1}${when}: ${parts.length ? parts.join(", ") : "no measures"}`;
    })
    .join("\n");
}

export async function POST(req: Request) {
  // 1. Auth + configuration gates.
  const { user, supabase } = await getRequestContext(req);
  if (!user) return ApiErrors.unauthorized();
  if (!isAiConfigured()) return ApiErrors.notConfigured("AI");

  // 2. Validate body.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return ApiErrors.badRequest("Request body must be valid JSON.");
  }
  const parsed = AnalyzeParamsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return ApiErrors.badRequest("Invalid analyze-params request.");
  }
  const { tankType: requestedType, parameters } = parsed.data;

  // 3. Paid-feature gate: AI parameter analysis is Reef Keeper (pro+).
  // The RLS-scoped SupabaseClient is structurally compatible with the minimal
  // SupabaseLike the entitlements gate reads through.
  const ent = await getUserEntitlements(
    supabase as unknown as SupabaseLike,
    user.id,
  );
  if (ent.tier === "free") {
    return ApiErrors.overLimit(
      "AI parameter analysis is a Reef Keeper feature.",
      "pro",
    );
  }

  const tankType: TankType = requestedType ?? DEFAULT_TANK_TYPE;

  // 4. Deterministic pre-pass: objective classification of the latest reading.
  const latest = mostRecentReading(parameters);
  const classified = classifyReading(latest, tankType);
  const outOfRange = classified.filter((c) => c.status !== "ok");
  const outOfRangeNames = outOfRange.map((c) => c.key).join(" ");

  // RAG grounding keyed off the out-of-range params (or general chemistry).
  const grounding = groundFor(
    `reef water chemistry ${outOfRangeNames}`.trim(),
  );

  // 5. System blocks + user message.
  const tankContext = buildTankContext(
    { name: "This tank", type: tankType, volume_liters: 0 },
    latest,
  );
  const system = buildSystemBlocks({
    knowledgeContext: grounding.context,
    tankContext,
    extraInstructions:
      "Analyze these parameter trends. Ground in the targets. Return the param-analysis schema.",
  });

  const classificationLines = classified
    .map((c) => `- ${c.key}: ${c.value} → ${c.status}`)
    .join("\n");
  const userText =
    `Tank type: ${tankType}.\n\n` +
    `Logged readings (oldest first):\n${summarizeReadings(parameters)}\n\n` +
    `Deterministic classification of the most recent reading:\n` +
    `${classificationLines || "- (no numeric measures logged)"}\n\n` +
    `Explain what these mean, any trends, and concrete next steps. ` +
    `Keep findings consistent with the deterministic classification above.`;

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userText },
  ];

  // 6. Generate, with safe fallback on refusal/error.
  try {
    const result = await generateStructured({
      schema: ParamAnalysisSchema,
      jsonSchema: PARAM_ANALYSIS_JSON_SCHEMA,
      system,
      messages,
      effort: "high",
    });

    if (!result.ok) {
      return jsonOk(paramAnalysisFallback("refusal"));
    }

    // `result.data` is the zod-validated output (defaults applied), so it is a
    // full ParamAnalysis; the inferred generic carries the looser input type.
    const safe = enforceParamAnalysisSafety(
      result.data as ParamAnalysis,
      grounding.sources,
    );
    return jsonOk(safe);
  } catch {
    return jsonOk(paramAnalysisFallback("error"));
  }
}
