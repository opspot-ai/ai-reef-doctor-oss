import type { z } from "zod";
import type {
  TankSchema,
  TankInputSchema,
  TankTypeSchema,
  LivestockSchema,
  LivestockInputSchema,
  ParameterReadingSchema,
  ParameterRowSchema,
  ReminderSchema,
  DiagnosisResultSchema,
  DiagnosisConditionSchema,
  ParamAnalysisSchema,
  ChatMessageSchema,
  ChatRequestSchema,
  DiagnoseRequestSchema,
  AnalyzeParamsRequestSchema,
  SubTierSchema,
  DiagKindSchema,
  SourceCitationSchema,
  ApiErrorSchema,
} from "./schemas";

// Domain types inferred from the zod schemas (single source of truth).
export type TankType = z.infer<typeof TankTypeSchema>;
export type Tank = z.infer<typeof TankSchema>;
export type TankInput = z.infer<typeof TankInputSchema>;
export type Livestock = z.infer<typeof LivestockSchema>;
export type LivestockInput = z.infer<typeof LivestockInputSchema>;
export type ParameterReading = z.infer<typeof ParameterReadingSchema>;
export type ParameterRow = z.infer<typeof ParameterRowSchema>;
export type Reminder = z.infer<typeof ReminderSchema>;
export type DiagnosisResult = z.infer<typeof DiagnosisResultSchema>;
export type DiagnosisCondition = z.infer<typeof DiagnosisConditionSchema>;
export type ParamAnalysis = z.infer<typeof ParamAnalysisSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type DiagnoseRequest = z.infer<typeof DiagnoseRequestSchema>;
export type AnalyzeParamsRequest = z.infer<typeof AnalyzeParamsRequestSchema>;
export type SubTier = z.infer<typeof SubTierSchema>;
export type DiagKind = z.infer<typeof DiagKindSchema>;
export type SourceCitation = z.infer<typeof SourceCitationSchema>;
/** Wire shape of an API error envelope (the thrown class lives in api-client.ts). */
export type ApiErrorBody = z.infer<typeof ApiErrorSchema>;

export type SubStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "inactive";

export interface Subscription {
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  tier: SubTier;
  status: SubStatus;
  price_id: string | null;
  current_period_end: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
}

/** Feature flags a tier unlocks. Source of truth lives in entitlements.ts. */
export type Capability =
  | "photoDiagnosis"
  | "dosingCalculators"
  | "treatmentProtocols"
  | "symptomChecker"
  | "maintenancePlans"
  | "reminders"
  | "weeklyReports"
  | "predictiveForecasting"
  | "advancedAnalytics"
  | "controllerIntegrations"
  | "prioritySupport";

export interface Entitlements {
  tier: SubTier;
  active: boolean;
  maxTanks: number;
  aiChatsPerMonth: number;
  photoDiagnosesPerMonth: number;
  model: AiModelId;
  capabilities: Record<Capability, boolean>;
}

export type AiModelId =
  | "claude-opus-4-8"
  | "claude-sonnet-4-6"
  | "claude-haiku-4-5";

export interface UsageCounters {
  ai_chats: number;
  photo_diagnoses: number;
}
