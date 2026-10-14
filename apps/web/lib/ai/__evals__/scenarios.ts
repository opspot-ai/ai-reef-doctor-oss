/**
 * AI eval fixtures ( contracts,  RAG,  safety).
 *
 * A curated set of realistic reef scenarios spanning every diagnosis kind. They
 * drive two layers of evaluation (see ./evals.test.ts):
 *
 *  1. DETERMINISTIC (always runs, NO API key): each scenario's query is fed
 *     through the real grounding layer (groundFor / groundForKinds) and we assert
 *     that at least one retrieved source relates to an expected topic — a genuine
 *     grounding eval against the curated corpus. A representative, model-shaped
 *     DiagnosisResult / ParamAnalysis is then run through the deterministic safety
 *     layer and we assert the  invariants hold.
 *
 *  2. LIVE (gated on ANTHROPIC_API_KEY): a couple of scenarios are sent to the
 *     real model via generateStructured and the output is validated against the
 *     shared zod schema. Skipped (never failed) when no key is present.
 *
 * These fixtures are pure data — no Anthropic SDK import — so the module is safe
 * to import and exercise with no API key configured.
 */
import type {
  DiagnosisResult,
  ParamAnalysis,
  ParameterReading,
} from "@reef/shared";

export type DiagKind = "fish" | "coral" | "algae" | "params" | "symptom";
export type Urgency = "routine" | "monitor" | "urgent" | "emergency";

/**
 * A grounding "topic" expectation is a case-insensitive substring we expect to
 * appear in the title or one of the tags of at least one retrieved source. A
 * scenario passes the grounding eval if ANY of its `expectGroundingTopicsAnyOf`
 * matches ANY retrieved source — a real, deterministic relevance check.
 */
export interface Scenario {
  /** Stable id used in test names. */
  id: string;
  /** Human-readable description of what is being evaluated. */
  description: string;
  /** Diagnosis kind this scenario maps to. */
  kind: DiagKind;
  /** Free-text user query / photo note that drives retrieval and (live) the model. */
  query: string;
  /**
   * Topics (substrings) we expect to surface in retrieved source titles/tags.
   * The scenario grounds correctly if ANY of these matches ANY retrieved source.
   */
  expectGroundingTopicsAnyOf: string[];
  /** Every health response must carry the  safety invariants. Always true. */
  mustBeSafe: true;
  /**
   * Whether this scenario's representative result mentions a medication dose. If
   * true, the safety layer MUST attach a DOSE_WARNING.
   */
  dose: boolean;
  /**
   * Expected urgency floor for emergency-class scenarios. When set, the
   * representative diagnosis must carry an urgent/emergency urgency.
   */
  expectUrgencyOneOf?: Urgency[];
  /**
   * Representative, model-SHAPED DiagnosisResult used by the deterministic safety
   * eval (present for diagnosis-style kinds). Intentionally "raw" — it may be
   * missing fields the safety layer is responsible for adding.
   */
  diagnosis?: DiagnosisResult;
  /** Representative model-shaped ParamAnalysis (present for params-style kinds). */
  paramAnalysis?: ParamAnalysis;
  /** Sample readings for params scenarios (for the optional live param path). */
  readings?: ParameterReading[];
}

/** Helper: a minimal disclaimer-less, raw diagnosis as the model might emit it. */
function rawDiagnosis(d: DiagnosisResult): DiagnosisResult {
  return d;
}

export const SCENARIOS: Scenario[] = [
  // ─────────────────────────── 1. Fish: white-spot / ich ───────────────────────────
  {
    id: "fish-ich-white-spot",
    description:
      "Fish with scattered salt-grain white spots, flashing & scratching — classic marine ich.",
    kind: "fish",
    query:
      "My yellow tang has scattered tiny white salt-grain spots on its fins and body, " +
      "and it keeps flashing and scratching on the rocks. Breathing looks a bit fast.",
    expectGroundingTopicsAnyOf: ["ich", "cryptocaryon", "white spot", "quarantine"],
    mustBeSafe: true,
    dose: false,
    diagnosis: rawDiagnosis({
      summary: "White-spot pattern with flashing strongly suggests marine ich.",
      conditions: [
        {
          name: "Marine Ich (Cryptocaryon irritans)",
          confidence: 0.82,
          severity: "moderate",
          evidence: [
            "scattered salt-grain white spots on fins and body",
            "flashing and scratching on rockwork",
          ],
          recommendedSteps: [
            "Move all fish to quarantine; the display must run fallow ~76 days",
            "Treat in QT with copper or tank-transfer; do not medicate the display",
          ],
        },
      ],
      urgency: "monitor",
      sources: [],
      disclaimer: "",
    }),
  },

  // ─────────────── 2. Fish: rapid breathing / velvet EMERGENCY ───────────────
  {
    id: "fish-velvet-emergency",
    description:
      "Rapid gilling, gold dusty sheen, clamped fins, sudden deaths — marine velvet emergency.",
    kind: "fish",
    query:
      "Help! Several fish are breathing super fast at the surface with clamped fins and a " +
      "fine gold dusty sheen, and one already died suddenly overnight. Could this be velvet?",
    expectGroundingTopicsAnyOf: [
      "velvet",
      "amyloodinium",
      "rapid breathing",
      "emergency",
    ],
    mustBeSafe: true,
    dose: false,
    expectUrgencyOneOf: ["urgent", "emergency"],
    diagnosis: rawDiagnosis({
      summary:
        "Rapid gilling, gold sheen, clamped fins and a sudden death point to marine velvet — act now.",
      conditions: [
        {
          name: "Marine Velvet (Amyloodinium ocellatum)",
          confidence: 0.78,
          severity: "critical",
          evidence: [
            "heavy rapid breathing at the surface",
            "fine gold/dusty velvet sheen and clamped fins",
            "a sudden overnight death",
          ],
          recommendedSteps: [
            "Move all fish to quarantine immediately and start therapeutic treatment",
            "Run the display fallow ~76+ days; improve oxygenation right away",
          ],
        },
      ],
      urgency: "emergency",
      sources: [],
      disclaimer: "",
    }),
  },

  // ─────────────────────────── 3. Coral bleaching ───────────────────────────
  {
    id: "coral-bleaching",
    description:
      "Acropora gone stark white with tissue still present — bleaching, not tissue death.",
    kind: "coral",
    query:
      "My acropora turned stark white over a few days but the tissue still looks present, " +
      "not bare skeleton. Pale coral after a lighting change — is this bleaching?",
    expectGroundingTopicsAnyOf: ["bleach", "zooxanthellae", "coral health", "pale coral"],
    mustBeSafe: true,
    dose: false,
    diagnosis: rawDiagnosis({
      summary:
        "Pale-to-white tissue that is still present (not bare skeleton) indicates bleaching.",
      conditions: [
        {
          name: "Coral Bleaching",
          confidence: 0.7,
          severity: "high",
          evidence: [
            "stark white tissue still present, skeleton not exposed",
            "followed a sudden lighting change",
          ],
          recommendedSteps: [
            "Stabilize the offending parameter and dial back intense light gradually",
            "Keep nutrients from bottoming out and target-feed if possible",
          ],
        },
      ],
      urgency: "monitor",
      sources: [],
      disclaimer: "",
    }),
  },

  // ─────────────── 4. Algae: cyanobacteria (red slime) ───────────────
  {
    id: "algae-cyano",
    description:
      "Slimy red/maroon sheets with trapped bubbles in low-flow areas — cyanobacteria.",
    kind: "algae",
    query:
      "I've got slimy red and maroon sheets with trapped oxygen bubbles spreading over the " +
      "sand and rock in the low-flow corners. Is this cyano / red slime?",
    expectGroundingTopicsAnyOf: ["cyano", "red slime", "nuisance"],
    mustBeSafe: true,
    dose: false,
    diagnosis: rawDiagnosis({
      summary: "Slimy red sheets with trapped bubbles in dead spots are classic cyanobacteria.",
      conditions: [
        {
          name: "Cyanobacteria (red slime)",
          confidence: 0.75,
          severity: "low",
          evidence: [
            "red/maroon slimy sheets with trapped oxygen bubbles",
            "concentrated in low-flow corners",
          ],
          recommendedSteps: [
            "Boost flow, manually siphon the sheets, and improve nutrient export",
            "Address overfeeding and detritus build-up to stop it returning",
          ],
        },
      ],
      urgency: "routine",
      sources: [],
      disclaimer: "",
    }),
  },

  // ─────────────── 5. Algae: dinoflagellates (vs other algae) ───────────────
  {
    id: "algae-dino",
    description:
      "Brown snotty strings with bubbles that recede at night in a too-clean tank — dinos.",
    kind: "algae",
    query:
      "Brown/golden snotty stringy stuff with trapped bubbles keeps exploding under light and " +
      "receding at night, in a pretty low-nutrient tank. Dinoflagellates vs diatoms?",
    expectGroundingTopicsAnyOf: ["dino", "dinoflagellate", "nuisance"],
    mustBeSafe: true,
    dose: false,
    diagnosis: rawDiagnosis({
      summary:
        "Brown snotty strings with bubbles that recede at night in a low-nutrient tank point to dinoflagellates.",
      conditions: [
        {
          name: "Dinoflagellates (dinos)",
          confidence: 0.62,
          severity: "moderate",
          evidence: [
            "brown/golden snotty strings with trapped bubbles",
            "recede at night and explode under light; tank runs ultra-low-nutrient",
          ],
          recommendedSteps: [
            "Raise nutrients so nitrate/phosphate don't hit zero; boost biodiversity",
            "Run UV, do a 3-day blackout, manually siphon, and raise pH",
          ],
        },
      ],
      urgency: "monitor",
      sources: [],
      disclaimer: "",
    }),
  },

  // ─────────────── 6. Params: ammonia spike in a new tank ───────────────
  {
    id: "params-ammonia-spike",
    description:
      "Ammonia spike in a brand-new, mid-cycle tank with fish already added — toxic.",
    kind: "params",
    query:
      "Brand new tank, only set up two weeks ago, and ammonia is reading 1.0 ppm with fish " +
      "gasping at the surface. Did I add fish before the nitrogen cycle finished?",
    expectGroundingTopicsAnyOf: ["nitrogen cycle", "ammonia", "cycling", "new tank"],
    mustBeSafe: true,
    dose: false,
    expectUrgencyOneOf: ["urgent", "emergency"],
    diagnosis: rawDiagnosis({
      summary:
        "Detectable ammonia in a two-week-old tank means it isn't cycled — this is toxic to fish.",
      conditions: [
        {
          name: "Ammonia toxicity (incomplete nitrogen cycle)",
          confidence: 0.85,
          severity: "critical",
          evidence: [
            "ammonia 1.0 ppm in a tank set up only two weeks ago",
            "fish gasping at the surface",
          ],
          recommendedSteps: [
            "Do an immediate water change to dilute ammonia and improve aeration",
            "Stop feeding heavily; add bottled nitrifying bacteria and test daily",
          ],
        },
      ],
      urgency: "urgent",
      sources: [],
      disclaimer: "",
    }),
  },

  // ─────────────── 7. Params: alkalinity swing ───────────────
  {
    id: "params-alk-swing",
    description:
      "Alkalinity dropped fast overnight and SPS tips are burning — an alk swing.",
    kind: "params",
    query:
      "My alkalinity dropped from 9 to 7 dKH overnight and a couple SPS tips are burning / " +
      "receding. How dangerous is an alkalinity swing and how do I fix it?",
    expectGroundingTopicsAnyOf: ["alkalinity", "alk swing", "alk stability", "dkh"],
    mustBeSafe: true,
    dose: false,
    paramAnalysis: {
      summary:
        "A 2 dKH overnight swing is a bigger problem than the absolute value — stabilize alkalinity.",
      findings: [
        {
          parameter: "alkalinity_dkh",
          status: "low",
          message:
            "Dropped from 9 to 7 dKH overnight; rapid swings burn SPS tips and can trigger STN/RTN.",
        },
      ],
      recommendations: [
        "Restore alkalinity slowly and hold it within a narrow ±0.5 dKH band day to day",
        "Test daily and dose to match coral uptake; avoid large corrective jumps",
      ],
      sources: [],
      disclaimer: "",
    },
    readings: [{ alkalinity_dkh: 7, source: "manual" }],
  },

  // ─────────────── 8. Dosing question: copper (DOSE warning required) ───────────────
  {
    id: "dosing-copper",
    description:
      "How much copper to dose in quarantine — representative result mentions a ppm dose.",
    kind: "fish",
    query:
      "How much Cupramine (ionic copper) should I dose in my quarantine tank to treat ich, " +
      "and what therapeutic ppm should I hold it at?",
    expectGroundingTopicsAnyOf: ["copper", "cupramine", "therapeutic copper", "ppm"],
    mustBeSafe: true,
    dose: true,
    diagnosis: rawDiagnosis({
      summary:
        "For ich in quarantine, ionic copper (Cupramine) is held around a therapeutic level — confirm with daily testing.",
      conditions: [
        {
          name: "Copper treatment for marine ich",
          confidence: 0.8,
          severity: "moderate",
          evidence: [
            "ich is treatable with therapeutic copper in a fish-only quarantine",
          ],
          recommendedSteps: [
            "Ramp ionic copper slowly toward ~0.5 ppm and verify with a daily copper test",
            "Hold the therapeutic level ~14-30 days; never combine ionic and chelated copper",
          ],
        },
      ],
      urgency: "monitor",
      sources: [],
      disclaimer: "",
      // doseWarnings intentionally OMITTED so the safety layer must add it.
    }),
  },

  // ─────────────── 9. Compatibility question ───────────────
  {
    id: "compatibility-second-tang",
    description:
      "Can a second tang be added — stocking order / aggression compatibility question.",
    kind: "symptom",
    query:
      "I already have a yellow tang. Can I add a second tang of a different color, or will " +
      "they fight? Asking about fish compatibility, aggression, and stocking order.",
    expectGroundingTopicsAnyOf: ["compatibility", "aggression", "stocking order", "tangs"],
    mustBeSafe: true,
    dose: false,
    diagnosis: rawDiagnosis({
      summary:
        "Tang-on-tang aggression is common; success depends on tank footprint, timing, and species choice.",
      conditions: [
        {
          name: "Tang compatibility / aggression risk",
          confidence: 0.6,
          severity: "low",
          evidence: [
            "one fish per aggressive genus is the safe default unless the tank is large",
            "stocking order and footprint drive whether a second tang works",
          ],
          recommendedSteps: [
            "Add the new tang last, pick a different body shape, and provide rockwork hiding spots",
            "Be ready to separate them if aggression escalates",
          ],
        },
      ],
      urgency: "routine",
      sources: [],
      disclaimer: "",
    }),
  },

  // ─────────────── 10. Low-confidence symptom (must add LOW_CONFIDENCE_NOTE) ───────────────
  {
    id: "symptom-low-confidence",
    description:
      "Vague single-fish symptom with weak evidence — strongest condition is below threshold.",
    kind: "symptom",
    query:
      "One of my fish has been hiding more and isn't eating as enthusiastically, no obvious " +
      "spots or marks. It's a marine fish — what could be wrong?",
    expectGroundingTopicsAnyOf: [
      "disease",
      "ich",
      "fin rot",
      "quarantine",
      "fish disease",
      "uronema",
    ],
    mustBeSafe: true,
    dose: false,
    diagnosis: rawDiagnosis({
      summary: "Non-specific lethargy and reduced appetite with no visible marks.",
      conditions: [
        {
          name: "Early/undetermined illness or stress",
          confidence: 0.35,
          severity: "low",
          evidence: ["hiding more and eating less", "no visible spots or lesions"],
          recommendedSteps: [
            "Observe closely, keep water pristine, and watch for breathing or spot changes",
            "Take clear, well-lit photos to narrow the cause",
          ],
        },
      ],
      urgency: "monitor",
      sources: [],
      disclaimer: "",
    }),
  },
];

/** Scenarios that carry a representative DiagnosisResult for the safety eval. */
export const DIAGNOSIS_SCENARIOS: Scenario[] = SCENARIOS.filter(
  (s): s is Scenario & { diagnosis: DiagnosisResult } => s.diagnosis !== undefined,
);

/** Scenarios that carry a representative ParamAnalysis for the safety eval. */
export const PARAM_SCENARIOS: Scenario[] = SCENARIOS.filter(
  (s): s is Scenario & { paramAnalysis: ParamAnalysis } =>
    s.paramAnalysis !== undefined,
);

/** Scenarios flagged as emergencies (must map to urgent/emergency urgency). */
export const EMERGENCY_SCENARIOS: Scenario[] = SCENARIOS.filter(
  (s) => s.expectUrgencyOneOf !== undefined,
);

/** Scenarios whose representative result mentions a dose (must carry DOSE_WARNING). */
export const DOSE_SCENARIOS: Scenario[] = SCENARIOS.filter((s) => s.dose);

/** Two representative scenarios used by the gated LIVE model eval. */
export const LIVE_SCENARIOS: Scenario[] = [
  SCENARIOS.find((s) => s.id === "fish-ich-white-spot")!,
  SCENARIOS.find((s) => s.id === "coral-bleaching")!,
];
