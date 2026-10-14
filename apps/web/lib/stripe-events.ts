import { tierForLookupKey } from "@reef/shared";
import type { SubStatus, SubTier } from "@reef/shared";

/**
 * PURE mapping helpers for Stripe subscription objects → our `subscriptions`
 * table row shape. No SDK calls, no I/O — so this is trivially unit-testable
 * without the Stripe SDK or a network. The webhook handler builds the minimal
 * typed shape (from the real Stripe event) and feeds it here.
 *
 * NOTE on `current_period_end`: as of Stripe API `2025-03-31.basil` (and the
 * pinned `2026-06-24.synthetic`), `current_period_end`/`current_period_start` were
 * REMOVED from `Subscription` and now live on each `SubscriptionItem`. We read
 * the item value first and fall back to a legacy top-level field for resilience.
 */

/** A Stripe Price as we read it (lookup_key drives the tier mapping). */
export interface MinimalStripePrice {
  id?: string | null;
  lookup_key?: string | null;
}

/** A Stripe SubscriptionItem — carries the period end in current API versions. */
export interface MinimalStripeSubscriptionItem {
  /** Unix seconds. */
  current_period_end?: number | null;
  price?: MinimalStripePrice | null;
}

/** The minimal subset of a Stripe Subscription this module reads. */
export interface MinimalStripeSubscription {
  id: string;
  status: string;
  cancel_at_period_end?: boolean | null;
  /** Unix seconds; null when not trialing. */
  trial_end?: number | null;
  /** Legacy/top-level period end (older API versions). Unix seconds. */
  current_period_end?: number | null;
  items?: {
    data?: MinimalStripeSubscriptionItem[] | null;
  } | null;
}

/** The partial `subscriptions` row this maps to (webhook upserts the rest). */
export interface SubscriptionRow {
  stripe_subscription_id: string;
  status: SubStatus;
  price_id: string | null;
  tier: SubTier;
  current_period_end: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
}

/**
 * Map a raw Stripe subscription status string → our `SubStatus`.
 * Stripe statuses: active, trialing, past_due, canceled, unpaid, incomplete,
 * incomplete_expired, paused. We collapse the unknown/edge ones to a safe
 * `inactive` (no entitlements) so the user never gets paid features for free.
 */
export function mapStripeStatus(status: string): SubStatus {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    case "unpaid":
    case "incomplete":
    case "paused":
    default:
      return "inactive";
  }
}

/** Convert Unix seconds → ISO 8601 string, or null when absent. */
function unixToIso(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined) return null;
  if (!Number.isFinite(seconds)) return null;
  return new Date(seconds * 1000).toISOString();
}

/** The first subscription item, if any (where price + period end now live). */
function firstItem(
  sub: MinimalStripeSubscription,
): MinimalStripeSubscriptionItem | undefined {
  return sub.items?.data?.[0] ?? undefined;
}

/** Read the active Price's lookup_key from the first item, if present. */
function lookupKeyOf(sub: MinimalStripeSubscription): string | null {
  return firstItem(sub)?.price?.lookup_key ?? null;
}

/** Read the active Price's id from the first item, if present. */
function priceIdOf(sub: MinimalStripeSubscription): string | null {
  return firstItem(sub)?.price?.id ?? null;
}

/** Read current_period_end (item first, legacy top-level fallback). */
function periodEndOf(sub: MinimalStripeSubscription): number | null {
  const itemEnd = firstItem(sub)?.current_period_end;
  if (itemEnd !== null && itemEnd !== undefined) return itemEnd;
  return sub.current_period_end ?? null;
}

/**
 * Build the partial `subscriptions` row from a Stripe Subscription.
 * The tier is derived from the Price `lookup_key` via the shared catalog; an
 * unknown/absent lookup_key maps to the `free` tier (never grants paid access).
 */
export function subscriptionRowFromStripeSub(
  sub: MinimalStripeSubscription,
): SubscriptionRow {
  const lookupKey = lookupKeyOf(sub);
  const tier: SubTier =
    lookupKey != null ? (tierForLookupKey(lookupKey) ?? "free") : "free";

  return {
    stripe_subscription_id: sub.id,
    status: mapStripeStatus(sub.status),
    price_id: priceIdOf(sub),
    tier,
    current_period_end: unixToIso(periodEndOf(sub)),
    trial_end: unixToIso(sub.trial_end),
    cancel_at_period_end: sub.cancel_at_period_end === true,
  };
}
