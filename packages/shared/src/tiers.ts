import type { SubTier } from "./types";

/**
 * Tier catalog — source of truth for the Stripe seed script and the pricing UI.
 * Prices are PLACEHOLDERS (pricing placeholder). `lookupKey` is the stable Stripe
 * Price lookup_key the webhook/seed map to a tier.
 */
export interface TierPrice {
  interval: "month" | "year";
  /** USD cents — PLACEHOLDER pricing, owner confirms . */
  amount: number;
  lookupKey: string;
}

export interface TierDef {
  id: SubTier;
  name: string;
  tagline: string;
  /** marketing bullet list */
  features: string[];
  trialDays: number;
  prices: TierPrice[]; // empty for the free tier
}

export const TIERS: Record<SubTier, TierDef> = {
  free: {
    id: "free",
    name: "Tide Pool",
    tagline: "Start your reef journey",
    trialDays: 0,
    prices: [],
    features: [
      "1 tank",
      "5 AI Doctor chats / month",
      "Parameter logging + trend charts",
      "Nitrogen cycle tracker",
      "Species care encyclopedia",
      "1 trial photo diagnosis",
    ],
  },
  pro: {
    id: "pro",
    name: "Reef Keeper",
    tagline: "For the dedicated hobbyist",
    trialDays: 7,
    prices: [
      { interval: "month", amount: 999, lookupKey: "reef_keeper_monthly" },
      { interval: "year", amount: 9900, lookupKey: "reef_keeper_yearly" },
    ],
    features: [
      "Up to 5 tanks",
      "Unlimited AI Doctor chat",
      "Photo diagnosis: fish, coral & algae",
      "Dosing & treatment calculators",
      "Guided symptom checker",
      "Maintenance plans + reminders",
      "Weekly AI tank health reports",
    ],
  },
  premium: {
    id: "premium",
    name: "Reef Master",
    tagline: "Maximum capability for advanced reefers",
    trialDays: 7,
    prices: [
      { interval: "month", amount: 1999, lookupKey: "reef_master_monthly" },
      { interval: "year", amount: 19900, lookupKey: "reef_master_yearly" },
    ],
    features: [
      "Everything in Reef Keeper",
      "Unlimited tanks",
      "Highest-capability AI model",
      "Unlimited photo diagnosis",
      "Predictive drift & consumption forecasting",
      "Advanced analytics",
      "Controller integrations (when available)",
      "Priority support",
    ],
  },
};

export const PAID_TIERS: SubTier[] = ["pro", "premium"];

/** Map a Stripe Price lookup_key → tier (used by seed + webhook). */
export function tierForLookupKey(lookupKey: string): SubTier | null {
  for (const tier of Object.values(TIERS)) {
    if (tier.prices.some((p) => p.lookupKey === lookupKey)) return tier.id;
  }
  return null;
}

export function formatPrice(amountCents: number): string {
  return `$${(amountCents / 100).toFixed(amountCents % 100 === 0 ? 0 : 2)}`;
}
