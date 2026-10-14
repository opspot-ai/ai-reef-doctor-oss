import { NextResponse } from "next/server";
import type { SubTier } from "@reef/shared";

/** JSON success response. */
export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

/** JSON error matching the shared ApiErrorSchema envelope { error, code?, upgradeTo? }. */
export function jsonError(
  status: number,
  error: string,
  opts?: { code?: string; upgradeTo?: SubTier },
) {
  return NextResponse.json(
    {
      error,
      ...(opts?.code ? { code: opts.code } : {}),
      ...(opts?.upgradeTo ? { upgradeTo: opts.upgradeTo } : {}),
    },
    { status },
  );
}

export const ApiErrors = {
  unauthorized: () => jsonError(401, "You must be signed in.", { code: "unauthorized" }),
  notConfigured: (what: string) =>
    jsonError(503, `${what} is not configured yet (owner must add credentials).`, {
      code: "not_configured",
    }),
  badRequest: (msg = "Invalid request.") => jsonError(400, msg, { code: "bad_request" }),
  overLimit: (msg: string, upgradeTo?: SubTier) =>
    jsonError(402, msg, { code: "over_limit", upgradeTo }),
  serverError: (msg = "Something went wrong.") =>
    jsonError(500, msg, { code: "server_error" }),
};
