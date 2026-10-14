import "server-only";
import { features } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { getUserEntitlements, type SupabaseLike } from "@/lib/entitlements-server";
import * as demo from "./demo";
import {
  getEntitlements,
  type Tank,
  type ParameterRow,
  type Livestock,
  type Reminder,
  type Entitlements,
  type Subscription,
} from "@reef/shared";

/** When Supabase isn't configured we serve demo data so the UI is fully usable. */
export function isDemoMode(): boolean {
  return !features.supabase;
}

export interface SessionUser {
  id: string;
  email: string;
  full_name: string;
}

export async function getSessionUser(): Promise<SessionUser> {
  if (isDemoMode()) return demo.DEMO_USER;
  const user = await requireUser();
  return {
    id: user.id,
    email: user.email ?? "",
    full_name: (user.user_metadata?.full_name as string | undefined) ?? "",
  };
}

/** Entitlements for the current session (demo mode → a pro plan so the UI shows
 * unlocked features plus premium upsells). Real mode derives from Stripe. */
export async function getSessionEntitlements(): Promise<Entitlements> {
  if (isDemoMode()) {
    const demoSub: Subscription = {
      user_id: demo.DEMO_USER.id,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      tier: "pro",
      status: "active",
      price_id: null,
      current_period_end: null,
      trial_end: null,
      cancel_at_period_end: false,
    };
    return getEntitlements(demoSub);
  }
  const user = await requireUser();
  const sb = await createSupabaseServerClient();
  // The RLS-scoped client is a structural superset of the SupabaseLike slice.
  return getUserEntitlements(sb as unknown as SupabaseLike, user.id);
}

export async function listTanks(): Promise<Tank[]> {
  if (isDemoMode()) return demo.DEMO_TANKS;
  const sb = await createSupabaseServerClient();
  const { data } = await sb
    .from("tanks")
    .select("*")
    .order("created_at", { ascending: true });
  return (data as Tank[] | null) ?? [];
}

export async function getTank(id: string): Promise<Tank | null> {
  if (isDemoMode()) return demo.DEMO_TANKS.find((t) => t.id === id) ?? null;
  const sb = await createSupabaseServerClient();
  const { data } = await sb.from("tanks").select("*").eq("id", id).maybeSingle();
  return (data as Tank | null) ?? null;
}

/**
 * Resolve the active tank from an optional id (e.g. ?tank=), then the
 * `active_tank` cookie set by the tank switcher, then the first tank.
 */
export async function getActiveTank(preferredId?: string): Promise<Tank | null> {
  const tanks = await listTanks();
  if (!tanks.length) return null;
  const tryId = (id?: string) =>
    id ? tanks.find((t) => t.id === id) : undefined;
  let match = tryId(preferredId);
  if (!match) {
    const { cookies } = await import("next/headers");
    const cookieId = (await cookies()).get("active_tank")?.value;
    match = tryId(cookieId);
  }
  return match ?? tanks[0] ?? null;
}

export async function getLatestParameters(
  tankId: string,
): Promise<ParameterRow | null> {
  if (isDemoMode()) return demo.demoParameterHistory(tankId)[0] ?? null;
  const sb = await createSupabaseServerClient();
  const { data } = await sb
    .from("parameters")
    .select("*")
    .eq("tank_id", tankId)
    .order("measured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as ParameterRow | null) ?? null;
}

/** Parameter history ascending (oldest → newest) for charting. */
export async function getParameterHistory(
  tankId: string,
  limit = 30,
): Promise<ParameterRow[]> {
  if (isDemoMode()) {
    return demo.demoParameterHistory(tankId).slice(0, limit).reverse();
  }
  const sb = await createSupabaseServerClient();
  const { data } = await sb
    .from("parameters")
    .select("*")
    .eq("tank_id", tankId)
    .order("measured_at", { ascending: false })
    .limit(limit);
  return ((data as ParameterRow[] | null) ?? []).reverse();
}

export async function listLivestock(tankId: string): Promise<Livestock[]> {
  if (isDemoMode())
    return demo.DEMO_LIVESTOCK.filter((l) => l.tank_id === tankId);
  const sb = await createSupabaseServerClient();
  const { data } = await sb
    .from("livestock")
    .select("*")
    .eq("tank_id", tankId)
    .order("added_at", { ascending: false });
  return (data as Livestock[] | null) ?? [];
}

export async function listReminders(): Promise<Reminder[]> {
  if (isDemoMode())
    return [...demo.DEMO_REMINDERS].sort((a, b) =>
      a.due_at.localeCompare(b.due_at),
    );
  const sb = await createSupabaseServerClient();
  const { data } = await sb
    .from("reminders")
    .select("*")
    .eq("active", true)
    .order("due_at", { ascending: true });
  return (data as Reminder[] | null) ?? [];
}

export async function listDiagnoses(
  tankId?: string,
): Promise<demo.DemoDiagnosisRow[]> {
  if (isDemoMode()) {
    return demo.DEMO_DIAGNOSES.filter((d) => !tankId || d.tank_id === tankId);
  }
  const sb = await createSupabaseServerClient();
  let q = sb
    .from("diagnoses")
    .select("id,tank_id,kind,summary,urgency,created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  if (tankId) q = q.eq("tank_id", tankId);
  const { data } = await q;
  return (data as demo.DemoDiagnosisRow[] | null) ?? [];
}
