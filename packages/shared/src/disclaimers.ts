/**
 * Canonical AI-safety strings . Every health/diagnosis/treatment
 * surface MUST render the disclaimer. Any med dose MUST be accompanied by the
 * dose warning. These are imported by both the AI layer (server) and the UI.
 */

export const MEDICAL_DISCLAIMER =
  "This is educational guidance from an AI, not a substitute for a qualified " +
  "aquatic veterinarian. Always confirm a diagnosis and any treatment with a " +
  "professional before acting, especially for valuable or declining livestock.";

export const DOSE_WARNING =
  "⚠️ Double-check this dose before adding anything. Calculated amounts are " +
  "estimates based on the volume and target you entered — verify against your " +
  "product's instructions, start conservative, and re-test before re-dosing. " +
  "Overdosing can harm or kill livestock.";

export const LOW_CONFIDENCE_NOTE =
  "Confidence is low — treat this as a starting point, gather more evidence " +
  "(clearer photos, repeat tests), and consult a professional before treating.";

export const PHOTO_DIAGNOSIS_NOTE =
  "Photo diagnosis depends heavily on image quality and angle. A ranked list " +
  "of possibilities is not a definitive diagnosis.";

/** Short label for a confidence value (0..1). */
export function confidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return "High";
  if (confidence >= 0.55) return "Moderate";
  if (confidence >= 0.3) return "Low";
  return "Very low";
}
