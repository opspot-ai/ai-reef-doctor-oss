/**
 * Hand-written JSON Schemas for Anthropic structured outputs (output_config.format).
 * zod 3.25 has no toJSONSchema, so these mirror the shared zod schemas
 * (DiagnosisResultSchema, ParamAnalysisSchema). The model's JSON is STILL
 * re-validated with the zod schema after the call (defense in depth).
 */

export const DIAGNOSIS_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "conditions", "urgency", "sources", "disclaimer"],
  properties: {
    summary: { type: "string", description: "Plain-language overview for the keeper." },
    conditions: {
      type: "array",
      description: "Ranked likely conditions, most likely first.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "confidence", "severity", "evidence", "recommendedSteps"],
        properties: {
          name: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          severity: { type: "string", enum: ["low", "moderate", "high", "critical"] },
          evidence: { type: "array", items: { type: "string" } },
          recommendedSteps: { type: "array", items: { type: "string" } },
        },
      },
    },
    urgency: {
      type: "string",
      enum: ["routine", "monitor", "urgent", "emergency"],
    },
    sources: {
      type: "array",
      description: "Grounding citations from the reef knowledge base.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "ref"],
        properties: { title: { type: "string" }, ref: { type: "string" } },
      },
    },
    disclaimer: { type: "string" },
    doseWarnings: {
      type: "array",
      description: "Required whenever any medication dose is mentioned.",
      items: { type: "string" },
    },
  },
};

export const PARAM_ANALYSIS_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "findings", "recommendations", "sources", "disclaimer"],
  properties: {
    summary: { type: "string" },
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["parameter", "status", "message"],
        properties: {
          parameter: { type: "string" },
          status: {
            type: "string",
            enum: ["low", "ok", "high", "critical", "unknown"],
          },
          message: { type: "string" },
        },
      },
    },
    recommendations: { type: "array", items: { type: "string" } },
    sources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "ref"],
        properties: { title: { type: "string" }, ref: { type: "string" } },
      },
    },
    disclaimer: { type: "string" },
  },
};
