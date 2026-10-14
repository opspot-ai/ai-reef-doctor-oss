import { z } from "zod";

/**
 * Single source of truth for runtime validation. Domain TS types are inferred
 * from these (see types.ts). Used by web API routes, the shared api-client,
 * AI structured-output contracts, and DB row validation.
 */

// ─────────────────────────── enums ───────────────────────────
export const TankTypeSchema = z.enum([
  "fowlr",
  "soft",
  "lps",
  "sps",
  "mixed",
  "nano",
]);
export const SubTierSchema = z.enum(["free", "pro", "premium"]);
export const LiveKindSchema = z.enum(["fish", "coral", "invert"]);
export const LiveStatusSchema = z.enum(["alive", "deceased", "removed"]);
export const ParamSourceSchema = z.enum(["manual", "photo"]);
export const RecurrenceSchema = z.enum([
  "none",
  "daily",
  "weekly",
  "biweekly",
  "monthly",
]);
export const DiagKindSchema = z.enum([
  "fish",
  "coral",
  "algae",
  "params",
  "symptom",
]);
export const DiagUrgencySchema = z.enum([
  "routine",
  "monitor",
  "urgent",
  "emergency",
]);
export const ConditionSeveritySchema = z.enum([
  "low",
  "moderate",
  "high",
  "critical",
]);
export const ChatRoleSchema = z.enum(["user", "assistant"]);

// ─────────────────────────── domain rows ───────────────────────────
export const TankSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string().min(1).max(120),
  type: TankTypeSchema,
  volume_liters: z.number().positive(),
  started_at: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  created_at: z.string(),
});

export const TankInputSchema = z.object({
  name: z.string().min(1).max(120),
  type: TankTypeSchema,
  volume_liters: z.number().positive().max(100000),
  started_at: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

export const LivestockSchema = z.object({
  id: z.string().uuid(),
  tank_id: z.string().uuid(),
  user_id: z.string().uuid(),
  kind: LiveKindSchema,
  common_name: z.string().min(1),
  scientific_name: z.string().nullable().optional(),
  nickname: z.string().nullable().optional(),
  added_at: z.string().nullable().optional(),
  photo_path: z.string().nullable().optional(),
  status: LiveStatusSchema,
  notes: z.string().nullable().optional(),
  created_at: z.string(),
});

export const LivestockInputSchema = LivestockSchema.pick({
  kind: true,
  common_name: true,
}).extend({
  tank_id: z.string().uuid(),
  scientific_name: z.string().optional(),
  nickname: z.string().optional(),
  added_at: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

/** A water-chemistry reading. All measures optional (log what you tested). */
export const ParameterReadingSchema = z.object({
  measured_at: z.string().optional(),
  salinity_sg: z.number().min(1.0).max(1.04).nullable().optional(),
  temp_c: z.number().min(0).max(40).nullable().optional(),
  ph: z.number().min(6).max(9).nullable().optional(),
  alkalinity_dkh: z.number().min(0).max(20).nullable().optional(),
  calcium_ppm: z.number().int().min(0).max(700).nullable().optional(),
  magnesium_ppm: z.number().int().min(0).max(2000).nullable().optional(),
  ammonia_ppm: z.number().min(0).max(10).nullable().optional(),
  nitrite_ppm: z.number().min(0).max(10).nullable().optional(),
  nitrate_ppm: z.number().min(0).max(500).nullable().optional(),
  phosphate_ppm: z.number().min(0).max(10).nullable().optional(),
  orp_mv: z.number().int().min(0).max(600).nullable().optional(),
  source: ParamSourceSchema.default("manual"),
  notes: z.string().max(1000).optional(),
});

export const ParameterRowSchema = ParameterReadingSchema.extend({
  id: z.string().uuid(),
  tank_id: z.string().uuid(),
  user_id: z.string().uuid(),
  measured_at: z.string(),
  created_at: z.string(),
});

export const ReminderSchema = z.object({
  id: z.string().uuid(),
  tank_id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string().min(1),
  kind: z.string(),
  due_at: z.string(),
  recurrence: RecurrenceSchema,
  last_done_at: z.string().nullable().optional(),
  active: z.boolean(),
  created_at: z.string(),
});

// ─────────────────────────── AI: diagnosis ───────────────────────────
export const DiagnosisConditionSchema = z.object({
  name: z.string(),
  confidence: z.number().min(0).max(1),
  severity: ConditionSeveritySchema,
  evidence: z.array(z.string()).default([]),
  recommendedSteps: z.array(z.string()).default([]),
});

export const SourceCitationSchema = z.object({
  title: z.string(),
  ref: z.string(),
});

/** Structured output contract for /api/ai/diagnose. Disclaimer is ALWAYS present. */
export const DiagnosisResultSchema = z.object({
  summary: z.string(),
  conditions: z.array(DiagnosisConditionSchema),
  urgency: DiagUrgencySchema,
  sources: z.array(SourceCitationSchema).default([]),
  disclaimer: z.string(),
  doseWarnings: z.array(z.string()).optional(),
});

// ─────────────────────────── AI: parameter analysis ───────────────────────────
export const ParamFindingSchema = z.object({
  parameter: z.string(),
  status: z.enum(["low", "ok", "high", "critical", "unknown"]),
  message: z.string(),
});

export const ParamAnalysisSchema = z.object({
  summary: z.string(),
  findings: z.array(ParamFindingSchema),
  recommendations: z.array(z.string()).default([]),
  sources: z.array(SourceCitationSchema).default([]),
  disclaimer: z.string(),
});

// ─────────────────────────── AI: chat ───────────────────────────
export const ChatMessageSchema = z.object({
  role: ChatRoleSchema,
  content: z.string(),
});

export const ChatRequestSchema = z.object({
  tankId: z.string().uuid().optional(),
  threadId: z.string().uuid().optional(),
  messages: z.array(ChatMessageSchema).min(1),
});

export const DiagnoseRequestSchema = z.object({
  tankId: z.string().uuid().optional(),
  kind: DiagKindSchema,
  imageBase64: z.string().optional(),
  imageMediaType: z
    .enum(["image/jpeg", "image/png", "image/webp"])
    .optional(),
  note: z.string().max(2000).optional(),
});

export const AnalyzeParamsRequestSchema = z.object({
  tankId: z.string().uuid(),
  tankType: TankTypeSchema.optional(),
  parameters: z.array(ParameterReadingSchema).min(1),
});

// ─────────────────────────── API error envelope ───────────────────────────
export const ApiErrorSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  upgradeTo: SubTierSchema.optional(),
});
