/**
 * Deterministic AI-safety layer .
 *
 * The model is *never* trusted to enforce safety invariants. Whatever the model
 * returns (or refuses), these functions guarantee that every diagnosis /
 * parameter-analysis response carries:
 *   - a medical disclaimer,
 *   - confidences clamped into [0, 1],
 *   - a grounding `sources` array,
 *   - a dose warning whenever any dose is mentioned,
 *   - a low-confidence note when the strongest condition is weak.
 *
 * Pure logic only — no Anthropic calls, no network, no env. Safe to run with no
 * API key and trivially unit-testable.
 */
import {
  MEDICAL_DISCLAIMER,
  DOSE_WARNING,
  LOW_CONFIDENCE_NOTE,
  type DiagnosisResult,
  type ParamAnalysis,
  type SourceCitation,
} from "@reef/shared";

/** Confidence below this on the strongest condition triggers the low-confidence note. */
const LOW_CONFIDENCE_THRESHOLD = 0.55;

/**
 * Dose indicators. Matches medication / chemistry names plus numbers carrying a
 * dosing unit (ppm, mg, ml, dKH, tsp/teaspoon, drops). Case-insensitive.
 * Kept intentionally broad: a false positive only adds a (harmless, correct)
 * dose warning; a false negative would omit a required safety string.
 */
const DOSE_PATTERNS: RegExp[] = [
  // Number immediately followed (optionally after a space) by a dosing unit.
  /\d+(?:\.\d+)?\s*(?:ppm|mg|ml|milliliters?|millilitres?|dkh|tsp|teaspoons?|tbsp|tablespoons?|drops?)\b/i,
  // Bare dosing keywords / medication names.
  /\bdos(?:e|es|ed|ing|age)\b/i,
  /\bcopper\b/i,
  /\bcupramine\b/i,
  /\bformalin\b/i,
  /\bpraz(?:i|iquantel|ipro)\b/i,
];

function hasDoseIndicator(text: string): boolean {
  if (!text) return false;
  return DOSE_PATTERNS.some((re) => re.test(text));
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function asArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

function nonEmpty(s: string | undefined | null): boolean {
  return typeof s === "string" && s.trim().length > 0;
}

/**
 * Guarantee every safety invariant on a DiagnosisResult, regardless of what the
 * model produced. Returns a new object (does not mutate the input).
 */
export function enforceDiagnosisSafety(
  d: DiagnosisResult,
  sources?: SourceCitation[],
): DiagnosisResult {
  // Disclaimer fallback.
  const disclaimer = nonEmpty(d.disclaimer) ? d.disclaimer : MEDICAL_DISCLAIMER;

  // Clamp every condition confidence; default missing arrays.
  const conditions = asArray(d.conditions).map((c) => ({
    ...c,
    confidence: clamp01(c.confidence),
    evidence: asArray(c.evidence),
    recommendedSteps: asArray(c.recommendedSteps),
  }));

  // Sources: prefer the model's; fall back to the grounding sources passed in.
  const modelSources = asArray(d.sources);
  const sources_ =
    modelSources.length > 0 ? modelSources : asArray(sources);

  // Dose detection across summary + every condition's steps/evidence.
  const doseHaystack = [
    d.summary ?? "",
    ...conditions.flatMap((c) => [...c.recommendedSteps, ...c.evidence]),
  ];
  const mentionsDose = doseHaystack.some(hasDoseIndicator);

  let doseWarnings = asArray(d.doseWarnings);
  if (mentionsDose) {
    if (!doseWarnings.includes(DOSE_WARNING)) {
      doseWarnings = [...doseWarnings, DOSE_WARNING];
    }
  }

  // Low-confidence note: append once if the strongest condition is weak.
  const maxConfidence = conditions.reduce(
    (max, c) => (c.confidence > max ? c.confidence : max),
    0,
  );
  let summary = d.summary ?? "";
  const isLowConfidence =
    conditions.length > 0 && maxConfidence < LOW_CONFIDENCE_THRESHOLD;
  if (isLowConfidence && !summary.includes(LOW_CONFIDENCE_NOTE)) {
    summary = summary.length > 0 ? `${summary}\n\n${LOW_CONFIDENCE_NOTE}` : LOW_CONFIDENCE_NOTE;
  }

  const result: DiagnosisResult = {
    summary,
    conditions,
    urgency: d.urgency,
    sources: sources_,
    disclaimer,
  };
  // Only attach doseWarnings when non-empty (the field is optional).
  if (doseWarnings.length > 0) result.doseWarnings = doseWarnings;
  return result;
}

/**
 * Guarantee safety invariants on a ParamAnalysis: disclaimer fallback and a
 * sources array. Returns a new object.
 */
export function enforceParamAnalysisSafety(
  a: ParamAnalysis,
  sources?: SourceCitation[],
): ParamAnalysis {
  const disclaimer = nonEmpty(a.disclaimer) ? a.disclaimer : MEDICAL_DISCLAIMER;
  const modelSources = asArray(a.sources);
  const sources_ = modelSources.length > 0 ? modelSources : asArray(sources);

  return {
    summary: a.summary ?? "",
    findings: asArray(a.findings),
    recommendations: asArray(a.recommendations),
    sources: sources_,
    disclaimer,
  };
}

/**
 * A safe DiagnosisResult to return when the model refuses or errors. Always
 * validates against DiagnosisResultSchema.
 */
export function diagnosisFallback(
  kind: string,
  reason: "refusal" | "error",
): DiagnosisResult {
  const what = kind && kind.trim().length > 0 ? kind : "your photo";
  const because =
    reason === "refusal"
      ? "the AI declined to analyze this request"
      : "something went wrong while analyzing this request";
  const summary =
    `We couldn't complete a ${what} analysis right now because ${because}. ` +
    "Try again with a clearer, well-lit photo taken close to the subject, " +
    "and consider consulting a qualified aquatic professional for anything " +
    "urgent or involving declining livestock.";

  return {
    summary,
    conditions: [],
    urgency: "routine",
    sources: [],
    disclaimer: MEDICAL_DISCLAIMER,
  };
}

/**
 * A safe ParamAnalysis to return when the model refuses or errors. Always
 * validates against ParamAnalysisSchema.
 */
export function paramAnalysisFallback(
  reason: "refusal" | "error",
): ParamAnalysis {
  const because =
    reason === "refusal"
      ? "the AI declined to analyze these parameters"
      : "something went wrong while analyzing these parameters";
  const summary =
    `We couldn't analyze your water parameters right now because ${because}. ` +
    "Please re-check your readings and try again, and consult a qualified " +
    "professional if anything looks off.";

  return {
    summary,
    findings: [],
    recommendations: [],
    sources: [],
    disclaimer: MEDICAL_DISCLAIMER,
  };
}
