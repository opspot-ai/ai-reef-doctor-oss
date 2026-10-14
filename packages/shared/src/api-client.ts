import {
  DiagnosisResultSchema,
  ParamAnalysisSchema,
  ApiErrorSchema,
} from "./schemas";
import type {
  ChatRequest,
  DiagnoseRequest,
  AnalyzeParamsRequest,
  DiagnosisResult,
  ParamAnalysis,
} from "./types";

/**
 * Typed HTTP client for the AI + commerce server routes .
 * Shared by web & mobile. The web app serves both the UI and the API route
 * handlers under /app/api/*; mobile points `baseUrl` at EXPO_PUBLIC_API_BASE_URL
 * and supplies a `getToken` that returns the Supabase access token.
 *
 * All secrets stay server-side — this client only ever sends a user bearer token.
 */
export interface ApiClientOptions {
  /** Origin of the web app's API routes, e.g. https://example.invalid or http://localhost:3000. */
  baseUrl: string;
  /** Returns the Supabase access token (or null when signed out). May be sync or async. */
  getToken?: () => Promise<string | null> | string | null;
  /** Override fetch (tests / non-global runtimes). Defaults to globalThis.fetch. */
  fetchImpl?: typeof fetch;
}

/** Error thrown for any non-2xx API response, carrying the parsed error envelope. */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly upgradeTo?: string;

  constructor(
    status: number,
    message: string,
    code?: string,
    upgradeTo?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.upgradeTo = upgradeTo;
    // Restore prototype chain for instanceof across transpile targets.
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export interface ApiClient {
  /** POST /api/ai/chat — returns the raw streaming Response (SSE). */
  streamChat(req: ChatRequest): Promise<Response>;
  /** POST /api/ai/diagnose — validated structured diagnosis. */
  diagnose(req: DiagnoseRequest): Promise<DiagnosisResult>;
  /** POST /api/ai/analyze-params — validated parameter analysis. */
  analyzeParams(req: AnalyzeParamsRequest): Promise<ParamAnalysis>;
  /** POST /api/stripe/checkout — creates a Checkout session for a price lookup key. */
  createCheckout(lookupKey: string): Promise<{ url: string }>;
  /** POST /api/stripe/portal — creates a Billing Portal session. */
  createPortal(): Promise<{ url: string }>;
  /**
   * POST /api/account/delete — permanently deletes the signed-in user's account
   * and all personal data. Resolves `{ ok: true }` on success; throws ApiError
   * on a non-OK response. In demo mode the server returns `{ ok: true }` too.
   */
  deleteAccount(): Promise<{ ok: boolean }>;
}

export function createApiClient(opts: ApiClientOptions): ApiClient {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const base = opts.baseUrl.replace(/\/+$/, "");

  async function buildHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (opts.getToken) {
      const token = await opts.getToken();
      if (token) headers["authorization"] = `Bearer ${token}`;
    }
    return headers;
  }

  async function post(path: string, body: unknown): Promise<Response> {
    const headers = await buildHeaders();
    return fetchImpl(`${base}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  }

  /** Parse an error envelope (best-effort) and throw a typed ApiError. */
  async function throwApiError(res: Response): Promise<never> {
    let message = `Request failed with status ${res.status}`;
    let code: string | undefined;
    let upgradeTo: string | undefined;
    try {
      const raw: unknown = await res.json();
      const parsed = ApiErrorSchema.safeParse(raw);
      if (parsed.success) {
        message = parsed.data.error;
        code = parsed.data.code;
        upgradeTo = parsed.data.upgradeTo;
      }
    } catch {
      // Non-JSON / empty body → keep the generic status message.
    }
    throw new ApiError(res.status, message, code, upgradeTo);
  }

  /** POST then validate the JSON body against a zod schema. */
  async function postJson<T>(
    path: string,
    body: unknown,
    schema: { parse: (v: unknown) => T },
  ): Promise<T> {
    const res = await post(path, body);
    if (!res.ok) await throwApiError(res);
    const raw: unknown = await res.json();
    return schema.parse(raw);
  }

  return {
    async streamChat(req: ChatRequest): Promise<Response> {
      const res = await post("/api/ai/chat", req);
      if (!res.ok) await throwApiError(res);
      return res;
    },

    diagnose(req: DiagnoseRequest): Promise<DiagnosisResult> {
      return postJson("/api/ai/diagnose", req, DiagnosisResultSchema);
    },

    analyzeParams(req: AnalyzeParamsRequest): Promise<ParamAnalysis> {
      return postJson(
        "/api/ai/analyze-params",
        req,
        ParamAnalysisSchema,
      );
    },

    createCheckout(lookupKey: string): Promise<{ url: string }> {
      return postJson(
        "/api/stripe/checkout",
        { lookupKey },
        CheckoutResultSchema,
      );
    },

    createPortal(): Promise<{ url: string }> {
      return postJson("/api/stripe/portal", {}, CheckoutResultSchema);
    },

    deleteAccount(): Promise<{ ok: boolean }> {
      return postJson("/api/account/delete", {}, DeleteAccountResultSchema);
    },
  };
}

// Local response shape for the account-delete route. Defined inline (private to
// this client's transport layer) and lenient: any 2xx is treated as success.
const DeleteAccountResultSchema = {
  parse(v: unknown): { ok: boolean } {
    const ok =
      typeof v === "object" &&
      v !== null &&
      "ok" in v &&
      (v as { ok: unknown }).ok === true;
    return { ok };
  },
};

// Local response shape for Stripe URL-returning routes. Defined inline (not in
// the contract roots) since it is private to this client's transport layer.
const CheckoutResultSchema = {
  parse(v: unknown): { url: string } {
    if (
      typeof v === "object" &&
      v !== null &&
      "url" in v &&
      typeof (v as { url: unknown }).url === "string"
    ) {
      return { url: (v as { url: string }).url };
    }
    throw new ApiError(
      0,
      "Malformed response: expected { url: string }",
      "invalid_response",
    );
  },
};
