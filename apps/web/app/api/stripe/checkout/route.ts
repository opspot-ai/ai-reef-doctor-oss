import type Stripe from "stripe";
import { getRequestContext } from "@/lib/api-auth";
import { features, publicEnv } from "@/lib/env";
import { ApiErrors, jsonOk } from "@/lib/http";
import { getStripe } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { PAID_TIERS, TIERS, tierForLookupKey } from "@reef/shared";

export const runtime = "nodejs";

/**
 * POST /api/stripe/checkout  { lookupKey }
 * Creates a Stripe Checkout Session (subscription mode, 7-day trial on paid
 * tiers) for the signed-in user and returns its hosted URL.
 *
 * Customer resolution: reuse the stored `stripe_customer_id` if present, else
 * create a Stripe Customer (tagged with metadata.supabase_user_id) and persist
 * it to `subscriptions` via the ADMIN client (the only writer of that table).
 * Entitlements themselves are written later by the webhook — never here.
 */
export async function POST(req: Request) {
  const { user } = await getRequestContext(req);
  if (!user) return ApiErrors.unauthorized();

  if (!features.stripe) return ApiErrors.notConfigured("Billing");

  let lookupKey: unknown;
  try {
    const body = (await req.json()) as { lookupKey?: unknown };
    lookupKey = body.lookupKey;
  } catch {
    return ApiErrors.badRequest("Expected a JSON body with a lookupKey.");
  }

  if (typeof lookupKey !== "string" || lookupKey.length === 0) {
    return ApiErrors.badRequest("A lookupKey is required.");
  }

  // Only allow lookup keys that map to a real PAID tier in our catalog.
  const tier = tierForLookupKey(lookupKey);
  if (tier === null || !PAID_TIERS.includes(tier)) {
    return ApiErrors.badRequest("Unknown or non-purchasable plan.");
  }

  const stripe = getStripe();

  try {
    // 1) Find-or-create the Stripe Customer for this user.
    const customerId = await resolveCustomerId(stripe, user.id, user.email ?? null);

    // 2) Resolve the Price by its stable lookup_key.
    const prices = await stripe.prices.list({
      lookup_keys: [lookupKey],
      active: true,
      expand: ["data.product"],
      limit: 1,
    });
    const price = prices.data[0];
    if (!price) {
      return ApiErrors.notConfigured(
        `Pricing for "${lookupKey}" (run the Stripe seed script)`,
      );
    }

    // 3) Trial days from the catalog (paid tiers → 7).
    const trialDays = TIERS[tier].trialDays;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: price.id, quantity: 1 }],
      allow_promotion_codes: true,
      subscription_data: {
        ...(trialDays > 0 ? { trial_period_days: trialDays } : {}),
        metadata: { supabase_user_id: user.id },
      },
      success_url: `${publicEnv.siteUrl}/account?checkout=success`,
      cancel_url: `${publicEnv.siteUrl}/pricing?checkout=cancelled`,
    });

    if (!session.url) {
      return ApiErrors.serverError("Stripe did not return a checkout URL.");
    }
    return jsonOk({ url: session.url });
  } catch (err) {
    console.error("[stripe/checkout]", err);
    return ApiErrors.serverError("Could not start checkout. Please try again.");
  }
}

/**
 * Reuse this user's existing Stripe customer if we've stored one; otherwise
 * create one (tagged with the Supabase user id) and persist it to the
 * `subscriptions` table via the admin client so the webhook can correlate it.
 */
async function resolveCustomerId(
  stripe: Stripe,
  userId: string,
  email: string | null,
): Promise<string> {
  const admin = createSupabaseAdminClient();

  const { data: existing } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  const stored = existing?.stripe_customer_id as string | null | undefined;
  if (stored) return stored;

  const customer = await stripe.customers.create({
    ...(email ? { email } : {}),
    metadata: { supabase_user_id: userId },
  });

  // Upsert so a free-tier row (created on signup) gets the customer id, and a
  // brand-new row is created if somehow absent. Webhook owns tier/status.
  await admin
    .from("subscriptions")
    .upsert(
      { user_id: userId, stripe_customer_id: customer.id },
      { onConflict: "user_id" },
    );

  return customer.id;
}
