import { DOSE_WARNING } from "./disclaimers";

/**
 * Reef dosing math with SAFE CLAMPS (; safety ).
 *
 * Every public function returns numbers rounded to 2 decimals and every
 * `DoseResult.warnings` array always contains {@link DOSE_WARNING}.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * IMPORTANT — these are APPROXIMATIONS, not product-specific truth.
 * The default strengths below model a "standard" two-part / All-For-Reef style
 * supplement. Real products vary widely: a manufacturer's dosing chart is the
 * authority. The USER must verify every calculated amount against their own
 * product's instructions before adding anything (this is stated in each note
 * and reinforced by DOSE_WARNING).
 * ──────────────────────────────────────────────────────────────────────────
 */

export interface DoseResult {
  /** Total millilitres to add to reach the (clamped) target. Rounded 2dp. */
  recommendedMl: number;
  /** True when a safety clamp changed the request (multi-day split / range clamp). */
  clamped: boolean;
  /** Per-day millilitres when the dose is spread over >1 day. Rounded 2dp. */
  perDayMl?: number;
  /** Number of days to spread the dose across (>=1). */
  days: number;
  /** Always includes DOSE_WARNING; plus any clamp/safety notes. */
  warnings: string[];
  /** Human-readable explanation; always reminds the user to verify the product. */
  note: string;
}

/** Round to 2 decimal places (avoids -0 and FP noise). */
function round2(n: number): number {
  const r = Math.round((n + Number.EPSILON) * 100) / 100;
  return r === 0 ? 0 : r;
}

const VERIFY_NOTE =
  "These figures assume a standard two-part / All-For-Reef style supplement. " +
  "Verify against YOUR product's dosing instructions before adding anything.";

// ─────────────────────────── default model constants ───────────────────────────
//
// `strengthPerMlPerL` = how much the parameter rises when 1 mL of supplement is
// added to 1 L of water. Total mL to raise `delta` across `volumeLiters` is
// therefore `delta * volumeLiters / strengthPerMlPerL`.
//
// The values below are conservative approximations for "standard" hobby
// supplements (e.g. a Tropic-Marin All-For-Reef / two-part class product).
// They exist so the calculators return a sane number when a user hasn't entered
// a product-specific strength — they are NOT a substitute for the product chart.

/**
 * Alkalinity: ~1 mL per 1 L raises alk by ~0.0014 dKH for a standard 2-part.
 * (≈ 1 mL/L → 0.0014 dKH, i.e. ~1.4 dKH per 1000 mL in 1 L; in practice you
 * dose into hundreds of litres so totals scale with tank volume.)
 */
export const ALK_STRENGTH_PER_ML_PER_L = 0.0014;
/** Calcium: ~1 mL per 1 L raises Ca by ~0.1 ppm for a standard 2-part. */
export const CA_STRENGTH_PER_ML_PER_L = 0.1;
/** Magnesium: ~1 mL per 1 L raises Mg by ~0.2 ppm for a standard Mg supplement. */
export const MG_STRENGTH_PER_ML_PER_L = 0.2;

// Safe maximum DAILY change rates. Exceeding these stresses/kills livestock, so
// larger requested changes are split across multiple days (clamped).
/** Alkalinity should not swing more than ~1.4 dKH/day. */
export const ALK_MAX_DAILY_DELTA = 1.4;
/** Calcium should not swing more than ~50 ppm/day. */
export const CA_MAX_DAILY_DELTA = 50;
/** Magnesium should not swing more than ~100 ppm/day. */
export const MG_MAX_DAILY_DELTA = 100;

// ─────────────────────────── core ───────────────────────────

/**
 * Compute the supplement volume needed to raise a parameter from `current` to
 * `target`, clamping the daily change rate to `maxDailyDelta` by spreading the
 * dose across multiple days when necessary.
 *
 * - `recommendedMl = max(0, target-current) * volumeLiters / strengthPerMlPerL`
 *   (when `strengthPerMlPerL > 0`).
 * - `target <= current` → 0 mL with an explanatory note.
 * - `strengthPerMlPerL <= 0` → 0 mL with a note (cannot compute).
 * - `(target-current) > maxDailyDelta` → spread across
 *   `ceil(delta / maxDailyDelta)` days; `perDayMl = recommendedMl / days`;
 *   `clamped = true` plus a warning.
 */
export function doseToRaise(opts: {
  volumeLiters: number;
  current: number;
  target: number;
  strengthPerMlPerL: number;
  maxDailyDelta: number;
  unit: string;
}): DoseResult {
  const { volumeLiters, current, target, strengthPerMlPerL, maxDailyDelta, unit } =
    opts;

  const warnings: string[] = [DOSE_WARNING];
  const delta = target - current;

  // Already at or above target → nothing to add.
  if (delta <= 0) {
    return {
      recommendedMl: 0,
      clamped: false,
      days: 1,
      warnings,
      note:
        `You're already at or above the target ${unit} (current ${current}, ` +
        `target ${target}), so no dose is needed. ${VERIFY_NOTE}`,
    };
  }

  // Cannot compute without a positive strength.
  if (strengthPerMlPerL <= 0) {
    return {
      recommendedMl: 0,
      clamped: false,
      days: 1,
      warnings,
      note:
        "Cannot calculate a dose: the supplement strength (per mL per L) must " +
        `be greater than zero. Enter your product's strength. ${VERIFY_NOTE}`,
    };
  }

  const totalMl = round2((delta * volumeLiters) / strengthPerMlPerL);

  // Within the safe daily change rate → single dose.
  if (delta <= maxDailyDelta) {
    return {
      recommendedMl: totalMl,
      clamped: false,
      days: 1,
      warnings,
      note:
        `Add about ${totalMl} mL to raise ${unit} from ${current} to ${target} ` +
        `in ${volumeLiters} L. ${VERIFY_NOTE}`,
    };
  }

  // Exceeds the safe daily change rate → spread across multiple days.
  const days = Math.ceil(delta / maxDailyDelta);
  const perDayMl = round2(totalMl / days);
  warnings.push(
    `A change of ${round2(delta)} ${unit} exceeds the safe rate of ` +
      `${maxDailyDelta} ${unit}/day, so this dose was spread over ${days} days ` +
      `for safety (~${perDayMl} mL/day). Re-test before each daily dose.`,
  );

  return {
    recommendedMl: totalMl,
    clamped: true,
    perDayMl,
    days,
    warnings,
    note:
      `To safely raise ${unit} from ${current} to ${target} in ${volumeLiters} L, ` +
      `spread ~${totalMl} mL over ${days} days (~${perDayMl} mL/day). ${VERIFY_NOTE}`,
  };
}

// ─────────────────────────── convenience wrappers ───────────────────────────

/**
 * Alkalinity dosing for a standard two-part. Clamps daily change to
 * {@link ALK_MAX_DAILY_DELTA} (1.4 dKH/day).
 */
export function doseAlk(opts: {
  volumeLiters: number;
  currentDkh: number;
  targetDkh: number;
}): DoseResult {
  return doseToRaise({
    volumeLiters: opts.volumeLiters,
    current: opts.currentDkh,
    target: opts.targetDkh,
    strengthPerMlPerL: ALK_STRENGTH_PER_ML_PER_L,
    maxDailyDelta: ALK_MAX_DAILY_DELTA,
    unit: "dKH",
  });
}

/**
 * Calcium dosing for a standard two-part. Clamps daily change to
 * {@link CA_MAX_DAILY_DELTA} (50 ppm/day).
 */
export function doseCalcium(opts: {
  volumeLiters: number;
  currentPpm: number;
  targetPpm: number;
}): DoseResult {
  return doseToRaise({
    volumeLiters: opts.volumeLiters,
    current: opts.currentPpm,
    target: opts.targetPpm,
    strengthPerMlPerL: CA_STRENGTH_PER_ML_PER_L,
    maxDailyDelta: CA_MAX_DAILY_DELTA,
    unit: "ppm Ca",
  });
}

/**
 * Magnesium dosing for a standard supplement. Clamps daily change to
 * {@link MG_MAX_DAILY_DELTA} (100 ppm/day).
 */
export function doseMagnesium(opts: {
  volumeLiters: number;
  currentPpm: number;
  targetPpm: number;
}): DoseResult {
  return doseToRaise({
    volumeLiters: opts.volumeLiters,
    current: opts.currentPpm,
    target: opts.targetPpm,
    strengthPerMlPerL: MG_STRENGTH_PER_ML_PER_L,
    maxDailyDelta: MG_MAX_DAILY_DELTA,
    unit: "ppm Mg",
  });
}

// ─────────────────────────── copper (treatment, safety-critical) ───────────────────────────

/**
 * Therapeutic copper concentration ranges (ppm) by product type. Doses are
 * clamped into these windows: below = ineffective, above = lethal.
 * - ionic copper (e.g. Cupramine):   0.15–0.30 ppm
 * - chelated copper (e.g. Copper Power): 1.75–2.50 ppm
 */
export const COPPER_RANGES: Record<
  "ionic" | "chelated",
  { min: number; max: number }
> = {
  ionic: { min: 0.15, max: 0.3 },
  chelated: { min: 1.75, max: 2.5 },
};

/**
 * Copper treatment dose (safety-critical). Computes mL of a copper product to
 * reach a therapeutic concentration, with the target hard-clamped into the
 * product type's therapeutic range.
 *
 * Always carries strong safety warnings: ramp copper slowly over 3–5 days, test
 * daily with a quality copper test, and NEVER use in a display/reef tank
 * (copper is not reef-safe — it kills inverts and corals).
 */
export function copperDose(opts: {
  volumeLiters: number;
  currentPpm: number;
  targetPpm: number;
  type: "ionic" | "chelated";
  productPpmPerMlPerL: number;
}): DoseResult {
  const { volumeLiters, currentPpm, targetPpm, type, productPpmPerMlPerL } = opts;

  const range = COPPER_RANGES[type];
  const warnings: string[] = [DOSE_WARNING];
  let clamped = false;

  // Clamp the target into the therapeutic range.
  let effectiveTarget = targetPpm;
  if (targetPpm < range.min) {
    effectiveTarget = range.min;
    clamped = true;
    warnings.push(
      `Target ${targetPpm} ppm is BELOW the therapeutic range for ${type} ` +
        `copper (${range.min}–${range.max} ppm) and would be ineffective; ` +
        `clamped up to ${range.min} ppm.`,
    );
  } else if (targetPpm > range.max) {
    effectiveTarget = range.max;
    clamped = true;
    warnings.push(
      `Target ${targetPpm} ppm is ABOVE the therapeutic range for ${type} ` +
        `copper (${range.min}–${range.max} ppm) and is dangerous; clamped ` +
        `down to ${range.max} ppm.`,
    );
  }

  // Mandatory copper safety warnings (always present).
  warnings.push(
    "Ramp copper up slowly over 3–5 days rather than dosing it all at once.",
    "Test copper DAILY with a quality copper test kit and adjust to stay in range.",
    "NEVER use copper in a display or reef tank — it is not reef-safe and will " +
      "kill invertebrates and corals. Treat fish in a separate quarantine tank.",
  );

  const note =
    `Quarantine ${type} copper treatment for ${volumeLiters} L: bring copper ` +
    `to ${effectiveTarget} ppm gradually over 3–5 days, testing daily. ` +
    VERIFY_NOTE;

  const delta = effectiveTarget - currentPpm;

  // Already at/above the (clamped) therapeutic target → no more copper.
  if (delta <= 0 || productPpmPerMlPerL <= 0) {
    return {
      recommendedMl: 0,
      clamped,
      days: 1,
      warnings,
      note:
        delta <= 0
          ? `Copper is already at or above ${effectiveTarget} ppm — do not add ` +
            `more. ${VERIFY_NOTE}`
          : note,
    };
  }

  const recommendedMl = round2((delta * volumeLiters) / productPpmPerMlPerL);

  return {
    recommendedMl,
    clamped,
    days: 1,
    warnings,
    note,
  };
}
