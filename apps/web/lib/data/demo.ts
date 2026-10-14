import type {
  Tank,
  ParameterRow,
  Livestock,
  Reminder,
} from "@reef/shared";

/**
 * Demo dataset used when Supabase isn't configured (no owner creds yet) so the
 * full UI renders populated for development + verification. The UI shows a clear
 * "Demo mode" banner; switching to real data is automatic once creds are set.
 */
export const DEMO_USER = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "demo@example.invalid",
  full_name: "Demo Reefer",
};

const T1 = "00000000-0000-4000-8000-000000000002";
const T2 = "00000000-0000-4000-8000-000000000003";

export const DEMO_TANKS: Tank[] = [
  {
    id: T1,
    user_id: DEMO_USER.id,
    name: "Coral Garden",
    type: "mixed",
    volume_liters: 284,
    started_at: "2024-09-01",
    notes: "Synthetic 75 gal mixed reef with sample return pump, reef lights, and controller.",
    created_at: "2024-09-01T12:00:00Z",
  },
  {
    id: T2,
    user_id: DEMO_USER.id,
    name: "SPS Frag Tank",
    type: "sps",
    volume_liters: 114,
    started_at: "2025-02-15",
    notes: "Synthetic 30 gal SPS example with sample alkalinity control.",
    created_at: "2025-02-15T12:00:00Z",
  },
];

/** Deterministic ~12-point parameter history per tank (most recent first). */
export function demoParameterHistory(tankId: string): ParameterRow[] {
  const isSps = tankId === T2;
  const base = {
    salinity_sg: 1.0258,
    temp_c: 25.6,
    ph: 8.12,
    alkalinity_dkh: isSps ? 8.0 : 8.6,
    calcium_ppm: isSps ? 435 : 425,
    magnesium_ppm: 1350,
    ammonia_ppm: 0,
    nitrite_ppm: 0,
    nitrate_ppm: isSps ? 4 : 9,
    phosphate_ppm: isSps ? 0.04 : 0.08,
    orp_mv: 380,
  };
  const rows: ParameterRow[] = [];
  for (let i = 0; i < 12; i++) {
    const day = new Date("2026-06-20T09:00:00Z");
    day.setUTCDate(day.getUTCDate() - i * 3);
    const wobble = (n: number, amp: number) =>
      Math.round((n + Math.sin(i * 1.3) * amp) * 1000) / 1000;
    rows.push({
      id: `${tankId}-p${i}`,
      tank_id: tankId,
      user_id: DEMO_USER.id,
      measured_at: day.toISOString(),
      created_at: day.toISOString(),
      salinity_sg: wobble(base.salinity_sg, 0.0006),
      temp_c: wobble(base.temp_c, 0.4),
      ph: wobble(base.ph, 0.05),
      alkalinity_dkh: wobble(base.alkalinity_dkh, 0.3),
      calcium_ppm: Math.round(wobble(base.calcium_ppm, 12)),
      magnesium_ppm: Math.round(wobble(base.magnesium_ppm, 25)),
      ammonia_ppm: 0,
      nitrite_ppm: 0,
      nitrate_ppm: Math.max(0, wobble(base.nitrate_ppm, 2)),
      phosphate_ppm: Math.max(0, wobble(base.phosphate_ppm, 0.02)),
      orp_mv: Math.round(wobble(base.orp_mv, 15)),
      source: "manual",
    });
  }
  return rows;
}

export const DEMO_LIVESTOCK: Livestock[] = [
  { id: "l1", tank_id: T1, user_id: DEMO_USER.id, kind: "fish", common_name: "Ocellaris Clownfish", scientific_name: "Amphiprion ocellaris", nickname: "Nemo", added_at: "2024-09-20", photo_path: null, status: "alive", notes: "Hosts a bubble-tip anemone.", created_at: "2024-09-20T12:00:00Z" },
  { id: "l2", tank_id: T1, user_id: DEMO_USER.id, kind: "fish", common_name: "Royal Gramma", scientific_name: "Gramma loreto", nickname: null, added_at: "2024-10-05", photo_path: null, status: "alive", notes: null, created_at: "2024-10-05T12:00:00Z" },
  { id: "l3", tank_id: T1, user_id: DEMO_USER.id, kind: "coral", common_name: "Hammer Coral", scientific_name: "Euphyllia ancora", nickname: null, added_at: "2024-11-12", photo_path: null, status: "alive", notes: "Great polyp extension.", created_at: "2024-11-12T12:00:00Z" },
  { id: "l4", tank_id: T1, user_id: DEMO_USER.id, kind: "invert", common_name: "Skunk Cleaner Shrimp", scientific_name: "Lysmata amboinensis", nickname: null, added_at: "2024-09-25", photo_path: null, status: "alive", notes: null, created_at: "2024-09-25T12:00:00Z" },
  { id: "l5", tank_id: T2, user_id: DEMO_USER.id, kind: "coral", common_name: "Green Slimer Acropora", scientific_name: "Acropora yongei", nickname: null, added_at: "2025-03-01", photo_path: null, status: "alive", notes: "Encrusting nicely.", created_at: "2025-03-01T12:00:00Z" },
];

export const DEMO_REMINDERS: Reminder[] = [
  { id: "r1", tank_id: T1, user_id: DEMO_USER.id, title: "Test alkalinity", kind: "test", due_at: "2026-06-25T09:00:00Z", recurrence: "weekly", last_done_at: "2026-06-18T09:00:00Z", active: true, created_at: "2025-01-01T12:00:00Z" },
  { id: "r2", tank_id: T1, user_id: DEMO_USER.id, title: "20% water change", kind: "water-change", due_at: "2026-06-27T09:00:00Z", recurrence: "biweekly", last_done_at: "2026-06-13T09:00:00Z", active: true, created_at: "2025-01-01T12:00:00Z" },
  { id: "r3", tank_id: T2, user_id: DEMO_USER.id, title: "Clean skimmer cup", kind: "maintenance", due_at: "2026-06-24T09:00:00Z", recurrence: "weekly", last_done_at: "2026-06-17T09:00:00Z", active: true, created_at: "2025-02-15T12:00:00Z" },
];

export interface DemoDiagnosisRow {
  id: string;
  tank_id: string;
  kind: "fish" | "coral" | "algae" | "params" | "symptom";
  summary: string;
  urgency: "routine" | "monitor" | "urgent" | "emergency";
  created_at: string;
}

export const DEMO_DIAGNOSES: DemoDiagnosisRow[] = [
  { id: "d1", tank_id: T1, kind: "algae", summary: "Likely cyanobacteria on the sand bed — address flow and nutrients.", urgency: "monitor", created_at: "2026-06-15T18:00:00Z" },
  { id: "d2", tank_id: T1, kind: "fish", summary: "Royal Gramma photo: no disease signs detected; coloration healthy.", urgency: "routine", created_at: "2026-06-10T18:00:00Z" },
];
