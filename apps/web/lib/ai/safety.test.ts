import { describe, expect, it } from "vitest";
import {
  MEDICAL_DISCLAIMER,
  DOSE_WARNING,
  LOW_CONFIDENCE_NOTE,
  DiagnosisResultSchema,
  ParamAnalysisSchema,
  type DiagnosisResult,
  type ParamAnalysis,
  type SourceCitation,
} from "@reef/shared";
import {
  enforceDiagnosisSafety,
  enforceParamAnalysisSafety,
  diagnosisFallback,
  paramAnalysisFallback,
} from "@/lib/ai/safety";

// Build a DiagnosisResult with sensible defaults, overridable per test.
function makeDiagnosis(
  overrides: Partial<DiagnosisResult> = {},
): DiagnosisResult {
  return {
    summary: "Possible ich based on white spots.",
    conditions: [
      {
        name: "Marine Ich (Cryptocaryon)",
        confidence: 0.8,
        severity: "moderate",
        evidence: ["white spots on fins"],
        recommendedSteps: ["quarantine the affected fish"],
      },
    ],
    urgency: "monitor",
    sources: [{ title: "Disease Guide", ref: "kb:ich" }],
    disclaimer: MEDICAL_DISCLAIMER,
    ...overrides,
  };
}

function makeParamAnalysis(
  overrides: Partial<ParamAnalysis> = {},
): ParamAnalysis {
  return {
    summary: "Alkalinity is a touch high.",
    findings: [
      { parameter: "alkalinity_dkh", status: "high", message: "9.5 dKH" },
    ],
    recommendations: ["Hold dosing and re-test tomorrow."],
    sources: [{ title: "Target Ranges", ref: "kb:params" }],
    disclaimer: MEDICAL_DISCLAIMER,
    ...overrides,
  };
}

describe("enforceDiagnosisSafety — disclaimer", () => {
  it("fills a missing disclaimer with MEDICAL_DISCLAIMER", () => {
    const out = enforceDiagnosisSafety(
      makeDiagnosis({ disclaimer: "" }),
    );
    expect(out.disclaimer).toBe(MEDICAL_DISCLAIMER);
  });

  it("fills a whitespace-only disclaimer", () => {
    const out = enforceDiagnosisSafety(makeDiagnosis({ disclaimer: "   " }));
    expect(out.disclaimer).toBe(MEDICAL_DISCLAIMER);
  });

  it("keeps a model-provided disclaimer", () => {
    const out = enforceDiagnosisSafety(
      makeDiagnosis({ disclaimer: "Custom disclaimer." }),
    );
    expect(out.disclaimer).toBe("Custom disclaimer.");
  });
});

describe("enforceDiagnosisSafety — confidence clamping", () => {
  it("clamps 1.7 -> 1 and -0.2 -> 0", () => {
    const out = enforceDiagnosisSafety(
      makeDiagnosis({
        conditions: [
          {
            name: "A",
            confidence: 1.7,
            severity: "high",
            evidence: [],
            recommendedSteps: [],
          },
          {
            name: "B",
            confidence: -0.2,
            severity: "low",
            evidence: [],
            recommendedSteps: [],
          },
        ],
      }),
    );
    expect(out.conditions[0]!.confidence).toBe(1);
    expect(out.conditions[1]!.confidence).toBe(0);
  });

  it("coerces non-finite confidence (NaN/Infinity) to a valid in-range value", () => {
    // Non-finite values are not trustworthy signals, so they collapse to 0
    // (the conservative end) rather than implying a confident diagnosis.
    const out = enforceDiagnosisSafety(
      makeDiagnosis({
        conditions: [
          {
            name: "A",
            confidence: Number.NaN,
            severity: "high",
            evidence: [],
            recommendedSteps: [],
          },
          {
            name: "B",
            confidence: Number.POSITIVE_INFINITY,
            severity: "high",
            evidence: [],
            recommendedSteps: [],
          },
        ],
      }),
    );
    expect(out.conditions[0]!.confidence).toBe(0);
    expect(out.conditions[1]!.confidence).toBe(0);
    expect(Number.isFinite(out.conditions[0]!.confidence)).toBe(true);
    expect(Number.isFinite(out.conditions[1]!.confidence)).toBe(true);
    // Still schema-valid after clamping.
    expect(DiagnosisResultSchema.safeParse(out).success).toBe(true);
  });
});

describe("enforceDiagnosisSafety — sources", () => {
  it("falls back to passed sources when d.sources is empty", () => {
    const grounding: SourceCitation[] = [
      { title: "Fallback", ref: "kb:fallback" },
    ];
    const out = enforceDiagnosisSafety(
      makeDiagnosis({ sources: [] }),
      grounding,
    );
    expect(out.sources).toEqual(grounding);
  });

  it("keeps model sources over passed sources", () => {
    const grounding: SourceCitation[] = [
      { title: "Fallback", ref: "kb:fallback" },
    ];
    const out = enforceDiagnosisSafety(makeDiagnosis(), grounding);
    expect(out.sources).toEqual([{ title: "Disease Guide", ref: "kb:ich" }]);
  });

  it("always yields a sources array even with none anywhere", () => {
    const out = enforceDiagnosisSafety(
      makeDiagnosis({ sources: undefined as unknown as [] }),
    );
    expect(Array.isArray(out.sources)).toBe(true);
    expect(out.sources).toEqual([]);
  });
});

describe("enforceDiagnosisSafety — dose detection", () => {
  it('a recommendedStep "dose 2.5 ppm copper" forces DOSE_WARNING', () => {
    const out = enforceDiagnosisSafety(
      makeDiagnosis({
        conditions: [
          {
            name: "Ich",
            confidence: 0.7,
            severity: "high",
            evidence: [],
            recommendedSteps: ["dose 2.5 ppm copper over 5 days"],
          },
        ],
        doseWarnings: undefined,
      }),
    );
    expect(out.doseWarnings).toBeDefined();
    expect(out.doseWarnings!.length).toBeGreaterThan(0);
    expect(out.doseWarnings).toContain(DOSE_WARNING);
  });

  it("detects a dose mentioned only in the summary", () => {
    const out = enforceDiagnosisSafety(
      makeDiagnosis({
        summary: "Consider 5 ml of Prazipro per day.",
        conditions: [],
      }),
    );
    expect(out.doseWarnings).toContain(DOSE_WARNING);
  });

  it("detects a dose mentioned in evidence", () => {
    const out = enforceDiagnosisSafety(
      makeDiagnosis({
        summary: "no dose here in words",
        conditions: [
          {
            name: "X",
            confidence: 0.7,
            severity: "low",
            evidence: ["alk swung to 11 dKH"],
            recommendedSteps: [],
          },
        ],
      }),
    );
    expect(out.doseWarnings).toContain(DOSE_WARNING);
  });

  it("does not add a dose warning when no dose is mentioned", () => {
    const out = enforceDiagnosisSafety(
      makeDiagnosis({
        summary: "White spots suggest a parasite. Quarantine and observe.",
        conditions: [
          {
            name: "Ich",
            confidence: 0.7,
            severity: "moderate",
            evidence: ["white spots"],
            recommendedSteps: ["quarantine the fish", "raise observation"],
          },
        ],
        doseWarnings: undefined,
      }),
    );
    expect(out.doseWarnings).toBeUndefined();
  });

  it("does not duplicate an existing DOSE_WARNING", () => {
    const out = enforceDiagnosisSafety(
      makeDiagnosis({
        summary: "Add 10 ml of formalin.",
        doseWarnings: [DOSE_WARNING],
      }),
    );
    expect(
      out.doseWarnings!.filter((w) => w === DOSE_WARNING),
    ).toHaveLength(1);
  });
});

describe("enforceDiagnosisSafety — low confidence note", () => {
  it("appends the note when max confidence < 0.55", () => {
    const out = enforceDiagnosisSafety(
      makeDiagnosis({
        summary: "Hard to tell.",
        conditions: [
          {
            name: "Maybe ich",
            confidence: 0.4,
            severity: "low",
            evidence: [],
            recommendedSteps: [],
          },
        ],
      }),
    );
    expect(out.summary).toContain(LOW_CONFIDENCE_NOTE);
  });

  it("appends the note exactly once (not twice) if already present", () => {
    const out = enforceDiagnosisSafety(
      makeDiagnosis({
        summary: `Hard to tell.\n\n${LOW_CONFIDENCE_NOTE}`,
        conditions: [
          {
            name: "Maybe ich",
            confidence: 0.3,
            severity: "low",
            evidence: [],
            recommendedSteps: [],
          },
        ],
      }),
    );
    const occurrences = out.summary.split(LOW_CONFIDENCE_NOTE).length - 1;
    expect(occurrences).toBe(1);
  });

  it("does NOT append the note when confidence is high", () => {
    const out = enforceDiagnosisSafety(makeDiagnosis()); // 0.8
    expect(out.summary).not.toContain(LOW_CONFIDENCE_NOTE);
  });

  it("does NOT append the note when there are no conditions", () => {
    const out = enforceDiagnosisSafety(
      makeDiagnosis({ summary: "Inconclusive.", conditions: [] }),
    );
    expect(out.summary).not.toContain(LOW_CONFIDENCE_NOTE);
  });
});

describe("enforceDiagnosisSafety — output validity & immutability", () => {
  it("produces schema-valid output", () => {
    const out = enforceDiagnosisSafety(makeDiagnosis({ disclaimer: "" }));
    expect(DiagnosisResultSchema.safeParse(out).success).toBe(true);
  });

  it("does not mutate the input object", () => {
    const input = makeDiagnosis({ disclaimer: "" });
    const snapshot = JSON.stringify(input);
    enforceDiagnosisSafety(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe("enforceParamAnalysisSafety", () => {
  it("fills a missing disclaimer", () => {
    const out = enforceParamAnalysisSafety(
      makeParamAnalysis({ disclaimer: "" }),
    );
    expect(out.disclaimer).toBe(MEDICAL_DISCLAIMER);
  });

  it("falls back to passed sources when empty", () => {
    const grounding: SourceCitation[] = [
      { title: "Ranges", ref: "kb:ranges" },
    ];
    const out = enforceParamAnalysisSafety(
      makeParamAnalysis({ sources: [] }),
      grounding,
    );
    expect(out.sources).toEqual(grounding);
  });

  it("ensures a sources array when none provided", () => {
    const out = enforceParamAnalysisSafety(
      makeParamAnalysis({ sources: undefined as unknown as [] }),
    );
    expect(Array.isArray(out.sources)).toBe(true);
    expect(out.sources).toEqual([]);
  });

  it("produces schema-valid output", () => {
    const out = enforceParamAnalysisSafety(
      makeParamAnalysis({ disclaimer: "" }),
    );
    expect(ParamAnalysisSchema.safeParse(out).success).toBe(true);
  });
});

describe("diagnosisFallback", () => {
  it("returns a safe refusal object that validates", () => {
    const out = diagnosisFallback("fish", "refusal");
    expect(out.conditions).toEqual([]);
    expect(out.urgency).toBe("routine");
    expect(out.disclaimer).toBe(MEDICAL_DISCLAIMER);
    expect(out.sources).toEqual([]);
    expect(out.summary.length).toBeGreaterThan(0);
    expect(DiagnosisResultSchema.safeParse(out).success).toBe(true);
  });

  it("returns a safe error object that validates", () => {
    const out = diagnosisFallback("coral", "error");
    expect(out.urgency).toBe("routine");
    expect(DiagnosisResultSchema.safeParse(out).success).toBe(true);
  });

  it("handles an empty kind gracefully", () => {
    const out = diagnosisFallback("", "error");
    expect(out.summary.length).toBeGreaterThan(0);
    expect(DiagnosisResultSchema.safeParse(out).success).toBe(true);
  });

  it("a fallback fed back through enforce stays clean (no dose warning, no note)", () => {
    const out = enforceDiagnosisSafety(diagnosisFallback("fish", "refusal"));
    expect(out.doseWarnings).toBeUndefined();
    expect(out.summary).not.toContain(LOW_CONFIDENCE_NOTE);
    expect(DiagnosisResultSchema.safeParse(out).success).toBe(true);
  });
});

describe("paramAnalysisFallback", () => {
  it("returns a safe refusal object that validates", () => {
    const out = paramAnalysisFallback("refusal");
    expect(out.findings).toEqual([]);
    expect(out.recommendations).toEqual([]);
    expect(out.sources).toEqual([]);
    expect(out.disclaimer).toBe(MEDICAL_DISCLAIMER);
    expect(ParamAnalysisSchema.safeParse(out).success).toBe(true);
  });

  it("returns a safe error object that validates", () => {
    const out = paramAnalysisFallback("error");
    expect(ParamAnalysisSchema.safeParse(out).success).toBe(true);
  });
});
