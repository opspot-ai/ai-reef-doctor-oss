import { getRequestContext } from "@/lib/api-auth";
import { features, publicEnv } from "@/lib/env";
import { ApiErrors, jsonOk } from "@/lib/http";
import { getStripe } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * POST /api/stripe/portal
 * Opens the Stripe Billing Portal for the signed-in user so they can change or
 * cancel their plan and manage payment methods. Returns the hosted portal URL.
 *
 * Requires a previously-created Stripe customer (set during checkout). If none
 * exists yet, there's nothing to manage → 400.
 */
export async function POST(req: Request) {
  const { user } = await getRequestContext(req);
  if (!user) return ApiErrors.unauthorized();

  if (!features.stripe) return ApiErrors.notConfigured("Billing");

  const admin = createSupabaseAdminClient();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const customerId = sub?.stripe_customer_id as string | null | undefined;
  if (!customerId) {
    return ApiErrors.badRequest("No billing account yet.");
  }

  try {
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${publicEnv.siteUrl}/account`,
    });
    return jsonOk({ url: session.url });
  } catch (err) {
    console.error("[stripe/portal]", err);
    return ApiErrors.serverError("Could not open the billing portal.");
  }
}
