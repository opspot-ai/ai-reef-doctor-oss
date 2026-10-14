import {
  ENTITLEMENTS,
  resolveTier,
  getEntitlements,
  canUse,
  checkTankLimit,
  checkChatUsage,
  checkPhotoUsage,
} from "./entitlements";
import type { Capability, Subscription, SubStatus, SubTier } from "./types";

function sub(tier: SubTier, status: SubStatus): Subscription {
  return {
    user_id: "u-1",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    tier,
    status,
    price_id: null,
    current_period_end: null,
    trial_end: null,
    cancel_at_period_end: false,
  };
}

const ALL_CAPS: Capability[] = [
  "photoDiagnosis",
  "dosingCalculators",
  "treatmentProtocols",
  "symptomChecker",
  "maintenancePlans",
  "reminders",
  "weeklyReports",
  "predictiveForecasting",
  "advancedAnalytics",
  "controllerIntegrations",
  "prioritySupport",
];

describe("ENTITLEMENTS table ", () => {
  it("has an entry for every tier", () => {
    expect(Object.keys(ENTITLEMENTS).sort()).toEqual([
      "free",
      "premium",
      "pro",
    ]);
  });

  describe("free (Tide Pool)", () => {
    const e = ENTITLEMENTS.free;
    it("caps", () => {
      expect(e.tier).toBe("free");
      expect(e.maxTanks).toBe(1);
      expect(e.aiChatsPerMonth).toBe(5);
      expect(e.photoDiagnosesPerMonth).toBe(1);
      expect(e.model).toBe("claude-opus-4-8");
    });
    it("has every capability false (photoDiagnosis is trial-by-count only)", () => {
      for (const cap of ALL_CAPS) {
        expect(e.capabilities[cap]).toBe(false);
      }
      // explicit: photoDiagnosis capability is false even though count is 1
      expect(e.capabilities.photoDiagnosis).toBe(false);
    });
  });

  describe("pro (Reef Keeper)", () => {
    const e = ENTITLEMENTS.pro;
    it("caps", () => {
      expect(e.tier).toBe("pro");
      expect(e.maxTanks).toBe(5);
      expect(e.aiChatsPerMonth).toBe(Infinity);
      expect(e.photoDiagnosesPerMonth).toBe(Infinity);
      expect(e.model).toBe("claude-opus-4-8");
    });
    it("unlocks the pro capability set", () => {
      const trueCaps: Capability[] = [
        "photoDiagnosis",
        "dosingCalculators",
        "treatmentProtocols",
        "symptomChecker",
        "maintenancePlans",
        "reminders",
        "weeklyReports",
      ];
      for (const cap of trueCaps) expect(e.capabilities[cap]).toBe(true);
    });
    it("keeps premium-only capabilities false", () => {
      const falseCaps: Capability[] = [
        "predictiveForecasting",
        "advancedAnalytics",
        "controllerIntegrations",
        "prioritySupport",
      ];
      for (const cap of falseCaps) expect(e.capabilities[cap]).toBe(false);
    });
  });

  describe("premium (Reef Master)", () => {
    const e = ENTITLEMENTS.premium;
    it("caps", () => {
      expect(e.tier).toBe("premium");
      expect(e.maxTanks).toBe(Infinity);
      expect(e.aiChatsPerMonth).toBe(Infinity);
      expect(e.photoDiagnosesPerMonth).toBe(Infinity);
      expect(e.model).toBe("claude-opus-4-8");
    });
    it("unlocks every capability", () => {
      for (const cap of ALL_CAPS) expect(e.capabilities[cap]).toBe(true);
    });
  });
});

describe("resolveTier", () => {
  it("returns the tier when status is active", () => {
    expect(resolveTier(sub("pro", "active"))).toBe("pro");
    expect(resolveTier(sub("premium", "active"))).toBe("premium");
  });
  it("returns the tier when status is trialing", () => {
    expect(resolveTier(sub("pro", "trialing"))).toBe("pro");
    expect(resolveTier(sub("premium", "trialing"))).toBe("premium");
  });
  it("falls back to free when status is past_due", () => {
    expect(resolveTier(sub("premium", "past_due"))).toBe("free");
  });
  it("falls back to free when status is canceled", () => {
    expect(resolveTier(sub("pro", "canceled"))).toBe("free");
  });
  it("falls back to free when status is inactive", () => {
    expect(resolveTier(sub("premium", "inactive"))).toBe("free");
  });
  it("falls back to free when subscription is null", () => {
    expect(resolveTier(null)).toBe("free");
  });
  it("returns free for an active free subscription", () => {
    expect(resolveTier(sub("free", "active"))).toBe("free");
  });
});

describe("getEntitlements", () => {
  it("returns free entitlements for null subscription, active=false", () => {
    const e = getEntitlements(null);
    expect(e.tier).toBe("free");
    expect(e.active).toBe(false);
    expect(e.maxTanks).toBe(1);
  });
  it("returns pro entitlements with active=true for active pro", () => {
    const e = getEntitlements(sub("pro", "active"));
    expect(e.tier).toBe("pro");
    expect(e.active).toBe(true);
    expect(e.maxTanks).toBe(5);
    expect(e.capabilities.photoDiagnosis).toBe(true);
  });
  it("returns premium entitlements with active=true for trialing premium", () => {
    const e = getEntitlements(sub("premium", "trialing"));
    expect(e.tier).toBe("premium");
    expect(e.active).toBe(true);
    expect(e.maxTanks).toBe(Infinity);
  });
  it("downgrades to free entitlements when status is past_due, active=false", () => {
    const e = getEntitlements(sub("premium", "past_due"));
    expect(e.tier).toBe("free");
    expect(e.active).toBe(false);
    expect(e.capabilities.advancedAnalytics).toBe(false);
  });
  it("does not mutate the ENTITLEMENTS source table", () => {
    const e = getEntitlements(sub("pro", "active"));
    e.maxTanks = 999;
    e.capabilities.photoDiagnosis = false;
    expect(ENTITLEMENTS.pro.maxTanks).toBe(5);
    expect(ENTITLEMENTS.pro.capabilities.photoDiagnosis).toBe(true);
    // base table active stays its own default
    expect(getEntitlements(sub("pro", "active")).maxTanks).toBe(5);
  });
});

describe("canUse", () => {
  it("is true for an unlocked capability", () => {
    expect(canUse(getEntitlements(sub("pro", "active")), "photoDiagnosis")).toBe(
      true,
    );
  });
  it("is false for a locked capability", () => {
    expect(canUse(getEntitlements(null), "photoDiagnosis")).toBe(false);
    expect(
      canUse(getEntitlements(sub("pro", "active")), "advancedAnalytics"),
    ).toBe(false);
  });
});

describe("checkTankLimit", () => {
  it("blocks free at the limit and suggests pro", () => {
    const e = getEntitlements(null);
    expect(checkTankLimit(e, 0)).toEqual({ allowed: true });
    expect(checkTankLimit(e, 1)).toEqual({ allowed: false, upgradeTo: "pro" });
    expect(checkTankLimit(e, 2)).toEqual({ allowed: false, upgradeTo: "pro" });
  });
  it("blocks pro at the limit and suggests premium", () => {
    const e = getEntitlements(sub("pro", "active"));
    expect(checkTankLimit(e, 4)).toEqual({ allowed: true });
    expect(checkTankLimit(e, 5)).toEqual({
      allowed: false,
      upgradeTo: "premium",
    });
  });
  it("never blocks premium (Infinity cap)", () => {
    const e = getEntitlements(sub("premium", "active"));
    expect(checkTankLimit(e, 0)).toEqual({ allowed: true });
    expect(checkTankLimit(e, 9999)).toEqual({ allowed: true });
  });
});

describe("checkChatUsage", () => {
  it("blocks free at the monthly limit and suggests pro", () => {
    const e = getEntitlements(null);
    expect(checkChatUsage(e, 4)).toEqual({ allowed: true });
    expect(checkChatUsage(e, 5)).toEqual({ allowed: false, upgradeTo: "pro" });
    expect(checkChatUsage(e, 6)).toEqual({ allowed: false, upgradeTo: "pro" });
  });
  it("never blocks pro (Infinity cap)", () => {
    const e = getEntitlements(sub("pro", "active"));
    expect(checkChatUsage(e, 100000)).toEqual({ allowed: true });
  });
  it("never blocks premium (Infinity cap)", () => {
    const e = getEntitlements(sub("premium", "active"));
    expect(checkChatUsage(e, 100000)).toEqual({ allowed: true });
  });
});

describe("checkPhotoUsage", () => {
  it("allows the single free trial diagnosis then blocks, suggesting pro", () => {
    const e = getEntitlements(null);
    expect(checkPhotoUsage(e, 0)).toEqual({ allowed: true });
    expect(checkPhotoUsage(e, 1)).toEqual({ allowed: false, upgradeTo: "pro" });
  });
  it("never blocks pro (Infinity cap)", () => {
    const e = getEntitlements(sub("pro", "active"));
    expect(checkPhotoUsage(e, 9999)).toEqual({ allowed: true });
  });
  it("never blocks premium (Infinity cap)", () => {
    const e = getEntitlements(sub("premium", "active"));
    expect(checkPhotoUsage(e, 9999)).toEqual({ allowed: true });
  });
});
