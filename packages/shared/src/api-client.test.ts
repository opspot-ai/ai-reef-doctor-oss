import { createApiClient, ApiError } from "./api-client";
import type {
  ChatRequest,
  DiagnoseRequest,
  AnalyzeParamsRequest,
  DiagnosisResult,
  ParamAnalysis,
} from "./types";

const BASE = "https://example.invalid";
const TANK_ID = "00000000-0000-4000-8000-000000000099";

/** Build a minimal Response-like value with a json/text/ok surface. */
function jsonResponse(
  body: unknown,
  init: { status?: number; ok?: boolean } = {},
): Response {
  const status = init.status ?? 200;
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new Response(text, {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** A fetch mock that records the last call and returns a queued response. */
function makeFetch(response: Response) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fn = ((url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return Promise.resolve(response);
  }) as unknown as typeof fetch;
  return { fn, calls };
}

function headerValue(init: RequestInit, name: string): string | null {
  const h = new Headers(init.headers);
  return h.get(name);
}

const VALID_DIAGNOSIS: DiagnosisResult = {
  summary: "Likely marine ich (Cryptocaryon irritans).",
  conditions: [
    {
      name: "Marine ich",
      confidence: 0.72,
      severity: "high",
      evidence: ["White spots on fins", "Flashing behavior"],
      recommendedSteps: ["Quarantine", "Hyposalinity or copper treatment"],
    },
  ],
  urgency: "urgent",
  sources: [{ title: "Disease guide: ich", ref: "kb:ich-001" }],
  disclaimer: "Educational guidance only.",
};

const VALID_PARAM_ANALYSIS: ParamAnalysis = {
  summary: "Alkalinity is trending low.",
  findings: [
    { parameter: "alkalinity_dkh", status: "low", message: "Below target." },
  ],
  recommendations: ["Increase alkalinity dosing gradually."],
  sources: [],
  disclaimer: "Educational guidance only.",
};

describe("createApiClient", () => {
  describe("streamChat", () => {
    const req: ChatRequest = {
      tankId: TANK_ID,
      messages: [{ role: "user", content: "Why is my coral pale?" }],
    };

    it("POSTs JSON to /api/ai/chat and returns the raw Response", async () => {
      const res = jsonResponse("data: hello\n\n");
      const { fn, calls } = makeFetch(res);
      const client = createApiClient({ baseUrl: BASE, fetchImpl: fn });

      const out = await client.streamChat(req);

      expect(out).toBe(res);
      expect(calls).toHaveLength(1);
      const call = calls[0]!;
      expect(call.url).toBe(`${BASE}/api/ai/chat`);
      expect(call.init.method).toBe("POST");
      expect(headerValue(call.init, "content-type")).toBe("application/json");
      expect(JSON.parse(call.init.body as string)).toEqual(req);
    });

    it("does not consume/parse the body (returns Response unread)", async () => {
      const res = jsonResponse("data: stream\n\n");
      const { fn } = makeFetch(res);
      const client = createApiClient({ baseUrl: BASE, fetchImpl: fn });
      const out = await client.streamChat(req);
      expect(out.bodyUsed).toBe(false);
    });

    it("throws ApiError on a non-OK response", async () => {
      const res = jsonResponse(
        { error: "Internal error", code: "server_error" },
        { status: 500 },
      );
      const { fn } = makeFetch(res);
      const client = createApiClient({ baseUrl: BASE, fetchImpl: fn });

      await expect(client.streamChat(req)).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe("diagnose", () => {
    const req: DiagnoseRequest = { tankId: TANK_ID, kind: "fish", note: "spots" };

    it("POSTs to /api/ai/diagnose and returns a validated DiagnosisResult", async () => {
      const res = jsonResponse(VALID_DIAGNOSIS);
      const { fn, calls } = makeFetch(res);
      const client = createApiClient({ baseUrl: BASE, fetchImpl: fn });

      const out = await client.diagnose(req);

      const call = calls[0]!;
      expect(call.url).toBe(`${BASE}/api/ai/diagnose`);
      expect(call.init.method).toBe("POST");
      expect(headerValue(call.init, "content-type")).toBe("application/json");
      expect(JSON.parse(call.init.body as string)).toEqual(req);
      expect(out.summary).toBe(VALID_DIAGNOSIS.summary);
      expect(out.conditions[0]!.name).toBe("Marine ich");
      expect(out.urgency).toBe("urgent");
    });

    it("throws when the server returns a body failing DiagnosisResultSchema", async () => {
      const res = jsonResponse({ summary: "missing fields" });
      const { fn } = makeFetch(res);
      const client = createApiClient({ baseUrl: BASE, fetchImpl: fn });
      await expect(client.diagnose(req)).rejects.toBeTruthy();
    });
  });

  describe("analyzeParams", () => {
    const req: AnalyzeParamsRequest = {
      tankId: TANK_ID,
      parameters: [{ alkalinity_dkh: 6.5, source: "manual" }],
    };

    it("POSTs to /api/ai/analyze-params and returns a validated ParamAnalysis", async () => {
      const res = jsonResponse(VALID_PARAM_ANALYSIS);
      const { fn, calls } = makeFetch(res);
      const client = createApiClient({ baseUrl: BASE, fetchImpl: fn });

      const out = await client.analyzeParams(req);

      const call = calls[0]!;
      expect(call.url).toBe(`${BASE}/api/ai/analyze-params`);
      expect(call.init.method).toBe("POST");
      expect(JSON.parse(call.init.body as string)).toEqual(req);
      expect(out.summary).toBe(VALID_PARAM_ANALYSIS.summary);
      expect(out.findings[0]!.status).toBe("low");
    });

    it("throws when the analysis body is invalid", async () => {
      const res = jsonResponse({ findings: "not-an-array" });
      const { fn } = makeFetch(res);
      const client = createApiClient({ baseUrl: BASE, fetchImpl: fn });
      await expect(client.analyzeParams(req)).rejects.toBeTruthy();
    });
  });

  describe("createCheckout", () => {
    it("POSTs the lookupKey to /api/stripe/checkout and returns { url }", async () => {
      const res = jsonResponse({ url: "https://example.invalid" });
      const { fn, calls } = makeFetch(res);
      const client = createApiClient({ baseUrl: BASE, fetchImpl: fn });

      const out = await client.createCheckout("reef_keeper_monthly");

      const call = calls[0]!;
      expect(call.url).toBe(`${BASE}/api/stripe/checkout`);
      expect(call.init.method).toBe("POST");
      expect(headerValue(call.init, "content-type")).toBe("application/json");
      expect(JSON.parse(call.init.body as string)).toEqual({
        lookupKey: "reef_keeper_monthly",
      });
      expect(out).toEqual({ url: "https://example.invalid" });
    });

    it("throws ApiError on non-OK", async () => {
      const res = jsonResponse({ error: "no such price" }, { status: 400 });
      const { fn } = makeFetch(res);
      const client = createApiClient({ baseUrl: BASE, fetchImpl: fn });
      await expect(
        client.createCheckout("bogus"),
      ).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe("createPortal", () => {
    it("POSTs to /api/stripe/portal and returns { url }", async () => {
      const res = jsonResponse({ url: "https://example.invalid" });
      const { fn, calls } = makeFetch(res);
      const client = createApiClient({ baseUrl: BASE, fetchImpl: fn });

      const out = await client.createPortal();

      const call = calls[0]!;
      expect(call.url).toBe(`${BASE}/api/stripe/portal`);
      expect(call.init.method).toBe("POST");
      expect(out).toEqual({ url: "https://example.invalid" });
    });
  });

  describe("Authorization header", () => {
    const req: DiagnoseRequest = { tankId: TANK_ID, kind: "fish" };

    it("is set to Bearer <token> when getToken returns a token", async () => {
      const res = jsonResponse(VALID_DIAGNOSIS);
      const { fn, calls } = makeFetch(res);
      const client = createApiClient({
        baseUrl: BASE,
        fetchImpl: fn,
        getToken: () => "tok-abc",
      });

      await client.diagnose(req);

      expect(headerValue(calls[0]!.init, "authorization")).toBe("Bearer tok-abc");
    });

    it("supports an async getToken", async () => {
      const res = jsonResponse(VALID_DIAGNOSIS);
      const { fn, calls } = makeFetch(res);
      const client = createApiClient({
        baseUrl: BASE,
        fetchImpl: fn,
        getToken: async () => "tok-async",
      });

      await client.diagnose(req);

      expect(headerValue(calls[0]!.init, "authorization")).toBe(
        "Bearer tok-async",
      );
    });

    it("is omitted when no getToken is provided", async () => {
      const res = jsonResponse(VALID_DIAGNOSIS);
      const { fn, calls } = makeFetch(res);
      const client = createApiClient({ baseUrl: BASE, fetchImpl: fn });

      await client.diagnose(req);

      expect(headerValue(calls[0]!.init, "authorization")).toBeNull();
    });

    it("is omitted when getToken resolves to null", async () => {
      const res = jsonResponse(VALID_DIAGNOSIS);
      const { fn, calls } = makeFetch(res);
      const client = createApiClient({
        baseUrl: BASE,
        fetchImpl: fn,
        getToken: () => null,
      });

      await client.diagnose(req);

      expect(headerValue(calls[0]!.init, "authorization")).toBeNull();
    });
  });

  describe("error handling", () => {
    it("a 402 over-cap response throws ApiError with status, code, upgradeTo", async () => {
      const res = jsonResponse(
        {
          error: "Monthly chat limit reached",
          code: "over_cap",
          upgradeTo: "pro",
        },
        { status: 402 },
      );
      const { fn } = makeFetch(res);
      const client = createApiClient({ baseUrl: BASE, fetchImpl: fn });

      const err = await client
        .streamChat({ messages: [{ role: "user", content: "hi" }] })
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(402);
      expect(apiErr.code).toBe("over_cap");
      expect(apiErr.upgradeTo).toBe("pro");
      expect(apiErr.message).toBe("Monthly chat limit reached");
    });

    it("a 500 throws ApiError carrying the status", async () => {
      const res = jsonResponse(
        { error: "boom", code: "server_error" },
        { status: 500 },
      );
      const { fn } = makeFetch(res);
      const client = createApiClient({ baseUrl: BASE, fetchImpl: fn });

      const err = await client.createPortal().catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(500);
      expect(apiErr.code).toBe("server_error");
      expect(apiErr.upgradeTo).toBeUndefined();
    });

    it("falls back to a generic message when the error body is not valid JSON", async () => {
      const res = new Response("<html>502 Bad Gateway</html>", {
        status: 502,
        headers: { "content-type": "text/html" },
      });
      const { fn } = makeFetch(res);
      const client = createApiClient({ baseUrl: BASE, fetchImpl: fn });

      const err = await client.createPortal().catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(502);
      expect(typeof apiErr.message).toBe("string");
      expect(apiErr.message.length).toBeGreaterThan(0);
    });

    it("ApiError is a real Error with name 'ApiError'", () => {
      const e = new ApiError(404, "missing", "not_found");
      expect(e).toBeInstanceOf(Error);
      expect(e.name).toBe("ApiError");
      expect(e.status).toBe(404);
      expect(e.code).toBe("not_found");
    });
  });

  describe("baseUrl handling", () => {
    it("trims a trailing slash on baseUrl so paths are not doubled", async () => {
      const res = jsonResponse({ url: "u" });
      const { fn, calls } = makeFetch(res);
      const client = createApiClient({
        baseUrl: `${BASE}/`,
        fetchImpl: fn,
      });
      await client.createPortal();
      expect(calls[0]!.url).toBe(`${BASE}/api/stripe/portal`);
    });

    it("uses globalThis.fetch when no fetchImpl is provided", async () => {
      const original = globalThis.fetch;
      const res = jsonResponse({ url: "u" });
      const calls: string[] = [];
      globalThis.fetch = ((url: string | URL | Request) => {
        calls.push(String(url));
        return Promise.resolve(res);
      }) as unknown as typeof fetch;
      try {
        const client = createApiClient({ baseUrl: BASE });
        const out = await client.createPortal();
        expect(out).toEqual({ url: "u" });
        expect(calls[0]).toBe(`${BASE}/api/stripe/portal`);
      } finally {
        globalThis.fetch = original;
      }
    });
  });
});
