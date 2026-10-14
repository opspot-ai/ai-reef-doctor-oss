/**
 * @reef/shared — single source of truth for types, schemas, entitlements,
 * dosing math, reef knowledge, and the typed API client (web + mobile).
 */
export const SHARED_PACKAGE = "@reef/shared" as const;

export * from "./schemas";
export * from "./types";
export * from "./tiers";
export * from "./disclaimers";
export * from "./entitlements";
export * from "./dosing";
export * from "./params";
export * from "./reef-knowledge";
export * from "./api-client";
