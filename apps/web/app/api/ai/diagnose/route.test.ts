import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DiagnosisResultSchema,
  MEDICAL_DISCLAIMER,
  DOSE_WARNING,
  type DiagnosisResult,
} from "@reef/shared";

// ── Mocks (hoisted above the route import) ──────────────────────────────────

// Auth: getRequestContext returns a configurable user + a recording supabase mock.
const authState: { user: { id: string; email?: string } | null } = {
  user: { id: "11111111-1111-1111-1111-111111111111" },
};
const supabaseInserts: unknown[] = [];
function makeSupabase() {
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.order = () => builder;
  builder.limit = () => builder;
  builder.maybeSingle = async () => ({ data: null, error: null });
  builder.insert = async (values: unknown) => {
    supabaseInserts.push(values);
    return { error: null };
  };
  return { from: () => builder };
}
vi.mock("@/lib/api-auth", () => ({
  getRequestContext: vi.fn(async () => ({
    user: authState.user,
    supabase: makeSupabase(),
  })),
}));

// AI: mock generateStructured + isAiConfigured. No network, no key needed.
const aiState = { configured: true };
const generateStructured = vi.fn((..._args: unknown[]): unknown => undefined);
vi.mock("@/lib/ai/anthropic", () => ({
  isAiConfigured: () => aiState.configured,
  generateStructured: (arg: unknown) => generateStructured(arg),
}));

// Entitlements: mock the photo gate + usage increment.
const gateState: { allowed: boolean; upgradeTo?: string } = { allowed: true };
const incrementUsage = vi.fn(
  async (_userId: string, _field: string): Promise<void> => undefined,
);
vi.mock("@/lib/entitlements-server", () => ({
  enforcePhoto: vi.fn(async () => ({
    allowed: gateState.allowed,
    ...(gateState.upgradeTo ? { upgradeTo: gateState.upgradeTo } : {}),
    entitlements: {},
  })),
  incrementUsage: (userId: string, field: string) =>
    incrementUsage(userId, field),
}));

import { POST } from "./route";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/ai/diagnose", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** A minimal DiagnosisResult the model "returns" (before safety enforcement). */
function modelResult(over: Partial<DiagnosisResult> = {}): DiagnosisResult {
  return {
    summary: "Likely ich based on white spots.",
    conditions: [
      {
        name: "Ich (Cryptocaryon irritans)",
        confidence: 0.8,
        severity: "high",
        evidence: ["white spots on fins"],
        recommendedSteps: ["Quarantine the fish"],
      },
    ],
    urgency: "urgent",
    sources: [],
    disclaimer: "",
    ...over,
  };
}

beforeEach(() => {
  authState.user = { id: "11111111-1111-1111-1111-111111111111" };
  aiState.configured = true;
  gateState.allowed = true;
  delete gateState.upgradeTo;
  supabaseInserts.length = 0;
  generateStructured.mockReset();
  incrementUsage.mockClear();
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe("POST /api/ai/diagnose", () => {
  it("401 when unauthorized", async () => {
    authState.user = null;
    const res = await POST(makeReq({ kind: "fish" }));
    expect(res.status).toBe(401);
    expect(generateStructured).not.toHaveBeenCalled();
  });

  it("503 when AI is not configured", async () => {
    aiState.configured = false;
    const res = await POST(makeReq({ kind: "fish" }));
    expect(res.status).toBe(503);
    const json = (await res.json()) as { code?: string };
    expect(json.code).toBe("not_configured");
    expect(generateStructured).not.toHaveBeenCalled();
  });

  it("400 on an invalid body", async () => {
    const res = await POST(makeReq({ kind: "not-a-kind" }));
    expect(res.status).toBe(400);
    expect(generateStructured).not.toHaveBeenCalled();
  });

  it("402 over the photo cap with upgradeTo", async () => {
    gateState.allowed = false;
    gateState.upgradeTo = "pro";
    const res = await POST(makeReq({ kind: "fish" }));
    expect(res.status).toBe(402);
    const json = (await res.json()) as { code?: string; upgradeTo?: string };
    expect(json.code).toBe("over_limit");
    expect(json.upgradeTo).toBe("pro");
    expect(generateStructured).not.toHaveBeenCalled();
  });

  it("happy path: returns a valid DiagnosisResult and applies safety (disclaimer + sources)", async () => {
    // Model returns NO disclaimer and NO sources; safety must add a disclaimer
    // and fall back to the grounding sources.
    generateStructured.mockResolvedValue({
      ok: true,
      data: modelResult({ disclaimer: "", sources: [] }),
    });

    const res = await POST(makeReq({ kind: "fish", note: "white spots on my tang" }));
    expect(res.status).toBe(200);

    const json = await res.json();
    const d = DiagnosisResultSchema.parse(json);

    // Disclaimer was injected by the safety layer (model returned "").
    expect(d.disclaimer.trim().length).toBeGreaterThan(0);
    expect(d.disclaimer).toBe(MEDICAL_DISCLAIMER);
    // Grounding sources were attached (the RAG corpus matches "fish disease").
    expect(d.sources.length).toBeGreaterThan(0);
    expect(d.sources[0]).toHaveProperty("title");
    expect(d.sources[0]).toHaveProperty("ref");

    // Usage was incremented for photo_diagnoses, and a diagnoses row persisted.
    expect(incrementUsage).toHaveBeenCalledWith(
      "11111111-1111-1111-1111-111111111111",
      "photo_diagnoses",
    );
    expect(supabaseInserts.length).toBe(1);
  });

  it("sends an image content block when imageBase64 is present", async () => {
    generateStructured.mockResolvedValue({ ok: true, data: modelResult() });
    await POST(
      makeReq({ kind: "coral", imageBase64: "AAAA", imageMediaType: "image/png" }),
    );

    expect(generateStructured).toHaveBeenCalledTimes(1);
    const call = generateStructured.mock.calls[0]![0] as {
      messages: { role: string; content: unknown[] }[];
      effort?: string;
      maxTokens?: number;
    };
    const content = call.messages[0]!.content as Array<Record<string, unknown>>;
    const image = content.find((b) => b.type === "image") as
      | { source: { type: string; media_type: string; data: string } }
      | undefined;
    expect(image).toBeDefined();
    expect(image!.source).toMatchObject({
      type: "base64",
      media_type: "image/png",
      data: "AAAA",
    });
    expect(call.effort).toBe("high");
    expect(call.maxTokens).toBe(16000);
  });

  it("refusal returns the safe fallback object (200)", async () => {
    generateStructured.mockResolvedValue({ ok: false, refusal: "no" });

    const res = await POST(makeReq({ kind: "fish" }));
    expect(res.status).toBe(200);
    const d = DiagnosisResultSchema.parse(await res.json());
    expect(d.disclaimer).toBe(MEDICAL_DISCLAIMER);
    expect(d.conditions).toEqual([]);
    expect(d.urgency).toBe("routine");
    // Fallback path does not increment usage / persist.
    expect(incrementUsage).not.toHaveBeenCalled();
    expect(supabaseInserts.length).toBe(0);
  });

  it("model error returns the safe fallback object (200)", async () => {
    generateStructured.mockRejectedValue(new Error("boom"));

    const res = await POST(makeReq({ kind: "fish" }));
    expect(res.status).toBe(200);
    const d = DiagnosisResultSchema.parse(await res.json());
    expect(d.disclaimer).toBe(MEDICAL_DISCLAIMER);
    expect(d.conditions).toEqual([]);
    expect(incrementUsage).not.toHaveBeenCalled();
  });

  it("a copper-dose step yields a dose warning (safety enforced)", async () => {
    generateStructured.mockResolvedValue({
      ok: true,
      data: modelResult({
        conditions: [
          {
            name: "Marine velvet",
            confidence: 0.7,
            severity: "critical",
            evidence: ["gold dusting"],
            recommendedSteps: ["Dose copper to 2.0 ppm in a quarantine tank"],
          },
        ],
        doseWarnings: undefined,
      }),
    });

    const res = await POST(makeReq({ kind: "fish" }));
    expect(res.status).toBe(200);
    const d = DiagnosisResultSchema.parse(await res.json());
    expect(d.doseWarnings).toBeDefined();
    expect(d.doseWarnings).toContain(DOSE_WARNING);
  });
});
