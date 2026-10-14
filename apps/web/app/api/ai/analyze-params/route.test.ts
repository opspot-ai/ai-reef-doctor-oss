import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MEDICAL_DISCLAIMER,
  ParamAnalysisSchema,
  type Entitlements,
  type ParamAnalysis,
} from "@reef/shared";

// ─────────────────────────── mocks ───────────────────────────
// Auth: control the resolved user/supabase per test.
const getRequestContext = vi.fn();
vi.mock("@/lib/api-auth", () => ({
  getRequestContext: (req: Request) => getRequestContext(req),
}));

// Anthropic wrapper: NEVER hit the network. Control config + structured output.
const isAiConfigured = vi.fn();
const generateStructured = vi.fn();
vi.mock("@/lib/ai/anthropic", () => ({
  isAiConfigured: () => isAiConfigured(),
  generateStructured: (opts: unknown) => generateStructured(opts),
}));

// Entitlements: control the caller's tier.
const getUserEntitlements = vi.fn();
vi.mock("@/lib/entitlements-server", () => ({
  getUserEntitlements: (supabase: unknown, userId: string) =>
    getUserEntitlements(supabase, userId),
}));

// Import the route AFTER the mocks are registered.
import { POST } from "./route";

// ─────────────────────────── helpers ───────────────────────────
const SUPABASE = { __scoped: true };

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/ai/analyze-params", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function entitlements(tier: "free" | "pro" | "premium"): Entitlements {
  return {
    tier,
    active: tier !== "free",
    maxTanks: tier === "free" ? 1 : 5,
    aiChatsPerMonth: tier === "free" ? 5 : Infinity,
    photoDiagnosesPerMonth: tier === "free" ? 1 : Infinity,
    model: "claude-opus-4-8",
    capabilities: {} as Entitlements["capabilities"],
  };
}

const VALID_BODY = {
  tankId: "11111111-1111-1111-1111-111111111111",
  tankType: "mixed" as const,
  parameters: [
    {
      measured_at: "2026-06-01T00:00:00.000Z",
      alkalinity_dkh: 8.5,
      calcium_ppm: 420,
      nitrate_ppm: 10,
      source: "manual" as const,
    },
    {
      measured_at: "2026-06-20T00:00:00.000Z",
      alkalinity_dkh: 12.5, // out of range high
      calcium_ppm: 420,
      nitrate_ppm: 60, // out of range high for mixed
      source: "manual" as const,
    },
  ],
};

// A valid model ParamAnalysis (without disclaimer/sources to prove the safety
// layer fills them deterministically).
const MODEL_OUTPUT: ParamAnalysis = {
  summary: "Alkalinity and nitrate are trending high.",
  findings: [
    { parameter: "alkalinity_dkh", status: "high", message: "Above target." },
    { parameter: "nitrate_ppm", status: "high", message: "Reduce feeding." },
  ],
  recommendations: ["Cut dosing", "Increase water changes"],
  sources: [],
  disclaimer: "",
};

beforeEach(() => {
  // Default happy-path wiring; individual tests override as needed.
  getRequestContext.mockResolvedValue({
    user: { id: "user-123" },
    supabase: SUPABASE,
  });
  isAiConfigured.mockReturnValue(true);
  getUserEntitlements.mockResolvedValue(entitlements("pro"));
  generateStructured.mockResolvedValue({ ok: true, data: MODEL_OUTPUT });
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────── tests ───────────────────────────
describe("POST /api/ai/analyze-params", () => {
  it("returns 401 when there is no authenticated user", async () => {
    getRequestContext.mockResolvedValue({ user: null, supabase: SUPABASE });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.code).toBe("unauthorized");
    // Must not even reach the model.
    expect(generateStructured).not.toHaveBeenCalled();
  });

  it("returns 503 not-configured when ANTHROPIC_API_KEY is absent", async () => {
    isAiConfigured.mockReturnValue(false);

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.code).toBe("not_configured");
    expect(generateStructured).not.toHaveBeenCalled();
  });

  it("returns 400 on an invalid request body", async () => {
    const res = await POST(makeRequest({ tankId: "not-a-uuid", parameters: [] }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("bad_request");
    expect(generateStructured).not.toHaveBeenCalled();
  });

  it("returns 402 upgrade-to pro for free-tier callers", async () => {
    getUserEntitlements.mockResolvedValue(entitlements("free"));

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(402);
    const json = await res.json();
    expect(json.code).toBe("over_limit");
    expect(json.upgradeTo).toBe("pro");
    expect(json.error).toMatch(/Reef Keeper/i);
    // Free tier never invokes the model.
    expect(generateStructured).not.toHaveBeenCalled();
  });

  it("pro happy path returns a ParamAnalysis with disclaimer + findings", async () => {
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);

    const json = await res.json();
    // Conforms to the shared schema.
    const validated = ParamAnalysisSchema.safeParse(json);
    expect(validated.success).toBe(true);

    const data = json as ParamAnalysis;
    // Safety layer filled the missing disclaimer deterministically.
    expect(data.disclaimer).toBe(MEDICAL_DISCLAIMER);
    expect(data.findings.length).toBeGreaterThan(0);
    // Model returned no sources → grounding sources are injected.
    expect(Array.isArray(data.sources)).toBe(true);
    expect(data.sources.length).toBeGreaterThan(0);
    for (const s of data.sources) {
      expect(typeof s.title).toBe("string");
      expect(typeof s.ref).toBe("string");
    }

    // The model was actually called with high effort + the param schema.
    expect(generateStructured).toHaveBeenCalledTimes(1);
    const callArg = generateStructured.mock.calls[0]![0] as {
      effort: string;
      schema: unknown;
    };
    expect(callArg.effort).toBe("high");
    expect(callArg.schema).toBe(ParamAnalysisSchema);
  });

  it("returns a safe fallback when the model refuses", async () => {
    generateStructured.mockResolvedValue({ ok: false, refusal: "declined" });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);

    const json = await res.json();
    const validated = ParamAnalysisSchema.safeParse(json);
    expect(validated.success).toBe(true);

    const data = json as ParamAnalysis;
    expect(data.disclaimer).toBe(MEDICAL_DISCLAIMER);
    expect(data.findings).toEqual([]);
    expect(data.summary).toMatch(/couldn't analyze/i);
  });

  it("returns a safe fallback when the model call throws", async () => {
    generateStructured.mockRejectedValue(new Error("boom"));

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);

    const json = await res.json();
    const validated = ParamAnalysisSchema.safeParse(json);
    expect(validated.success).toBe(true);
    expect((json as ParamAnalysis).disclaimer).toBe(MEDICAL_DISCLAIMER);
  });
});
