import { describe, it, expect } from "vitest";
import {
  statusTone,
  statusLabel,
  fmtParam,
  dueLabel,
  greetingFor,
  TANK_TYPE_LABEL,
  CYCLE_LABEL,
} from "./format";

const DAY = 86_400_000;

describe("statusTone", () => {
  it("maps statuses to tones", () => {
    expect(statusTone("ok")).toBe("healthy");
    expect(statusTone("low")).toBe("caution");
    expect(statusTone("high")).toBe("caution");
    expect(statusTone("critical")).toBe("danger");
    expect(statusTone("unknown")).toBe("neutral");
  });
});

describe("statusLabel", () => {
  it("labels statuses", () => {
    expect(statusLabel("ok")).toBe("In range");
    expect(statusLabel("critical")).toBe("Critical");
    expect(statusLabel("anything")).toBe("—");
  });
});

describe("fmtParam", () => {
  it("uses per-key precision and appends the unit", () => {
    expect(fmtParam("salinity_sg", 1.0256, "")).toBe("1.0256");
    expect(fmtParam("ph", 8.123, "")).toBe("8.12");
    expect(fmtParam("alkalinity_dkh", 8.64, "dKH")).toBe("8.6 dKH");
    expect(fmtParam("calcium_ppm", 424.6, "ppm")).toBe("425 ppm");
    expect(fmtParam("temp_c", 25.6, "°C")).toBe("25.6 °C");
  });
});

describe("dueLabel", () => {
  it("classifies due dates relative to now", () => {
    expect(dueLabel(new Date(Date.now() - 3 * DAY - 3600_000).toISOString()))
      .toMatchObject({ tone: "danger" });
    expect(dueLabel(new Date(Date.now()).toISOString()).text).toBe("Due today");
    expect(dueLabel(new Date(Date.now() + DAY + 3600_000).toISOString()).text)
      .toBe("Due tomorrow");
    const inFive = dueLabel(new Date(Date.now() + 5 * DAY + 3600_000).toISOString());
    expect(inFive.text).toContain("Due in 5");
    expect(inFive.tone).toBe("neutral");
  });
});

describe("greetingFor", () => {
  it("greets by time of day", () => {
    expect(greetingFor(new Date(2026, 0, 1, 9))).toBe("Good morning");
    expect(greetingFor(new Date(2026, 0, 1, 14))).toBe("Good afternoon");
    expect(greetingFor(new Date(2026, 0, 1, 20))).toBe("Good evening");
  });
});

describe("label maps", () => {
  it("has expected entries", () => {
    expect(TANK_TYPE_LABEL.sps).toBe("SPS reef");
    expect(CYCLE_LABEL.cycled).toBe("Fully cycled");
  });
});
