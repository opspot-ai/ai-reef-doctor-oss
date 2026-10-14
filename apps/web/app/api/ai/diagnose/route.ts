/**
 * POST /api/ai/diagnose — photo / structured diagnosis .
 *
 * Returns a {@link DiagnosisResult} as structured JSON. Vision is used when an
 * image is supplied. Every response is run through the deterministic safety
 * layer (`enforceDiagnosisSafety`) so a disclaimer, clamped confidences,
 * grounding sources, and dose warnings are GUARANTEED regardless of model
 * output. Model refusals and unexpected errors resolve to a safe fallback
 * object with HTTP 200 — clients always receive a valid, safe DiagnosisResult
 * rather than an error they have to special-case. (Hard caps and auth still
 * return their proper 401/402/503 statuses.)
 */
import { getRequestContext } from "@/lib/api-auth";
import { ApiErrors, jsonOk } from "@/lib/http";
import {
  generateStructured,
  isAiConfigured,
  type Anthropic,
} from "@/lib/ai/anthropic";
import {
  buildSystemBlocks,
  buildTankContext,
} from "@/lib/ai/system-prompt";
import { DIAGNOSIS_JSON_SCHEMA } from "@/lib/ai/json-schemas";
import { groundForKinds } from "@/lib/ai/rag";
import { enforceDiagnosisSafety, diagnosisFallback } from "@/lib/ai/safety";
import {
  enforcePhoto,
  incrementUsage,
  type SupabaseLike,
} from "@/lib/entitlements-server";
import {
  DiagnoseRequestSchema,
  DiagnosisResultSchema,
  type DiagnosisResult,
  type ParameterReading,
  type Tank,
} from "@reef/shared";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // 1. Auth + AI configured.
  const { user, supabase } = await getRequestContext(req);
  if (!user) return ApiErrors.unauthorized();
  if (!isAiConfigured()) return ApiErrors.notConfigured("AI");

  // 2. Validate body.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return ApiErrors.badRequest("Expected a JSON body.");
  }
  const parsed = DiagnoseRequestSchema.safeParse(body);
  if (!parsed.success) {
    return ApiErrors.badRequest("Invalid diagnosis request.");
  }
  const { tankId, kind, imageBase64, imageMediaType, note } = parsed.data;

  // 3. Entitlements / usage cap (also covers the free 1-photo trial via the cap).
  // The RLS-scoped client is a structural superset of the SupabaseLike slice
  // the gate reads through.
  const gate = await enforcePhoto(supabase as unknown as SupabaseLike, user.id);
  if (!gate.allowed) {
    return ApiErrors.overLimit(
      "You've used your photo diagnosis allowance. Upgrade to keep diagnosing.",
      gate.upgradeTo,
    );
  }

  // 4. Grounding for this kind (+ optional note), and optional tank context.
  const { context, sources } = groundForKinds(kind, note);
  const tankContext = tankId
    ? await loadTankContext(supabase, user.id, tankId)
    : undefined;

  // 5. Build the user message: optional image block + diagnosis instruction.
  const userContent: Anthropic.ContentBlockParam[] = [];
  if (imageBase64) {
    userContent.push({
      type: "image",
      source: {
        type: "base64",
        media_type: imageMediaType ?? "image/jpeg",
        data: imageBase64,
      },
    });
  }
  const instruction =
    `Diagnose this ${kind} concern for a marine aquarium.` +
    (note ? `\n\nKeeper's note: ${note}` : "") +
    "\n\nRespond as the structured diagnosis schema: a plain-language summary, " +
    "a ranked list of likely conditions (each with confidence, severity, " +
    "evidence, and recommended steps), an overall urgency, grounding sources, " +
    "and a disclaimer.";
  userContent.push({ type: "text", text: instruction });

  const system = buildSystemBlocks({
    knowledgeContext: context,
    tankContext,
    extraInstructions:
      "Return a ranked structured diagnosis. Always include a disclaimer, " +
      "per-condition confidence, and cite sources.",
  });

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userContent },
  ];

  // 6. Generate. Wrap in try/catch so any error resolves to a safe fallback (200).
  let result;
  try {
    result = await generateStructured({
      schema: DiagnosisResultSchema,
      jsonSchema: DIAGNOSIS_JSON_SCHEMA,
      system,
      messages,
      maxTokens: 16000,
      effort: "high",
    });
  } catch {
    return jsonOk(diagnosisFallback(kind, "error"));
  }

  if (result.ok === false) {
    return jsonOk(diagnosisFallback(kind, "refusal"));
  }

  // Deterministic safety enforcement (never trust the model). `result.data` is
  // the schema's *input* shape (default-backed arrays may be omitted); safety
  // normalizes every field via asArray(), so a cast to the output type is safe.
  const d = enforceDiagnosisSafety(result.data as DiagnosisResult, sources);

  // 7. Best-effort persist + usage increment. Never fail the response on this.
  await persistDiagnosis(supabase, user.id, tankId, kind, d);
  await incrementUsage(user.id, "photo_diagnoses");

  return jsonOk(d);
}

/** Minimal slice of the Supabase query builder this route reads through. */
interface QueryLike {
  select(columns: string): QueryLike;
  eq(column: string, value: unknown): QueryLike;
  order(
    column: string,
    opts: { ascending: boolean },
  ): QueryLike;
  limit(n: number): QueryLike;
  maybeSingle(): Promise<{ data: unknown; error: unknown }>;
  insert(values: unknown): Promise<{ error: unknown }>;
}
interface DbLike {
  from(table: string): QueryLike;
}

/**
 * Load the selected tank + its latest parameters and build a compact tank
 * context block. Best-effort: any failure returns undefined (no context).
 */
async function loadTankContext(
  db: unknown,
  userId: string,
  tankId: string,
): Promise<string | undefined> {
  try {
    const sb = db as DbLike;
    const { data: tankRow } = await sb
      .from("tanks")
      .select("name, type, volume_liters, started_at")
      .eq("id", tankId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!tankRow) return undefined;

    const { data: latestRow } = await sb
      .from("parameters")
      .select(
        "measured_at, salinity_sg, temp_c, ph, alkalinity_dkh, calcium_ppm, magnesium_ppm, ammonia_ppm, nitrite_ppm, nitrate_ppm, phosphate_ppm, orp_mv",
      )
      .eq("tank_id", tankId)
      .eq("user_id", userId)
      .order("measured_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return buildTankContext(
      tankRow as Pick<Tank, "name" | "type" | "volume_liters"> & {
        started_at?: string | null;
      },
      (latestRow as ParameterReading | null) ?? null,
    );
  } catch {
    return undefined;
  }
}

/**
 * Best-effort persist of a `diagnoses` row. Swallows all errors so a failed
 * write never breaks the user-facing response (the diagnosis is already safe).
 */
async function persistDiagnosis(
  db: unknown,
  userId: string,
  tankId: string | undefined,
  kind: string,
  d: DiagnosisResult,
): Promise<void> {
  try {
    const sb = db as DbLike;
    await sb.from("diagnoses").insert({
      user_id: userId,
      tank_id: tankId ?? null,
      kind,
      summary: d.summary,
      result: d,
      urgency: d.urgency,
      photo_path: null,
    });
  } catch {
    // Best-effort accounting; never throw from the persist path.
  }
}
