import {
  doseToRaise,
  doseAlk,
  doseCalcium,
  doseMagnesium,
  copperDose,
  ALK_STRENGTH_PER_ML_PER_L,
  CA_STRENGTH_PER_ML_PER_L,
  MG_STRENGTH_PER_ML_PER_L,
  ALK_MAX_DAILY_DELTA,
  CA_MAX_DAILY_DELTA,
  MG_MAX_DAILY_DELTA,
  COPPER_RANGES,
} from "./dosing";
import { DOSE_WARNING } from "./disclaimers";

describe("doseToRaise", () => {
  it("computes ml = delta * volume / strength, rounded to 2dp", () => {
    // raise 1.0 unit in 100 L at strength 0.1 unit/mL/L → 1*100/0.1 = 1000 mL
    const r = doseToRaise({
      volumeLiters: 100,
      current: 7,
      target: 8,
      strengthPerMlPerL: 0.1,
      maxDailyDelta: 5,
      unit: "dKH",
    });
    expect(r.recommendedMl).toBe(1000);
    expect(r.clamped).toBe(false);
    expect(r.days).toBe(1);
    expect(r.perDayMl).toBeUndefined();
  });

  it("returns 0 with a note when target <= current (zero delta)", () => {
    const r = doseToRaise({
      volumeLiters: 100,
      current: 8,
      target: 8,
      strengthPerMlPerL: 0.1,
      maxDailyDelta: 5,
      unit: "dKH",
    });
    expect(r.recommendedMl).toBe(0);
    expect(r.clamped).toBe(false);
    expect(r.days).toBe(1);
    expect(r.note).toMatch(/already at or above/i);
  });

  it("returns 0 with a note when target < current (negative delta)", () => {
    const r = doseToRaise({
      volumeLiters: 100,
      current: 9,
      target: 8,
      strengthPerMlPerL: 0.1,
      maxDailyDelta: 5,
      unit: "dKH",
    });
    expect(r.recommendedMl).toBe(0);
    expect(r.note).toMatch(/already at or above/i);
  });

  it("returns 0 with a note when strength <= 0 (cannot compute)", () => {
    const r = doseToRaise({
      volumeLiters: 100,
      current: 7,
      target: 8,
      strengthPerMlPerL: 0,
      maxDailyDelta: 5,
      unit: "dKH",
    });
    expect(r.recommendedMl).toBe(0);
    expect(r.note).toMatch(/strength/i);
  });

  it("splits across multiple days and clamps when delta exceeds maxDailyDelta", () => {
    // delta 3.0, max 1.4/day → ceil(3/1.4) = 3 days
    // total ml = 3 * 100 / 0.1 = 3000 ; perDay = 1000
    const r = doseToRaise({
      volumeLiters: 100,
      current: 7,
      target: 10,
      strengthPerMlPerL: 0.1,
      maxDailyDelta: 1.4,
      unit: "dKH",
    });
    expect(r.days).toBe(3);
    expect(r.recommendedMl).toBe(3000);
    expect(r.perDayMl).toBe(1000);
    expect(r.clamped).toBe(true);
    expect(r.warnings.some((w) => /spread|multiple days|over .* days/i.test(w))).toBe(
      true,
    );
  });

  it("rounds perDayMl to 2 decimals", () => {
    // delta 2.0, max 1.0/day → 2 days, total = 2*10/0.3 = 66.6666... → 66.67
    const r = doseToRaise({
      volumeLiters: 10,
      current: 0,
      target: 2,
      strengthPerMlPerL: 0.3,
      maxDailyDelta: 1.0,
      unit: "dKH",
    });
    expect(r.days).toBe(2);
    expect(r.recommendedMl).toBe(66.67);
    // perDayMl = round2(totalMl / days) = round2(66.67 / 2) = round2(33.335) = 33.34
    expect(r.perDayMl).toBe(33.34);
  });

  it("always includes DOSE_WARNING and mentions verifying against the product in note", () => {
    const r = doseToRaise({
      volumeLiters: 100,
      current: 7,
      target: 8,
      strengthPerMlPerL: 0.1,
      maxDailyDelta: 5,
      unit: "dKH",
    });
    expect(r.warnings).toContain(DOSE_WARNING);
    expect(r.note).toMatch(/verify|product/i);
  });

  it("includes DOSE_WARNING even on a zero-dose result", () => {
    const r = doseToRaise({
      volumeLiters: 100,
      current: 8,
      target: 8,
      strengthPerMlPerL: 0.1,
      maxDailyDelta: 5,
      unit: "dKH",
    });
    expect(r.warnings).toContain(DOSE_WARNING);
  });
});

describe("doseAlk", () => {
  it("uses the documented alk maxDailyDelta of 1.4 dKH/day", () => {
    expect(ALK_MAX_DAILY_DELTA).toBe(1.4);
    // delta 2.0 > 1.4 → ceil(2/1.4) = 2 days
    const r = doseAlk({ volumeLiters: 100, currentDkh: 7, targetDkh: 9 });
    expect(r.days).toBe(2);
    expect(r.clamped).toBe(true);
  });

  it("computes ml from the documented strength and includes DOSE_WARNING", () => {
    const r = doseAlk({ volumeLiters: 100, currentDkh: 7, targetDkh: 8 });
    // delta 1.0 within max → 1 day
    expect(r.days).toBe(1);
    expect(r.recommendedMl).toBeCloseTo(
      Number((1 * 100 / ALK_STRENGTH_PER_ML_PER_L).toFixed(2)),
      2,
    );
    expect(r.warnings).toContain(DOSE_WARNING);
  });

  it("returns 0 when already at/above target", () => {
    const r = doseAlk({ volumeLiters: 100, currentDkh: 9, targetDkh: 8 });
    expect(r.recommendedMl).toBe(0);
  });
});

describe("doseCalcium", () => {
  it("uses the documented Ca maxDailyDelta of 50 ppm/day", () => {
    expect(CA_MAX_DAILY_DELTA).toBe(50);
    // delta 120 > 50 → ceil(120/50) = 3 days
    const r = doseCalcium({ volumeLiters: 200, currentPpm: 380, targetPpm: 500 });
    expect(r.days).toBe(3);
    expect(r.clamped).toBe(true);
    expect(r.warnings).toContain(DOSE_WARNING);
  });

  it("computes ml from documented strength for a small delta (1 day)", () => {
    const r = doseCalcium({ volumeLiters: 100, currentPpm: 400, targetPpm: 420 });
    expect(r.days).toBe(1);
    expect(r.recommendedMl).toBeCloseTo(
      Number((20 * 100 / CA_STRENGTH_PER_ML_PER_L).toFixed(2)),
      2,
    );
  });
});

describe("doseMagnesium", () => {
  it("uses the documented Mg maxDailyDelta of 100 ppm/day", () => {
    expect(MG_MAX_DAILY_DELTA).toBe(100);
    // delta 250 > 100 → ceil(250/100) = 3 days
    const r = doseMagnesium({
      volumeLiters: 200,
      currentPpm: 1150,
      targetPpm: 1400,
    });
    expect(r.days).toBe(3);
    expect(r.clamped).toBe(true);
    expect(r.warnings).toContain(DOSE_WARNING);
  });

  it("returns 0 when at/above target", () => {
    const r = doseMagnesium({
      volumeLiters: 200,
      currentPpm: 1400,
      targetPpm: 1350,
    });
    expect(r.recommendedMl).toBe(0);
  });
});

describe("copperDose", () => {
  it("exposes therapeutic ranges for ionic and chelated", () => {
    expect(COPPER_RANGES.ionic).toEqual({ min: 0.15, max: 0.3 });
    expect(COPPER_RANGES.chelated).toEqual({ min: 1.75, max: 2.5 });
  });

  it("clamps an over-range ionic target down to 0.30 and flags it", () => {
    const r = copperDose({
      volumeLiters: 100,
      currentPpm: 0,
      targetPpm: 0.5, // above ionic max 0.30
      type: "ionic",
      productPpmPerMlPerL: 0.1,
    });
    expect(r.clamped).toBe(true);
    // effective target clamped to 0.30, delta 0.30
    expect(r.recommendedMl).toBeCloseTo(
      Number((0.3 * 100 / 0.1).toFixed(2)),
      2,
    );
    expect(
      r.warnings.some((w) => /therapeutic range|clamp|0\.3/i.test(w)),
    ).toBe(true);
  });

  it("clamps an under-range ionic target up to 0.15 and flags it", () => {
    const r = copperDose({
      volumeLiters: 100,
      currentPpm: 0,
      targetPpm: 0.05, // below ionic min 0.15
      type: "ionic",
      productPpmPerMlPerL: 0.1,
    });
    expect(r.clamped).toBe(true);
    expect(r.recommendedMl).toBeCloseTo(
      Number((0.15 * 100 / 0.1).toFixed(2)),
      2,
    );
    expect(
      r.warnings.some((w) => /therapeutic range|clamp|0\.15/i.test(w)),
    ).toBe(true);
  });

  it("clamps an over-range chelated target down to 2.50 and flags it", () => {
    const r = copperDose({
      volumeLiters: 100,
      currentPpm: 0,
      targetPpm: 3.0, // above chelated max 2.50
      type: "chelated",
      productPpmPerMlPerL: 1.0,
    });
    expect(r.clamped).toBe(true);
    expect(r.recommendedMl).toBeCloseTo(
      Number((2.5 * 100 / 1.0).toFixed(2)),
      2,
    );
    expect(
      r.warnings.some((w) => /therapeutic range|clamp|2\.5/i.test(w)),
    ).toBe(true);
  });

  it("clamps an under-range chelated target up to 1.75 and flags it", () => {
    const r = copperDose({
      volumeLiters: 100,
      currentPpm: 0,
      targetPpm: 1.0, // below chelated min 1.75
      type: "chelated",
      productPpmPerMlPerL: 1.0,
    });
    expect(r.clamped).toBe(true);
    expect(r.recommendedMl).toBeCloseTo(
      Number((1.75 * 100 / 1.0).toFixed(2)),
      2,
    );
  });

  it("does NOT flag clamped when target is inside the therapeutic range", () => {
    const r = copperDose({
      volumeLiters: 100,
      currentPpm: 0,
      targetPpm: 0.2, // inside ionic range
      type: "ionic",
      productPpmPerMlPerL: 0.1,
    });
    expect(r.clamped).toBe(false);
    expect(r.recommendedMl).toBeCloseTo(
      Number((0.2 * 100 / 0.1).toFixed(2)),
      2,
    );
  });

  it("always carries the copper safety warnings and DOSE_WARNING", () => {
    const r = copperDose({
      volumeLiters: 100,
      currentPpm: 0,
      targetPpm: 0.2,
      type: "ionic",
      productPpmPerMlPerL: 0.1,
    });
    expect(r.warnings).toContain(DOSE_WARNING);
    expect(r.warnings.some((w) => /ramp.*3.*5 days|3–5 days|3-5 days/i.test(w))).toBe(
      true,
    );
    expect(r.warnings.some((w) => /test daily|copper test/i.test(w))).toBe(true);
    expect(
      r.warnings.some((w) => /display tank|not reef-?safe|reef-?safe/i.test(w)),
    ).toBe(true);
  });

  it("returns 0 ml when current already at/above the (clamped) target", () => {
    const r = copperDose({
      volumeLiters: 100,
      currentPpm: 0.3,
      targetPpm: 0.2,
      type: "ionic",
      productPpmPerMlPerL: 0.1,
    });
    expect(r.recommendedMl).toBe(0);
    // copper safety warnings still present
    expect(r.warnings).toContain(DOSE_WARNING);
  });

  it("rounds recommendedMl to 2 decimals", () => {
    const r = copperDose({
      volumeLiters: 37, // odd volume to force fractional ml
      currentPpm: 0,
      targetPpm: 0.2,
      type: "ionic",
      productPpmPerMlPerL: 0.3,
    });
    // 0.2 * 37 / 0.3 = 24.6666... → 24.67
    expect(r.recommendedMl).toBe(24.67);
  });
});
