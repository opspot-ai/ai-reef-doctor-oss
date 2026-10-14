import type { ParamKey, ParamStatus, TankType } from "@reef/shared";

/**
 * Display helpers shared across screens (labels, status tones, date math) —
 * mirrors the small helpers in the web dashboard so mobile reads identically.
 */

export const TANK_TYPE_LABEL: Record<TankType, string> = {
  fowlr: "Fish-only / live rock",
  soft: "Soft coral",
  lps: "LPS reef",
  sps: "SPS reef",
  mixed: "Mixed reef",
  nano: "Nano reef",
};

export const REMINDER_KIND_LABEL: Record<string, string> = {
  test: "Test",
  "water-change": "Water change",
  maintenance: "Maintenance",
  dose: "Dosing",
  feed: "Feeding",
};

export const CYCLE_LABEL: Record<string, string> = {
  "not-started": "Not started",
  ammonia: "Ammonia phase",
  nitrite: "Nitrite phase",
  nitrate: "Nitrate phase",
  cycled: "Fully cycled",
};

export type StatTone = "neutral" | "healthy" | "caution" | "danger";

/** Map a parameter status to a Stat/Badge tone. */
export function statusTone(status: ParamStatus | string): StatTone {
  switch (status) {
    case "ok":
      return "healthy";
    case "low":
    case "high":
      return "caution";
    case "critical":
      return "danger";
    default:
      return "neutral";
  }
}

/** Human label for a parameter status. */
export function statusLabel(status: string): string {
  switch (status) {
    case "low":
      return "Low";
    case "high":
      return "High";
    case "critical":
      return "Critical";
    case "ok":
      return "In range";
    default:
      return "—";
  }
}

/** Format a numeric value with sensible precision per key, plus its unit. */
export function fmtParam(key: ParamKey, value: number, unit: string): string {
  let num: string;
  if (key === "salinity_sg") num = value.toFixed(4);
  else if (key === "ph") num = value.toFixed(2);
  else if (key === "alkalinity_dkh") num = value.toFixed(1);
  else if (key === "phosphate_ppm") num = value.toFixed(2);
  else if (key === "temp_c") num = value.toFixed(1);
  else num = String(Math.round(value));
  return unit ? `${num} ${unit}` : num;
}

const DAY_MS = 86_400_000;

/** Whole days since an ISO date (UTC-safe). Null when no date. */
export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.floor((Date.now() - then) / DAY_MS));
}

/** Whole days until an ISO date (negative = overdue). */
export function daysUntil(iso: string): number {
  const due = new Date(iso).getTime();
  return Math.round((due - Date.now()) / DAY_MS);
}

export function dueLabel(iso: string): { text: string; tone: StatTone } {
  const d = daysUntil(iso);
  if (d < 0) return { text: `Overdue by ${Math.abs(d)}d`, tone: "danger" };
  if (d === 0) return { text: "Due today", tone: "danger" };
  if (d === 1) return { text: "Due tomorrow", tone: "caution" };
  if (d <= 3) return { text: `Due in ${d}d`, tone: "caution" };
  return { text: `Due in ${d}d`, tone: "neutral" };
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function greetingFor(d: Date): string {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
