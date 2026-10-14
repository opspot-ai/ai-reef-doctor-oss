import type { TankType, ParameterReading } from "./types";

/**
 * Water-parameter target ranges, classification, and nitrogen-cycle staging
 * (, ). Pure functions over a typed catalog of reef-standard
 * targets. Differentiated by tank type where it matters (SPS wants lower, more
 * stable nutrients; FOWLR tolerates higher nitrate).
 */

// ─────────────────────────── keys & types ───────────────────────────

/** The measurable numeric water-chemistry parameters (mirror ParameterReading). */
export type ParamKey =
  | "salinity_sg"
  | "temp_c"
  | "ph"
  | "alkalinity_dkh"
  | "calcium_ppm"
  | "magnesium_ppm"
  | "ammonia_ppm"
  | "nitrite_ppm"
  | "nitrate_ppm"
  | "phosphate_ppm"
  | "orp_mv";

export interface TargetRange {
  min: number;
  max: number;
  ideal: number;
  unit: string;
  label: string;
}

export type ParamStatus = "low" | "ok" | "high" | "critical" | "unknown";

export type CycleStage =
  | "not-started"
  | "ammonia"
  | "nitrite"
  | "nitrate"
  | "cycled";

// ─────────────────────────── critical-zone thresholds ───────────────────────────

/**
 * Detectable ammonia/nitrite is always at least "high" (target is zero). Above
 * this concentration it is acutely dangerous → "critical".
 */
const TOXIN_CRITICAL_PPM = 0.25;

/** Absolute temperature danger band (°C). Outside this is "critical" regardless of type. */
const TEMP_CRITICAL_LOW = 22;
const TEMP_CRITICAL_HIGH = 30;

/**
 * Nitrate "way out of range" multiplier: a value at/above this multiple of the
 * tank type's max is dangerous (e.g. SPS max 10 → ≥40 ppm is critical).
 */
const NITRATE_CRITICAL_MULTIPLE = 4;

// ─────────────────────────── shared range fragments ───────────────────────────
// Parameters that do not vary by tank type are defined once and reused.

const SALINITY: TargetRange = {
  min: 1.025,
  max: 1.026,
  ideal: 1.0255,
  unit: "SG",
  label: "Salinity",
};
const TEMP: TargetRange = {
  min: 24,
  max: 27,
  ideal: 25.5,
  unit: "°C",
  label: "Temperature",
};
const PH: TargetRange = {
  min: 7.9,
  max: 8.4,
  ideal: 8.2,
  unit: "",
  label: "pH",
};
const CALCIUM: TargetRange = {
  min: 400,
  max: 450,
  ideal: 425,
  unit: "ppm",
  label: "Calcium",
};
const MAGNESIUM: TargetRange = {
  min: 1250,
  max: 1400,
  ideal: 1325,
  unit: "ppm",
  label: "Magnesium",
};
const AMMONIA: TargetRange = {
  min: 0,
  max: 0,
  ideal: 0,
  unit: "ppm",
  label: "Ammonia",
};
const NITRITE: TargetRange = {
  min: 0,
  max: 0,
  ideal: 0,
  unit: "ppm",
  label: "Nitrite",
};
const ORP: TargetRange = {
  min: 300,
  max: 450,
  ideal: 375,
  unit: "mV",
  label: "ORP",
};

const alk = (min: number, max: number): TargetRange => ({
  min,
  max,
  ideal: (min + max) / 2,
  unit: "dKH",
  label: "Alkalinity",
});
const nitrate = (min: number, max: number): TargetRange => ({
  min,
  max,
  ideal: (min + max) / 2,
  unit: "ppm",
  label: "Nitrate",
});
const phosphate = (min: number, max: number): TargetRange => ({
  min,
  max,
  ideal: (min + max) / 2,
  unit: "ppm",
  label: "Phosphate",
});

/** Build a full range set for a tank type from its variable bits. */
function ranges(opts: {
  alk: TargetRange;
  nitrate: TargetRange;
  phosphate: TargetRange;
}): Partial<Record<ParamKey, TargetRange>> {
  return {
    salinity_sg: SALINITY,
    temp_c: TEMP,
    ph: PH,
    alkalinity_dkh: opts.alk,
    calcium_ppm: CALCIUM,
    magnesium_ppm: MAGNESIUM,
    ammonia_ppm: AMMONIA,
    nitrite_ppm: NITRITE,
    nitrate_ppm: opts.nitrate,
    phosphate_ppm: opts.phosphate,
    orp_mv: ORP,
  };
}

// ─────────────────────────── target catalog ───────────────────────────

export const TARGET_RANGES: Record<
  TankType,
  Partial<Record<ParamKey, TargetRange>>
> = {
  // Fish-only with live rock: tolerates the highest nutrients, no coral needs.
  fowlr: ranges({
    alk: alk(8, 9.5),
    nitrate: nitrate(10, 40),
    phosphate: phosphate(0.03, 0.1),
  }),
  // Soft corals: forgiving, like a little more nutrient.
  soft: ranges({
    alk: alk(8, 9.5),
    nitrate: nitrate(5, 25),
    phosphate: phosphate(0.03, 0.1),
  }),
  // LPS: moderate stability, moderate nutrients.
  lps: ranges({
    alk: alk(8, 9.5),
    nitrate: nitrate(5, 25),
    phosphate: phosphate(0.03, 0.1),
  }),
  // SPS: demands low, stable nutrients and tighter alkalinity.
  sps: ranges({
    alk: alk(7, 8.5),
    nitrate: nitrate(1, 10),
    phosphate: phosphate(0.02, 0.05),
  }),
  // Mixed reef: a balanced compromise leaning toward SPS stability.
  mixed: ranges({
    alk: alk(8, 9.5),
    nitrate: nitrate(5, 20),
    phosphate: phosphate(0.03, 0.1),
  }),
  // Nano: small volume swings fast — keep alkalinity in a tight middle band.
  nano: ranges({
    alk: alk(8, 9),
    nitrate: nitrate(5, 20),
    phosphate: phosphate(0.03, 0.1),
  }),
};

// ─────────────────────────── classification ───────────────────────────

/**
 * Classify a single parameter value for a tank type.
 * - "critical": acutely dangerous (detectable ammonia/nitrite > 0.25, temp
 *   outside 22–30°C, nitrate at/above 4× the type's max).
 * - "low"/"high": out of the target band but not in the danger zone.
 * - "ok": within [min, max].
 * - "unknown": no target range defined for this key/type.
 */
export function classifyParameter(
  key: ParamKey,
  value: number,
  tankType: TankType,
): ParamStatus {
  const range = TARGET_RANGES[tankType][key];
  if (!range) return "unknown";

  // Absolute critical zones first (independent of the soft range bounds).
  if (key === "ammonia_ppm" || key === "nitrite_ppm") {
    if (value > TOXIN_CRITICAL_PPM) return "critical";
    if (value > range.max) return "high"; // any detectable amount > 0 target
    return "ok";
  }

  if (key === "temp_c") {
    if (value < TEMP_CRITICAL_LOW || value > TEMP_CRITICAL_HIGH) {
      return "critical";
    }
    if (value < range.min) return "low";
    if (value > range.max) return "high";
    return "ok";
  }

  if (key === "nitrate_ppm") {
    if (value >= range.max * NITRATE_CRITICAL_MULTIPLE) return "critical";
    if (value < range.min) return "low";
    if (value > range.max) return "high";
    return "ok";
  }

  // Generic band check for the remaining parameters.
  if (value < range.min) return "low";
  if (value > range.max) return "high";
  return "ok";
}

/** All numeric keys we may find on a reading, in a stable display order. */
const READING_KEYS: ParamKey[] = [
  "salinity_sg",
  "temp_c",
  "ph",
  "alkalinity_dkh",
  "calcium_ppm",
  "magnesium_ppm",
  "ammonia_ppm",
  "nitrite_ppm",
  "nitrate_ppm",
  "phosphate_ppm",
  "orp_mv",
];

/**
 * Classify every present numeric measure on a reading. Null/undefined measures
 * are skipped (you only logged what you tested).
 */
export function classifyReading(
  reading: ParameterReading,
  tankType: TankType,
): Array<{ key: ParamKey; value: number; status: string }> {
  const out: Array<{ key: ParamKey; value: number; status: string }> = [];
  for (const key of READING_KEYS) {
    const value = reading[key];
    if (value === null || value === undefined) continue;
    out.push({ key, value, status: classifyParameter(key, value, tankType) });
  }
  return out;
}

// ─────────────────────────── nitrogen-cycle staging ───────────────────────────

/**
 * "Present" threshold for nitrogen species. Hobby test kits round trace amounts;
 * anything at/below this counts as ~0.
 */
const PRESENCE_PPM = 0.05;

const present = (v: number | null | undefined): boolean =>
  typeof v === "number" && v > PRESENCE_PPM;

/**
 * Stage a tank within the nitrogen cycle from a single reading.
 *
 * Progression (precedence order):
 *  1. nitrite present                     → "nitrite" (the spike that must clear)
 *  2. ammonia present                     → "ammonia" (or "nitrate" if nitrate is
 *                                            already building while ammonia lingers)
 *  3. nitrate present, ammonia & nitrite ~0 → "cycled"
 *  4. everything ~0 (or nothing logged)   → "not-started"
 */
export function cycleStage(reading: ParameterReading): CycleStage {
  const ammonia = present(reading.ammonia_ppm);
  const nitrite = present(reading.nitrite_ppm);
  const nitrate = present(reading.nitrate_ppm);

  // Nitrite spike dominates: it must drop to zero before the tank is usable.
  if (nitrite) return "nitrite";

  if (ammonia) {
    // Nitrate building while ammonia still lingers → nitrate-conversion phase.
    return nitrate ? "nitrate" : "ammonia";
  }

  // Ammonia and nitrite both ~0.
  if (nitrate) return "cycled";

  return "not-started";
}
