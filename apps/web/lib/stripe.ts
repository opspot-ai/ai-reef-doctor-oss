import Stripe from "stripe";
import { serverEnv } from "@/lib/env";

/**
 * Lazy, server-only Stripe client (TEST mode). The API version is pinned to the
 * version bundled with the installed SDK so request/response shapes are stable.
 *
 * Callers MUST guard with `features.stripe` first and return
 * `ApiErrors.notConfigured(...)` when Stripe is not configured — this throws a
 * clear error only as a last-resort safety net (e.g. a misconfigured caller).
 *
 * NEVER import this from a client component: it reads `serverEnv.stripeSecretKey`.
 */

/** Pinned to match the SDK's bundled OpenAPI spec (stripe-node v22 → synthetic). */
export const STRIPE_API_VERSION = "2026-06-24.synthetic" as const;

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;

  const key = serverEnv.stripeSecretKey;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not configured. Guard callers with `features.stripe` " +
        "and return ApiErrors.notConfigured('Billing') before calling getStripe().",
    );
  }

  cached = new Stripe(key, {
    // Matches the SDK's pinned `LatestApiVersion` literal exactly.
    apiVersion: STRIPE_API_VERSION,
    appInfo: { name: "AI Reef Doctor", url: "https://example.invalid" },
    typescript: true,
  });
  return cached;
}
