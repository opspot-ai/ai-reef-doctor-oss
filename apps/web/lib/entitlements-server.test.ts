import { describe, expect, it, vi } from "vitest";

// Make Supabase appear configured so the gate exercises real DB code paths,
// and stub the admin client factory (we inject mocks instead). These mocks are
// hoisted above the import of the module under test.
vi.mock("@/lib/env", () => ({
  features: { supabase: true, stripe: false, ai: false, email: false },
  serverEnv: {},
  publicEnv: {},
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: () => {
    throw new Error("admin client must be injected in tests");
  },
}));

import {
  currentPeriod,
  getUserSubscription,
  getUserEntitlements,
  getMonthlyUsage,
  incrementUsage,
  enforceChat,
  enforcePhoto,
  enforceTankCreate,
  type SupabaseLike,
} from "@/lib/entitlements-server";

const USER = "11111111-1111-1111-1111-111111111111";

/**
 * A tiny chainable mock implementing SupabaseLike. Per (table) you can stage:
 *  - `single`: the row returned by `.maybeSingle()`
 *  - `count`:  the count returned when the chain is awaited (head:true queries)
 * It records upsert calls for assertions.
 */
function makeMock(
  staged: Record<
    string,
    { single?: unknown; count?: number; error?: unknown }
  >,
): SupabaseLike & { upserts: unknown[] } {
  const upserts: unknown[] = [];

  function query(table: string) {
    const cfg = staged[table] ?? {};
    const builder: Record<string, unknown> = {};
    builder.select = () => builder;
    builder.eq = () => builder;
    builder.maybeSingle = async () => ({
      data: cfg.single ?? null,
      error: cfg.error ?? null,
    });
    // Awaitable for count/head queries.
    builder.then = (
      onfulfilled?: (v: {
        data: unknown[] | null;
        count: number | null;
        error: unknown;
      }) => unknown,
    ) =>
      Promise.resolve({
        data: null,
        count: cfg.count ?? null,
        error: cfg.error ?? null,
      }).then(onfulfilled);
    builder.upsert = async (values: unknown) => {
      upserts.push({ table, values });
      return { error: null };
    };
    return builder as unknown as ReturnType<SupabaseLike["from"]>;
  }

  return {
    from: (table: string) => query(table),
    upserts,
  };
}

describe("currentPeriod", () => {
  it("formats a known UTC date to YYYY-MM", () => {
    expect(currentPeriod(new Date("2026-06-24T12:00:00Z"))).toBe("2026-06");
    expect(currentPeriod(new Date("2026-01-01T00:00:00Z"))).toBe("2026-01");
    expect(currentPeriod(new Date("2025-12-31T23:59:59Z"))).toBe("2025-12");
  });

  it("uses UTC, not local time, near a month boundary", () => {
    // 2026-03-01T00:30:00Z is still March in UTC regardless of local TZ.
    expect(currentPeriod(new Date("2026-03-01T00:30:00Z"))).toBe("2026-03");
  });
});

describe("getUserSubscription", () => {
  it("maps a present row to a Subscription", async () => {
    const supabase = makeMock({
      subscriptions: {
        single: {
          user_id: USER,
          stripe_customer_id: "cus_123",
          stripe_subscription_id: "sub_123",
          tier: "pro",
          status: "active",
          price_id: "price_123",
          current_period_end: "2026-07-24T00:00:00Z",
          trial_end: null,
          cancel_at_period_end: false,
        },
      },
    });

    const sub = await getUserSubscription(supabase, USER);
    expect(sub.tier).toBe("pro");
    expect(sub.status).toBe("active");
    expect(sub.stripe_customer_id).toBe("cus_123");
    expect(sub.user_id).toBe(USER);
  });

  it("returns a free/active default when no row exists", async () => {
    const supabase = makeMock({ subscriptions: { single: null } });
    const sub = await getUserSubscription(supabase, USER);
    expect(sub.tier).toBe("free");
    expect(sub.status).toBe("active");
    expect(sub.stripe_customer_id).toBeNull();
    expect(sub.user_id).toBe(USER);
  });

  it("falls back to free when the query errors", async () => {
    const supabase = makeMock({
      subscriptions: { single: null, error: { message: "boom" } },
    });
    const sub = await getUserSubscription(supabase, USER);
    expect(sub.tier).toBe("free");
    expect(sub.status).toBe("active");
  });
});

describe("getUserEntitlements", () => {
  it("derives entitlements from the subscription tier", async () => {
    const proSupabase = makeMock({
      subscriptions: { single: { user_id: USER, tier: "pro", status: "active" } },
    });
    const ent = await getUserEntitlements(proSupabase, USER);
    expect(ent.tier).toBe("pro");
    expect(ent.active).toBe(true);
    expect(ent.aiChatsPerMonth).toBe(Infinity);
  });

  it("free default has the free caps", async () => {
    const freeSupabase = makeMock({ subscriptions: { single: null } });
    const ent = await getUserEntitlements(freeSupabase, USER);
    expect(ent.tier).toBe("free");
    expect(ent.aiChatsPerMonth).toBe(5);
    expect(ent.maxTanks).toBe(1);
  });
});

describe("getMonthlyUsage", () => {
  it("returns the row counts via the injected admin client", async () => {
    const admin = makeMock({
      usage_counters: { single: { ai_chats: 3, photo_diagnoses: 1 } },
    });
    const usage = await getMonthlyUsage(USER, { admin });
    expect(usage).toEqual({ ai_chats: 3, photo_diagnoses: 1 });
  });

  it("defaults to zeros when no counter row exists", async () => {
    const admin = makeMock({ usage_counters: { single: null } });
    const usage = await getMonthlyUsage(USER, { admin });
    expect(usage).toEqual({ ai_chats: 0, photo_diagnoses: 0 });
  });
});

describe("incrementUsage", () => {
  it("upserts an incremented counter for the current period", async () => {
    const admin = makeMock({
      usage_counters: { single: { ai_chats: 4, photo_diagnoses: 0 } },
    });
    await incrementUsage(USER, "ai_chats", { admin });

    expect(admin.upserts).toHaveLength(1);
    const call = admin.upserts[0] as {
      table: string;
      values: { ai_chats: number; photo_diagnoses: number; period: string };
    };
    expect(call.table).toBe("usage_counters");
    expect(call.values.ai_chats).toBe(5);
    expect(call.values.photo_diagnoses).toBe(0);
    expect(call.values.period).toBe(currentPeriod());
  });

  it("starts at 1 when there is no existing row", async () => {
    const admin = makeMock({ usage_counters: { single: null } });
    await incrementUsage(USER, "photo_diagnoses", { admin });
    const call = admin.upserts[0] as {
      values: { ai_chats: number; photo_diagnoses: number };
    };
    expect(call.values.photo_diagnoses).toBe(1);
    expect(call.values.ai_chats).toBe(0);
  });
});

describe("enforceChat", () => {
  it("blocks a free user who has used 5 chats and suggests pro", async () => {
    const supabase = makeMock({ subscriptions: { single: null } });
    const admin = makeMock({
      usage_counters: { single: { ai_chats: 5, photo_diagnoses: 0 } },
    });
    const res = await enforceChat(supabase, USER, { admin });
    expect(res.allowed).toBe(false);
    expect(res.upgradeTo).toBe("pro");
    expect(res.entitlements.tier).toBe("free");
  });

  it("allows a free user who has used 2 chats", async () => {
    const supabase = makeMock({ subscriptions: { single: null } });
    const admin = makeMock({
      usage_counters: { single: { ai_chats: 2, photo_diagnoses: 0 } },
    });
    const res = await enforceChat(supabase, USER, { admin });
    expect(res.allowed).toBe(true);
    expect(res.upgradeTo).toBeUndefined();
  });

  it("always allows a pro user regardless of usage", async () => {
    const supabase = makeMock({
      subscriptions: { single: { user_id: USER, tier: "pro", status: "active" } },
    });
    const admin = makeMock({
      usage_counters: { single: { ai_chats: 9999, photo_diagnoses: 0 } },
    });
    const res = await enforceChat(supabase, USER, { admin });
    expect(res.allowed).toBe(true);
    expect(res.upgradeTo).toBeUndefined();
  });
});

describe("enforcePhoto", () => {
  it("blocks a free user who has used their 1 trial diagnosis", async () => {
    const supabase = makeMock({ subscriptions: { single: null } });
    const admin = makeMock({
      usage_counters: { single: { ai_chats: 0, photo_diagnoses: 1 } },
    });
    const res = await enforcePhoto(supabase, USER, { admin });
    expect(res.allowed).toBe(false);
    expect(res.upgradeTo).toBe("pro");
  });

  it("allows a free user with 0 diagnoses used", async () => {
    const supabase = makeMock({ subscriptions: { single: null } });
    const admin = makeMock({
      usage_counters: { single: { ai_chats: 0, photo_diagnoses: 0 } },
    });
    const res = await enforcePhoto(supabase, USER, { admin });
    expect(res.allowed).toBe(true);
  });
});

describe("enforceTankCreate", () => {
  it("blocks a free user who already has 1 tank and suggests pro", async () => {
    const supabase = makeMock({
      subscriptions: { single: null },
      tanks: { count: 1 },
    });
    const res = await enforceTankCreate(supabase, USER);
    expect(res.allowed).toBe(false);
    expect(res.upgradeTo).toBe("pro");
  });

  it("allows a free user with 0 tanks", async () => {
    const supabase = makeMock({
      subscriptions: { single: null },
      tanks: { count: 0 },
    });
    const res = await enforceTankCreate(supabase, USER);
    expect(res.allowed).toBe(true);
  });

  it("allows a pro user up to 5 tanks", async () => {
    const supabase = makeMock({
      subscriptions: { single: { user_id: USER, tier: "pro", status: "active" } },
      tanks: { count: 4 },
    });
    const res = await enforceTankCreate(supabase, USER);
    expect(res.allowed).toBe(true);
  });
});
