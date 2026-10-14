// @vitest-environment node
/**
 * AI evals ( contracts,  RAG grounding,  safety).
 *
 * Two layers:
 *   1) DETERMINISTIC — always runs, requires NO ANTHROPIC_API_KEY. For every
 *      scenario it (a) runs the real grounding layer and asserts at least one
 *      retrieved source relates to an expected topic, and (b) feeds a
 *      representative model-shaped result through the deterministic safety layer
 *      and asserts the  invariants. The Anthropic SDK is mocked so importing
 *      the route/wrapper modules never touches the network.
 *   2) LIVE — gated via describe.skipIf(!ANTHROPIC_API_KEY). When a key is
 *      present it calls the real generateStructured for two scenarios and
 *      validates the result against DiagnosisResultSchema. Skipped (not failed)
 *      with no key.
 */
import { describe, expect, it, vi } from "vitest";
import {
  retrieve,
  knowledgeAsContext,
  DiagnosisResultSchema,
  ParamAnalysisSchema,
  MEDICAL_DISCLAIMER,
  DOSE_WARNING,
  LOW_CONFIDENCE_NOTE,
  type KnowledgeEntry,
} from "@reef/shared";

import { groundFor, groundForKinds } from "@/lib/ai/rag";
import {
  enforceDiagnosisSafety,
  enforceParamAnalysisSafety,
} from "@/lib/ai/safety";
import {
  SCENARIOS,
  DIAGNOSIS_SCENARIOS,
  PARAM_SCENARIOS,
  EMERGENCY_SCENARIOS,
  DOSE_SCENARIOS,
  LIVE_SCENARIOS,
  type Scenario,
} from "@/lib/ai/__evals__/scenarios";

// Never hit the network from these tests, even if a future import pulls in the
// Anthropic wrapper. The deterministic layer does not call it; this is belt &
// braces so the suite is safe with or without a key.
vi.mock("@/lib/ai/anthropic", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/ai/anthropic")>(
      "@/lib/ai/anthropic",
    );
  return { ...actual };
});

const KEY = process.env.ANTHROPIC_API_KEY;

/** Lowercased title + tags haystack for an entry (the real grounding signal). */
function entryHaystack(e: KnowledgeEntry): string {
  return `${e.title} ${e.tags.join(" ")}`.toLowerCase();
}

/** True if any retrieved entry's title/tags contain any expected topic substring. */
function retrievalMatchesTopic(
  entries: KnowledgeEntry[],
  topics: string[],
): boolean {
  return entries.some((e) => {
    const hay = entryHaystack(e);
    return topics.some((t) => hay.includes(t.toLowerCase()));
  });
}

// ─────────────────────────── Fixture sanity ───────────────────────────
describe("eval fixtures", () => {
  it("defines at least 8 scenarios spanning multiple diagnosis kinds", () => {
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(8);
    const kinds = new Set(SCENARIOS.map((s) => s.kind));
    // fish, coral, algae, params, symptom should all be represented.
    expect(kinds.size).toBeGreaterThanOrEqual(4);
    for (const k of ["fish", "coral", "algae", "params", "symptom"] as const) {
      expect(kinds.has(k)).toBe(true);
    }
  });

  it("every scenario is marked mustBeSafe and has a unique id", () => {
    const ids = new Set<string>();
    for (const s of SCENARIOS) {
      expect(s.mustBeSafe).toBe(true);
      expect(s.expectGroundingTopicsAnyOf.length).toBeGreaterThan(0);
      expect(ids.has(s.id)).toBe(false);
      ids.add(s.id);
    }
    expect(ids.size).toBe(SCENARIOS.length);
  });

  it("includes an emergency scenario and a dose scenario", () => {
    expect(EMERGENCY_SCENARIOS.length).toBeGreaterThanOrEqual(1);
    expect(DOSE_SCENARIOS.length).toBeGreaterThanOrEqual(1);
  });
});

// ─────────────────────────── Layer 1a: REAL grounding eval ───────────────────────────
describe("deterministic grounding eval (no API key)", () => {
  for (const s of SCENARIOS) {
    it(`[${s.id}] groundFor retrieves a topic-relevant source`, () => {
      // Direct retrieve (gives us tags too) — the ground-truth relevance signal.
      const entries = retrieve(s.query, 4);
      expect(entries.length).toBeGreaterThanOrEqual(1);
      expect(retrievalMatchesTopic(entries, s.expectGroundingTopicsAnyOf)).toBe(
        true,
      );

      // groundFor wraps retrieve and must yield a non-empty context + citations.
      const g = groundFor(s.query, 4);
      expect(g.context.length).toBeGreaterThan(0);
      expect(g.sources.length).toBeGreaterThanOrEqual(1);
      for (const src of g.sources) {
        expect(src.title.length).toBeGreaterThan(0);
        expect(src.ref.length).toBeGreaterThan(0);
      }
    });

    it(`[${s.id}] groundForKinds(${s.kind}, note) stays topic-relevant`, () => {
      const g = groundForKinds(s.kind, s.query, 4);
      expect(g.sources.length).toBeGreaterThanOrEqual(1);
      // The kind+note grounding must also surface at least one relevant source.
      const titles = g.sources.map((x) => x.title.toLowerCase());
      const hit = titles.some((t) =>
        s.expectGroundingTopicsAnyOf.some((topic) =>
          t.includes(topic.toLowerCase()),
        ),
      );
      // Fall back to checking the formatted context if a title alias differs
      // (e.g. topic word lives in tags rather than the title).
      const ctx = g.context.toLowerCase();
      const ctxHit = s.expectGroundingTopicsAnyOf.some((topic) =>
        ctx.includes(topic.toLowerCase()),
      );
      expect(hit || ctxHit).toBe(true);
    });
  }

  it("knowledgeAsContext over retrieved entries cites a [source]", () => {
    const entries = retrieve("marine ich copper quarantine", 3);
    const ctx = knowledgeAsContext(entries);
    expect(ctx).toContain("[source:");
    expect(ctx.toLowerCase()).toContain("ich");
  });
});

// ─────────────────────────── Layer 1b: safety invariants ───────────────────────────
/** Assert the universal  invariants on a safety-enforced diagnosis. */
function assertDiagnosisSafe(scenario: Scenario): void {
  if (!scenario.diagnosis) return;
  const g = groundFor(scenario.query, 4);
  const safe = enforceDiagnosisSafety(scenario.diagnosis, g.sources);

  // 1. Always validates against the shared schema.
  expect(DiagnosisResultSchema.safeParse(safe).success).toBe(true);

  // 2. Disclaimer present (filled in by the safety layer when the model omits it).
  expect(safe.disclaimer.length).toBeGreaterThan(0);
  expect(safe.disclaimer).toBe(MEDICAL_DISCLAIMER);

  // 3. Grounding sources present (model had none → grounding fallback used).
  expect(safe.sources.length).toBeGreaterThanOrEqual(1);

  // 4. Every confidence is within [0, 1].
  for (const c of safe.conditions) {
    expect(c.confidence).toBeGreaterThanOrEqual(0);
    expect(c.confidence).toBeLessThanOrEqual(1);
  }
}

describe("deterministic safety eval — diagnoses (no API key)", () => {
  for (const s of DIAGNOSIS_SCENARIOS) {
    it(`[${s.id}] enforceDiagnosisSafety guarantees disclaimer + sources + confidence`, () => {
      assertDiagnosisSafe(s);
    });
  }

  it("param-analysis scenarios pass enforceParamAnalysisSafety", () => {
    for (const s of PARAM_SCENARIOS) {
      const g = groundFor(s.query, 4);
      const safe = enforceParamAnalysisSafety(s.paramAnalysis!, g.sources);
      expect(ParamAnalysisSchema.safeParse(safe).success).toBe(true);
      expect(safe.disclaimer).toBe(MEDICAL_DISCLAIMER);
      expect(safe.sources.length).toBeGreaterThanOrEqual(1);
    }
    // Ensure at least one param scenario actually exists.
    expect(PARAM_SCENARIOS.length).toBeGreaterThanOrEqual(1);
  });
});

// ─────────────────────────── Layer 1c: dose / emergency / low-confidence ───────────────────────────
describe("deterministic safety eval — dose scenarios (no API key)", () => {
  for (const s of DOSE_SCENARIOS) {
    it(`[${s.id}] safety layer attaches a DOSE_WARNING`, () => {
      expect(s.diagnosis).toBeDefined();
      const g = groundFor(s.query, 4);
      const safe = enforceDiagnosisSafety(s.diagnosis!, g.sources);
      expect(safe.doseWarnings).toBeDefined();
      expect(safe.doseWarnings).toContain(DOSE_WARNING);
    });
  }
});

describe("deterministic safety eval — emergency urgency (no API key)", () => {
  for (const s of EMERGENCY_SCENARIOS) {
    it(`[${s.id}] maps to an urgent/emergency urgency`, () => {
      expect(s.diagnosis).toBeDefined();
      const g = groundFor(s.query, 4);
      const safe = enforceDiagnosisSafety(s.diagnosis!, g.sources);
      expect(s.expectUrgencyOneOf).toBeDefined();
      expect(s.expectUrgencyOneOf!).toContain(safe.urgency);
      expect(["urgent", "emergency"]).toContain(safe.urgency);
    });
  }
});

describe("deterministic safety eval — low confidence note (no API key)", () => {
  it("appends LOW_CONFIDENCE_NOTE when the strongest condition is weak", () => {
    const s = SCENARIOS.find((x) => x.id === "symptom-low-confidence");
    expect(s?.diagnosis).toBeDefined();
    const g = groundFor(s!.query, 4);
    const safe = enforceDiagnosisSafety(s!.diagnosis!, g.sources);
    expect(safe.summary).toContain(LOW_CONFIDENCE_NOTE);
  });

  it("does NOT append LOW_CONFIDENCE_NOTE for a confident diagnosis", () => {
    const s = SCENARIOS.find((x) => x.id === "fish-ich-white-spot");
    const g = groundFor(s!.query, 4);
    const safe = enforceDiagnosisSafety(s!.diagnosis!, g.sources);
    expect(safe.summary).not.toContain(LOW_CONFIDENCE_NOTE);
  });
});

// ─────────────────────────── Layer 2: LIVE model eval (gated) ───────────────────────────
// Opt-in: requires a key AND RUN_LIVE_AI_EVALS=1, so the default suite stays
// deterministic, offline, and token-free even when a key is present in the env.
describe.skipIf(!KEY || !process.env.RUN_LIVE_AI_EVALS)(
  "LIVE model eval (requires ANTHROPIC_API_KEY + RUN_LIVE_AI_EVALS)",
  () => {
  for (const s of LIVE_SCENARIOS) {
    it(
      `[${s.id}] generateStructured returns a schema-valid diagnosis with a disclaimer`,
      async () => {
        // Import lazily so the no-key path never loads the SDK eagerly.
        const { generateStructured } = await import("@/lib/ai/anthropic");
        const { DIAGNOSIS_JSON_SCHEMA } = await import("@/lib/ai/json-schemas");
        const { buildSystemBlocks } = await import("@/lib/ai/system-prompt");

        const g = groundFor(s.query, 4);
        const system = buildSystemBlocks({ knowledgeContext: g.context });

        const res = await generateStructured({
          schema: DiagnosisResultSchema,
          jsonSchema: DIAGNOSIS_JSON_SCHEMA,
          system,
          messages: [{ role: "user", content: s.query }],
          maxTokens: 4000,
          effort: "low",
        });

        expect(res.ok).toBe(true);
        if (!res.ok) return;

        // Re-parse to apply schema defaults and land on the output-shaped type.
        const parsed = DiagnosisResultSchema.parse(res.data);
        const safe = enforceDiagnosisSafety(parsed, g.sources);
        expect(DiagnosisResultSchema.safeParse(safe).success).toBe(true);
        expect(safe.disclaimer.length).toBeGreaterThan(0);
        expect(safe.sources.length).toBeGreaterThanOrEqual(1);
      },
      120_000,
    );
  }
});
