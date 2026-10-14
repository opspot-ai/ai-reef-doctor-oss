"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { isDemoMode } from "./index";
import {
  TankInputSchema,
  ParameterReadingSchema,
  LivestockInputSchema,
} from "@reef/shared";

export type ActionResult =
  | { ok: true; id?: string; message?: string }
  | { ok: false; error: string; demo?: boolean };

const DEMO_BLOCK: ActionResult = {
  ok: false,
  demo: true,
  error: "Demo mode — add Supabase credentials (owner deliverable) to save changes.",
};

async function db() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  return { user, supabase };
}

export async function createTank(input: unknown): Promise<ActionResult> {
  if (isDemoMode()) return DEMO_BLOCK;
  const parsed = TankInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the tank details." };
  const { user, supabase } = await db();
  const { data, error } = await supabase
    .from("tanks")
    .insert({ ...parsed.data, user_id: user.id })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tanks");
  revalidatePath("/dashboard");
  return { ok: true, id: data.id as string };
}

export async function deleteTank(id: string): Promise<ActionResult> {
  if (isDemoMode()) return DEMO_BLOCK;
  const { supabase } = await db();
  const { error } = await supabase.from("tanks").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tanks");
  return { ok: true };
}

export async function logParameters(
  tankId: string,
  reading: unknown,
): Promise<ActionResult> {
  if (isDemoMode()) return DEMO_BLOCK;
  const parsed = ParameterReadingSchema.safeParse(reading);
  if (!parsed.success) return { ok: false, error: "Please check the readings." };
  const { user, supabase } = await db();
  const { error } = await supabase.from("parameters").insert({
    ...parsed.data,
    tank_id: tankId,
    user_id: user.id,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/parameters");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function addLivestock(input: unknown): Promise<ActionResult> {
  if (isDemoMode()) return DEMO_BLOCK;
  const parsed = LivestockInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the livestock details." };
  const { user, supabase } = await db();
  const { error } = await supabase
    .from("livestock")
    .insert({ ...parsed.data, user_id: user.id });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tanks");
  return { ok: true };
}

export async function createReminder(input: {
  tank_id: string;
  title: string;
  kind: string;
  due_at: string;
  recurrence?: string;
}): Promise<ActionResult> {
  if (isDemoMode()) return DEMO_BLOCK;
  const { user, supabase } = await db();
  const { error } = await supabase.from("reminders").insert({
    tank_id: input.tank_id,
    user_id: user.id,
    title: input.title,
    kind: input.kind,
    due_at: input.due_at,
    recurrence: input.recurrence ?? "none",
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/reminders");
  return { ok: true };
}

export async function completeReminder(id: string): Promise<ActionResult> {
  if (isDemoMode()) return DEMO_BLOCK;
  const { supabase } = await db();
  const { error } = await supabase
    .from("reminders")
    .update({ last_done_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/reminders");
  return { ok: true };
}

export async function deleteReminder(id: string): Promise<ActionResult> {
  if (isDemoMode()) return DEMO_BLOCK;
  const { supabase } = await db();
  const { error } = await supabase.from("reminders").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/reminders");
  return { ok: true };
}
