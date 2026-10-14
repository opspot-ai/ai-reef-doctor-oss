import { describe, it, expect } from "vitest";
import {
  mapStripeStatus,
  subscriptionRowFromStripeSub,
  type MinimalStripeSubscription,
} from "@/lib/stripe-events";

/**
 * Fixed instants (Unix seconds) so ISO conversion is deterministic.
 *   PERIOD_END  → 2026-07-24T00:00:00.000Z
 *   TRIAL_END   → 2026-07-01T00:00:00.000Z
 */
const PERIOD_END = Math.floor(Date.UTC(2026, 6, 24, 0, 0, 0) / 1000);
const TRIAL_END = Math.floor(Date.UTC(2026, 6, 1, 0, 0, 0) / 1000);

/** Build a minimal Stripe subscription fixture (current API item shape). */
function sub(
  overrides: Partial<MinimalStripeSubscription> & {
    lookupKey?: string | null;
    priceId?: string | null;
    itemPeriodEnd?: number | null;
  } = {},
): MinimalStripeSubscription {
  const {
    lookupKey = "reef_keeper_monthly",
    priceId = "price_123",
    itemPeriodEnd = PERIOD_END,
    ...rest
  } = overrides;
  return {
    id: "sub_test_1",
    status: "active",
    cancel_at_period_end: false,
    trial_end: null,
    items: {
      data: [
        {
          current_period_end: itemPeriodEnd,
          price: { id: priceId, lookup_key: lookupKey },
        },
      ],
    },
    ...rest,
  };
}

describe("mapStripeStatus", () => {
  it("passes through the recognized statuses", () => {
    expect(mapStripeStatus("active")).toBe("active");
    expect(mapStripeStatus("trialing")).toBe("trialing");
    expect(mapStripeStatus("past_due")).toBe("past_due");
    expect(mapStripeStatus("canceled")).toBe("canceled");
  });

  it("maps incomplete_expired to canceled", () => {
    expect(mapStripeStatus("incomplete_expired")).toBe("canceled");
  });

  it("collapses unknown/edge statuses to inactive (no paid access)", () => {
    expect(mapStripeStatus("unpaid")).toBe("inactive");
    expect(mapStripeStatus("incomplete")).toBe("inactive");
    expect(mapStripeStatus("paused")).toBe("inactive");
    expect(mapStripeStatus("something_new")).toBe("inactive");
  });
});

describe("subscriptionRowFromStripeSub", () => {
  it("active sub on reef_keeper_monthly → tier 'pro' status 'active'", () => {
    const row = subscriptionRowFromStripeSub(
      sub({ lookupKey: "reef_keeper_monthly", status: "active" }),
    );
    expect(row.tier).toBe("pro");
    expect(row.status).toBe("active");
    expect(row.stripe_subscription_id).toBe("sub_test_1");
    expect(row.price_id).toBe("price_123");
    expect(row.cancel_at_period_end).toBe(false);
  });

  it("trialing reef_master_yearly → tier 'premium' status 'trialing'", () => {
    const row = subscriptionRowFromStripeSub(
      sub({
        lookupKey: "reef_master_yearly",
        status: "trialing",
        trial_end: TRIAL_END,
      }),
    );
    expect(row.tier).toBe("premium");
    expect(row.status).toBe("trialing");
    expect(row.trial_end).toBe("2026-07-01T00:00:00.000Z");
  });

  it("reef_keeper_yearly → tier 'pro'", () => {
    const row = subscriptionRowFromStripeSub(
      sub({ lookupKey: "reef_keeper_yearly" }),
    );
    expect(row.tier).toBe("pro");
  });

  it("reef_master_monthly → tier 'premium'", () => {
    const row = subscriptionRowFromStripeSub(
      sub({ lookupKey: "reef_master_monthly" }),
    );
    expect(row.tier).toBe("premium");
  });

  it("canceled sub → status 'canceled'", () => {
    const row = subscriptionRowFromStripeSub(sub({ status: "canceled" }));
    expect(row.status).toBe("canceled");
  });

  it("unknown lookup_key → tier 'free'", () => {
    const row = subscriptionRowFromStripeSub(
      sub({ lookupKey: "totally_made_up_key" }),
    );
    expect(row.tier).toBe("free");
  });

  it("missing lookup_key → tier 'free'", () => {
    const row = subscriptionRowFromStripeSub(sub({ lookupKey: null }));
    expect(row.tier).toBe("free");
  });

  it("converts the item's current_period_end to an ISO string", () => {
    const row = subscriptionRowFromStripeSub(sub({ itemPeriodEnd: PERIOD_END }));
    expect(row.current_period_end).toBe("2026-07-24T00:00:00.000Z");
  });

  it("falls back to the legacy top-level current_period_end", () => {
    // No items present at all (older API shape) → read top-level field.
    const legacy: MinimalStripeSubscription = {
      id: "sub_legacy",
      status: "active",
      cancel_at_period_end: false,
      trial_end: null,
      current_period_end: PERIOD_END,
      items: { data: [{ price: { id: "p1", lookup_key: "reef_keeper_monthly" } }] },
    };
    const row = subscriptionRowFromStripeSub(legacy);
    expect(row.current_period_end).toBe("2026-07-24T00:00:00.000Z");
    expect(row.tier).toBe("pro");
  });

  it("null period end and null trial → null ISO fields", () => {
    const row = subscriptionRowFromStripeSub(
      sub({ itemPeriodEnd: null, trial_end: null, current_period_end: null }),
    );
    expect(row.current_period_end).toBeNull();
    expect(row.trial_end).toBeNull();
  });

  it("reflects cancel_at_period_end = true", () => {
    const row = subscriptionRowFromStripeSub(sub({ cancel_at_period_end: true }));
    expect(row.cancel_at_period_end).toBe(true);
  });

  it("treats a missing cancel_at_period_end as false", () => {
    const s = sub();
    delete (s as { cancel_at_period_end?: boolean }).cancel_at_period_end;
    const row = subscriptionRowFromStripeSub(s);
    expect(row.cancel_at_period_end).toBe(false);
  });

  it("handles an empty items array gracefully (no price, free tier)", () => {
    const row = subscriptionRowFromStripeSub({
      id: "sub_empty",
      status: "active",
      items: { data: [] },
    });
    expect(row.tier).toBe("free");
    expect(row.price_id).toBeNull();
    expect(row.current_period_end).toBeNull();
  });
});
