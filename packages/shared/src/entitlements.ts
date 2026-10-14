import type {
  AiModelId,
  Capability,
  Entitlements,
  Subscription,
  SubTier,
} from "./types";
import { TIERS } from "./tiers";

/**
 * Entitlements — single source of truth .
 *
 * Derived server-side from `subscriptions.tier` (+ status active/trialing);
 * clients only render. `canUse` + the `check*Usage` gates protect every server
 * AI/feature call. Over a cap → HTTP 402 `{ error, upgradeTo }`.
 *
 * Model tiering is OFF by default (/): all tiers resolve to
 * `claude-opus-4-8` until the owner opts in.
 */

const DEFAULT_MODEL: AiModelId = "claude-opus-4-8";

/** Build a fully-specified capability map from the truthy capabilities. */
function caps(enabled: Capability[]): Record<Capability, boolean> {
  return {
    photoDiagnosis: enabled.includes("photoDiagnosis"),
    dosingCalculators: enabled.includes("dosingCalculators"),
    treatmentProtocols: enabled.includes("treatmentProtocols"),
    symptomChecker: enabled.includes("symptomChecker"),
    maintenancePlans: enabled.includes("maintenancePlans"),
    reminders: enabled.includes("reminders"),
    weeklyReports: enabled.includes("weeklyReports"),
    predictiveForecasting: enabled.includes("predictiveForecasting"),
    advancedAnalytics: enabled.includes("advancedAnalytics"),
    controllerIntegrations: enabled.includes("controllerIntegrations"),
    prioritySupport: enabled.includes("prioritySupport"),
  };
}

const PRO_CAPABILITIES: Capability[] = [
  "photoDiagnosis",
  "dosingCalculators",
  "treatmentProtocols",
  "symptomChecker",
  "maintenancePlans",
  "reminders",
  "weeklyReports",
];

const PREMIUM_CAPABILITIES: Capability[] = [
  ...PRO_CAPABILITIES,
  "predictiveForecasting",
  "advancedAnalytics",
  "controllerIntegrations",
  "prioritySupport",
];

/**
 * The  table. `active` here is the base-template default (false);
 * `getEntitlements` stamps the real value from the subscription status.
 */
export const ENTITLEMENTS: Record<SubTier, Entitlements> = {
  free: {
    tier: "free",
    active: false,
    maxTanks: 1,
    aiChatsPerMonth: 5,
    // Free gets a single trial photo diagnosis via the cap COUNT, but the
    // photoDiagnosis CAPABILITY is false (no ongoing feature access).
    photoDiagnosesPerMonth: 1,
    model: DEFAULT_MODEL,
    capabilities: caps([]),
  },
  pro: {
    tier: "pro",
    active: false,
    maxTanks: 5,
    aiChatsPerMonth: Infinity,
    photoDiagnosesPerMonth: Infinity,
    model: DEFAULT_MODEL,
    capabilities: caps(PRO_CAPABILITIES),
  },
  premium: {
    tier: "premium",
    active: false,
    maxTanks: Infinity,
    aiChatsPerMonth: Infinity,
    photoDiagnosesPerMonth: Infinity,
    model: DEFAULT_MODEL,
    capabilities: caps(PREMIUM_CAPABILITIES),
  },
};

/** A subscription confers its tier only while active or trialing. */
function isActiveStatus(sub: Subscription | null): boolean {
  return sub != null && (sub.status === "active" || sub.status === "trialing");
}

/**
 * The effective tier for a subscription: the subscription's tier only when the
 * status is active/trialing, otherwise `free`.
 */
export function resolveTier(sub: Subscription | null): SubTier {
  return isActiveStatus(sub) && sub != null ? sub.tier : "free";
}

/**
 * The effective entitlements for a subscription. Returns a fresh deep copy so
 * callers can never mutate the ENTITLEMENTS source table. `active` reflects
 * whether the subscription status is active/trialing.
 */
export function getEntitlements(sub: Subscription | null): Entitlements {
  const tier = resolveTier(sub);
  const base = ENTITLEMENTS[tier];
  return {
    tier: base.tier,
    active: isActiveStatus(sub),
    maxTanks: base.maxTanks,
    aiChatsPerMonth: base.aiChatsPerMonth,
    photoDiagnosesPerMonth: base.photoDiagnosesPerMonth,
    model: base.model,
    capabilities: { ...base.capabilities },
  };
}

/** Whether a tier unlocks a given capability. */
export function canUse(ent: Entitlements, cap: Capability): boolean {
  return ent.capabilities[cap] === true;
}

/** Suggested upgrade target from a given tier, or undefined if at the top. */
function nextTier(tier: SubTier): SubTier | undefined {
  if (tier === "free") return "pro";
  if (tier === "pro") return "premium";
  return undefined;
}

interface LimitCheck {
  allowed: boolean;
  upgradeTo?: SubTier;
}

/** Shared gate: is `used` below `limit`? Infinity never blocks. */
function gate(limit: number, used: number, tier: SubTier): LimitCheck {
  if (used < limit) return { allowed: true };
  const upgradeTo = nextTier(tier);
  return upgradeTo === undefined
    ? { allowed: false }
    : { allowed: false, upgradeTo };
}

/** Can the user create another tank given their current count? */
export function checkTankLimit(
  ent: Entitlements,
  currentCount: number,
): LimitCheck {
  return gate(ent.maxTanks, currentCount, ent.tier);
}

/** Can the user start another AI chat this month? */
export function checkChatUsage(
  ent: Entitlements,
  usedThisMonth: number,
): LimitCheck {
  return gate(ent.aiChatsPerMonth, usedThisMonth, ent.tier);
}

/** Can the user run another photo diagnosis this month? */
export function checkPhotoUsage(
  ent: Entitlements,
  usedThisMonth: number,
): LimitCheck {
  return gate(ent.photoDiagnosesPerMonth, usedThisMonth, ent.tier);
}

// Drift guard: every tier in the catalog (TIERS) must have entitlements here.
// The catalog owns names/prices; this module owns caps/capabilities — keep the
// tier sets identical so neither source of truth silently outgrows the other.
for (const tier of Object.keys(TIERS) as SubTier[]) {
  if (ENTITLEMENTS[tier] === undefined) {
    throw new Error(`entitlements: missing entry for tier "${tier}"`);
  }
}
