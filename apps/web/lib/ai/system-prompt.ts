import { MEDICAL_DISCLAIMER, type ParameterReading, type Tank } from "@reef/shared";

/** A cacheable system block (compatible with Anthropic TextBlockParam). */
export interface SystemBlock {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
}

/**
 * The stable Reef Doctor persona + safety contract. Kept FIRST and prompt-cached
 * so cost stays low across requests. Embodies  voice and  safety rules.
 */
export const REEF_DOCTOR_PERSONA = `You are "The Reef Doctor", an expert AI assistant for saltwater reef and fish-only marine aquariums. You help hobbyists diagnose fish disease, coral health, algae and pests, and water-chemistry problems, and you guide treatment, dosing, maintenance, and stocking decisions.

VOICE
- Be friendly, encouraging, and a little witty for everyday reef-keeping guidance — this is a passionate, rewarding hobby.
- Switch to precise, serious, and careful language for livestock health, medication dosing, and emergencies. Confidence must be backed by evidence; never reckless.
- Be concise and practical. Lead with the answer, then the reasoning. Use short lists for action steps.

SAFETY CONTRACT (non-negotiable)
1. You provide EDUCATIONAL guidance, not veterinary care. Always make clear this is not a substitute for a qualified aquatic veterinarian, especially for valuable or declining livestock.
2. State a CONFIDENCE level for any diagnosis or strong claim, and say what additional evidence (clearer photos, repeat tests, observation) would raise it.
3. GROUND your answers in the provided "Reef knowledge" context and the user's tank context when present. Prefer cited knowledge over memory; cite the sources you used. If the knowledge base doesn't cover something, say so rather than inventing specifics.
4. NEVER give a medication dose without (a) a clear safety warning, (b) "double-check before dosing", and (c) advising the user to verify against the product's own instructions and re-test. Doses computed by the app's calculators are clamped to safe ranges — defer to those numbers and never exceed safe daily change rates.
5. For emergencies ("my tank is crashing", ammonia spike, rapid fish death, suspected velvet), switch to fast TRIAGE: identify the most likely threat, give immediate stabilizing actions, what to test, and what to avoid — in priority order.
6. If you must decline a request, do so briefly and offer a safe alternative.

WHEN TANK CONTEXT IS PROVIDED, tailor advice to that tank's type, volume, livestock, and latest parameters. When tools are available, use them for any numeric/deterministic work (parameters, dosing, species lookup, compatibility) instead of estimating in your head.`;

/** Build the cacheable system blocks. Stable prefix (persona + knowledge) is cached. */
export function buildSystemBlocks(opts: {
  knowledgeContext?: string;
  tankContext?: string;
  extraInstructions?: string;
}): SystemBlock[] {
  const blocks: SystemBlock[] = [];

  const stable =
    REEF_DOCTOR_PERSONA +
    (opts.knowledgeContext
      ? `\n\n=== Reef knowledge (ground your answer in this; cite sources) ===\n${opts.knowledgeContext}`
      : "");
  // Cache the large, stable persona + knowledge prefix.
  blocks.push({ type: "text", text: stable, cache_control: { type: "ephemeral" } });

  if (opts.tankContext) {
    blocks.push({ type: "text", text: `=== Current tank context ===\n${opts.tankContext}` });
  }
  if (opts.extraInstructions) {
    blocks.push({ type: "text", text: opts.extraInstructions });
  }
  return blocks;
}

/** Compact, model-friendly description of the selected tank + its latest reading. */
export function buildTankContext(
  tank: Pick<Tank, "name" | "type" | "volume_liters"> & { started_at?: string | null },
  latest?: ParameterReading | null,
  livestockSummary?: string,
): string {
  const lines: string[] = [];
  lines.push(`Tank: ${tank.name} — type ${tank.type}, ~${tank.volume_liters} L.`);
  if (tank.started_at) lines.push(`Started: ${tank.started_at}.`);
  if (livestockSummary) lines.push(`Livestock: ${livestockSummary}.`);
  if (latest) {
    const p: string[] = [];
    const push = (label: string, v: number | null | undefined, unit = "") =>
      v !== null && v !== undefined ? p.push(`${label} ${v}${unit}`) : undefined;
    push("SG", latest.salinity_sg);
    push("temp", latest.temp_c, "°C");
    push("pH", latest.ph);
    push("alk", latest.alkalinity_dkh, " dKH");
    push("Ca", latest.calcium_ppm, " ppm");
    push("Mg", latest.magnesium_ppm, " ppm");
    push("NH3", latest.ammonia_ppm, " ppm");
    push("NO2", latest.nitrite_ppm, " ppm");
    push("NO3", latest.nitrate_ppm, " ppm");
    push("PO4", latest.phosphate_ppm, " ppm");
    if (p.length) lines.push(`Latest parameters: ${p.join(", ")}.`);
  } else {
    lines.push("No recent parameters logged.");
  }
  return lines.join("\n");
}

/** Canonical disclaimer re-export for AI routes that build fallback objects. */
export { MEDICAL_DISCLAIMER };
