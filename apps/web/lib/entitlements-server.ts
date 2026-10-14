/**
 * Server-side entitlements + usage enforcement .
 *
 * This is the gate every AI/feature route calls before doing expensive or
 * gated work. Entitlements are derived from the DB `subscriptions` row
 * (written ONLY by the Stripe webhook) and monthly usage from
 * `usage_counters` — never trusted from the client.
 *
 * Design notes:
 *  - The caller's RLS-scoped client (`supabase`) is passed in for reads of the
 *    owner's own `subscriptions`/`tanks` rows (RLS allows owner SELECT).
 *  - Usage reads/writes go through the SERVICE-ROLE admin client so the server
 *    can increment counters that the owner cannot write (RLS is select-only).
 *    The admin client is INJECTABLE via a small deps object for testing.
 *  - GRACEFUL DEGRADATION: when Supabase is not configured (`!features.supabase`)
 *    we return a synthetic free/active subscription and zero usage — never throw.
 */
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { features } from "@/lib/env";
import {
  checkChatUsage,
  checkPhotoUsage,
  checkTankLimit,
  getEntitlements,
  type Entitlements,
  type Subscription,
  type SubStatus,
  type SubTier,
} from "@reef/shared";

/**
 * The minimal slice of the Supabase query builder we depend on. Defining it
 * here (rather than importing the full `SupabaseClient`) lets tests pass plain
 * chainable mocks without standing up a real client.
 */
export interface SupabaseLike {
  from(table: string): SupabaseQueryLike;
}

export interface SupabaseQueryLike {
  select(columns?: string, opts?: { count?: "exact" | "planned" | "estimated"; head?: boolean }): SupabaseQueryLike;
  eq(column: string, value: unknown): SupabaseQueryLike;
  /** Resolves a single row or null (PostgREST `maybeSingle`). */
  maybeSingle(): Promise<{ data: unknown; error: unknown }>;
  /** Awaitable for count/head queries: `{ count, error }`. */
  then<TResult1 = SupabaseListResult, TResult2 = never>(
    onfulfilled?:
      | ((value: SupabaseListResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2>;
  /** Upsert for usage_counters writes (admin only). */
  upsert(values: unknown, opts?: { onConflict?: string }): Promise<{ error: unknown }>;
}

export interface SupabaseListResult {
  data: unknown[] | null;
  count: number | null;
  error: unknown;
}

export interface EntitlementsDeps {
  /** Service-role client for usage_counters reads/writes. */
  admin?: SupabaseLike;
}

/** Raw `subscriptions` row shape as stored in Postgres. */
interface SubscriptionRow {
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  tier: SubTier | null;
  status: string | null;
  price_id: string | null;
  current_period_end: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean | null;
}

const VALID_STATUSES: readonly SubStatus[] = [
  "active",
  "trialing",
  "past_due",
  "canceled",
  "inactive",
];

const VALID_TIERS: readonly SubTier[] = ["free", "pro", "premium"];

/** The synthetic free/active subscription used as a safe default. */
function freeSubscription(userId: string): Subscription {
  return {
    user_id: userId,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    tier: "free",
    status: "active",
    price_id: null,
    current_period_end: null,
    trial_end: null,
    cancel_at_period_end: false,
  };
}

/** Coerce an arbitrary DB row into a well-typed Subscription. */
function rowToSubscription(userId: string, row: SubscriptionRow): Subscription {
  const tier: SubTier =
    row.tier != null && VALID_TIERS.includes(row.tier) ? row.tier : "free";
  const status: SubStatus =
    row.status != null && VALID_STATUSES.includes(row.status as SubStatus)
      ? (row.status as SubStatus)
      : "inactive";
  return {
    user_id: userId,
    stripe_customer_id: row.stripe_customer_id ?? null,
    stripe_subscription_id: row.stripe_subscription_id ?? null,
    tier,
    status,
    price_id: row.price_id ?? null,
    current_period_end: row.current_period_end ?? null,
    trial_end: row.trial_end ?? null,
    cancel_at_period_end: row.cancel_at_period_end ?? false,
  };
}

/**
 * The current billing period as `'YYYY-MM'` in UTC. Usage counters bucket by
 * this string (matches `usage_counters.period`).
 */
export function currentPeriod(d: Date = new Date()): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Read the caller's `subscriptions` row via their RLS-scoped client. If there
 * is no row (or Supabase isn't configured), return a synthetic free/active
 * Subscription so downstream entitlement math always has a valid object.
 */
export async function getUserSubscription(
  supabase: SupabaseLike,
  userId: string,
): Promise<Subscription> {
  if (!features.supabase) return freeSubscription(userId);

  try {
    const { data, error } = await supabase
      .from("subscriptions")
      .select(
        "user_id, stripe_customer_id, stripe_subscription_id, tier, status, price_id, current_period_end, trial_end, cancel_at_period_end",
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (error || data == null) return freeSubscription(userId);
    return rowToSubscription(userId, data as SubscriptionRow);
  } catch {
    // Never crash the gate on a transport error — fall back to free.
    return freeSubscription(userId);
  }
}

/** The caller's effective entitlements, derived from their subscription. */
export async function getUserEntitlements(
  supabase: SupabaseLike,
  userId: string,
): Promise<Entitlements> {
  return getEntitlements(await getUserSubscription(supabase, userId));
}

/**
 * Read this period's usage counters for a user via the ADMIN client (RLS is
 * select-only for the owner; admin avoids surprises and matches how counters
 * are written). Defaults to zeros when no row exists or Supabase is off.
 */
export async function getMonthlyUsage(
  userId: string,
  deps: EntitlementsDeps = {},
): Promise<{ ai_chats: number; photo_diagnoses: number }> {
  const zero = { ai_chats: 0, photo_diagnoses: 0 };
  if (!features.supabase) return zero;

  try {
    const admin = deps.admin ?? (createSupabaseAdminClient() as unknown as SupabaseLike);
    const { data, error } = await admin
      .from("usage_counters")
      .select("ai_chats, photo_diagnoses")
      .eq("user_id", userId)
      .eq("period", currentPeriod())
      .maybeSingle();

    if (error || data == null) return zero;
    const row = data as { ai_chats?: number | null; photo_diagnoses?: number | null };
    return {
      ai_chats: row.ai_chats ?? 0,
      photo_diagnoses: row.photo_diagnoses ?? 0,
    };
  } catch {
    return zero;
  }
}

/**
 * Increment a usage counter for the current period via the ADMIN client.
 * Reads the current value then upserts the incremented row (the table's PK is
 * `(user_id, period)`). Best-effort: swallows errors so a counter write never
 * fails a user-facing request after the gated work already succeeded.
 */
export async function incrementUsage(
  userId: string,
  field: "ai_chats" | "photo_diagnoses",
  deps: EntitlementsDeps = {},
): Promise<void> {
  if (!features.supabase) return;

  try {
    const admin = deps.admin ?? (createSupabaseAdminClient() as unknown as SupabaseLike);
    const period = currentPeriod();

    const { data } = await admin
      .from("usage_counters")
      .select("ai_chats, photo_diagnoses")
      .eq("user_id", userId)
      .eq("period", period)
      .maybeSingle();

    const existing = (data ?? null) as
      | { ai_chats?: number | null; photo_diagnoses?: number | null }
      | null;
    const aiChats = existing?.ai_chats ?? 0;
    const photoDiagnoses = existing?.photo_diagnoses ?? 0;

    await admin.from("usage_counters").upsert(
      {
        user_id: userId,
        period,
        ai_chats: field === "ai_chats" ? aiChats + 1 : aiChats,
        photo_diagnoses:
          field === "photo_diagnoses" ? photoDiagnoses + 1 : photoDiagnoses,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,period" },
    );
  } catch {
    // Best-effort accounting; never throw from the increment path.
  }
}

export interface UsageEnforcement {
  allowed: boolean;
  upgradeTo?: SubTier;
  entitlements: Entitlements;
}

/** Gate an AI chat: entitlements + this month's chat usage. */
export async function enforceChat(
  supabase: SupabaseLike,
  userId: string,
  deps: EntitlementsDeps = {},
): Promise<UsageEnforcement> {
  const entitlements = await getUserEntitlements(supabase, userId);
  const usage = await getMonthlyUsage(userId, deps);
  const check = checkChatUsage(entitlements, usage.ai_chats);
  return {
    allowed: check.allowed,
    ...(check.upgradeTo ? { upgradeTo: check.upgradeTo } : {}),
    entitlements,
  };
}

/** Gate a photo diagnosis: entitlements + this month's diagnosis usage. */
export async function enforcePhoto(
  supabase: SupabaseLike,
  userId: string,
  deps: EntitlementsDeps = {},
): Promise<UsageEnforcement> {
  const entitlements = await getUserEntitlements(supabase, userId);
  const usage = await getMonthlyUsage(userId, deps);
  const check = checkPhotoUsage(entitlements, usage.photo_diagnoses);
  return {
    allowed: check.allowed,
    ...(check.upgradeTo ? { upgradeTo: check.upgradeTo } : {}),
    entitlements,
  };
}

/**
 * Gate creating a new tank: entitlements + current tank count (a head:true
 * exact count via the caller's RLS-scoped client — sees only their tanks).
 */
export async function enforceTankCreate(
  supabase: SupabaseLike,
  userId: string,
): Promise<UsageEnforcement> {
  const entitlements = await getUserEntitlements(supabase, userId);

  let count = 0;
  if (features.supabase) {
    try {
      const res = await supabase
        .from("tanks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      count = res.count ?? 0;
    } catch {
      count = 0;
    }
  }

  const check = checkTankLimit(entitlements, count);
  return {
    allowed: check.allowed,
    ...(check.upgradeTo ? { upgradeTo: check.upgradeTo } : {}),
    entitlements,
  };
}
