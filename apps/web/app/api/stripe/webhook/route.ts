import type Stripe from "stripe";
import { features, serverEnv } from "@/lib/env";
import { ApiErrors } from "@/lib/http";
import { getStripe } from "@/lib/stripe";
import {
  subscriptionRowFromStripeSub,
  type MinimalStripeSubscription,
} from "@/lib/stripe-events";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

// MUST run on the Node.js runtime: we need the raw request body (no edge
// streaming transforms) for Stripe signature verification.
export const runtime = "nodejs";

/**
 * POST /api/stripe/webhook — Stripe event sink (TEST mode).
 *
 * Hard requirements ():
 *  - Read the RAW body (`req.text()`); verify the signature with the webhook
 *    secret; reject with 400 on signature failure.
 *  - Idempotent handlers: every path upserts `subscriptions` by `user_id`, so
 *    re-delivering the same event is safe.
 *  - Writes go through the ADMIN (service-role) client only — `subscriptions`
 *    has no client write policy; the webhook is the single writer.
 *  - Always return 200 quickly once the event is accepted (even on a handled,
 *    no-op event) so Stripe does not retry forever.
 */
export async function POST(req: Request) {
  if (!features.stripe || !serverEnv.stripeWebhookSecret) {
    return ApiErrors.notConfigured("Stripe webhook");
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return ApiErrors.badRequest("Missing stripe-signature header.");
  }

  const rawBody = await req.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      serverEnv.stripeWebhookSecret,
    );
  } catch (err) {
    console.error("[stripe/webhook] signature verification failed", err);
    return ApiErrors.badRequest("Invalid signature.");
  }

  try {
    await handleEvent(stripe, event);
  } catch (err) {
    // Log and 500 so Stripe retries — handlers are idempotent, so retries are
    // safe. We never throw past here uncaught.
    console.error(`[stripe/webhook] handler error for ${event.type}`, err);
    return ApiErrors.serverError("Webhook handler failed.");
  }

  // Accepted. (Unhandled event types also fall through to here as a 200 no-op.)
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

async function handleEvent(stripe: Stripe, event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await onCheckoutCompleted(stripe, session);
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as unknown as MinimalStripeSubscription;
      await onSubscriptionUpsert(stripe, sub);
      return;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as unknown as MinimalStripeSubscription;
      await onSubscriptionDeleted(stripe, sub);
      return;
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      await onInvoiceEvent(stripe, invoice);
      return;
    }
    default:
      // Unhandled — accepted as a no-op.
      return;
  }
}

// ─────────────────────────── handlers ───────────────────────────

async function onCheckoutCompleted(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const userId =
    session.client_reference_id ??
    (typeof session.metadata?.supabase_user_id === "string"
      ? session.metadata.supabase_user_id
      : null);

  const customerId = idOf(session.customer);
  const subscriptionId = idOf(session.subscription);

  // Persist the customer id immediately (so portal/correlation works) even if
  // the subscription.* events arrive separately.
  if (userId && customerId) {
    await upsertSubscription({
      user_id: userId,
      stripe_customer_id: customerId,
    });
  }

  // Pull the full subscription and write its tier/status/period.
  if (subscriptionId) {
    const full = await retrieveSubscription(stripe, subscriptionId);
    if (full) {
      const resolvedUserId =
        userId ??
        subMetadataUserId(full) ??
        (await userIdForCustomer(customerId));
      if (resolvedUserId) {
        await writeSubscriptionRow(resolvedUserId, customerId, full);
      }
    }
  }
}

async function onSubscriptionUpsert(
  stripe: Stripe,
  sub: MinimalStripeSubscription,
): Promise<void> {
  const raw = sub as MinimalStripeSubscription & {
    customer?: string | { id?: string } | null;
  };
  const customerId = idOf(raw.customer ?? null);
  const userId =
    subMetadataUserId(sub) ?? (await userIdForCustomer(customerId));
  if (!userId) {
    console.warn(
      `[stripe/webhook] no user for subscription ${sub.id} (customer=${customerId})`,
    );
    return;
  }
  await writeSubscriptionRow(userId, customerId, sub);
}

async function onSubscriptionDeleted(
  _stripe: Stripe,
  sub: MinimalStripeSubscription,
): Promise<void> {
  const raw = sub as MinimalStripeSubscription & {
    customer?: string | { id?: string } | null;
  };
  const customerId = idOf(raw.customer ?? null);
  const userId =
    subMetadataUserId(sub) ?? (await userIdForCustomer(customerId));
  if (!userId) return;

  // Hard reset to free/canceled regardless of the prior tier.
  await upsertSubscription({
    user_id: userId,
    ...(customerId ? { stripe_customer_id: customerId } : {}),
    stripe_subscription_id: sub.id,
    tier: "free",
    status: "canceled",
    cancel_at_period_end: false,
  });
}

async function onInvoiceEvent(
  stripe: Stripe,
  invoice: Stripe.Invoice,
): Promise<void> {
  // Re-sync the subscription state after a payment succeeds/fails so status
  // (active ↔ past_due) and the period end stay current. Idempotent.
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId) return;

  const full = await retrieveSubscription(stripe, subscriptionId);
  if (!full) return;

  const customerId = idOf(invoice.customer);
  const userId =
    subMetadataUserId(full) ?? (await userIdForCustomer(customerId));
  if (!userId) return;

  await writeSubscriptionRow(userId, customerId, full);
}

// ─────────────────────────── helpers ───────────────────────────

/** Write the mapped subscription row (tier/status/period) for a user. */
async function writeSubscriptionRow(
  userId: string,
  customerId: string | null,
  sub: MinimalStripeSubscription,
): Promise<void> {
  const row = subscriptionRowFromStripeSub(sub);
  await upsertSubscription({
    user_id: userId,
    ...(customerId ? { stripe_customer_id: customerId } : {}),
    ...row,
  });
}

interface SubscriptionUpsert {
  user_id: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  tier?: "free" | "pro" | "premium";
  status?: string;
  price_id?: string | null;
  current_period_end?: string | null;
  trial_end?: string | null;
  cancel_at_period_end?: boolean;
}

/** Idempotent upsert keyed by user_id — re-processing an event is safe. */
async function upsertSubscription(row: SubscriptionUpsert): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("subscriptions")
    .upsert(row, { onConflict: "user_id" });
  if (error) {
    throw new Error(`subscriptions upsert failed: ${error.message}`);
  }
}

/** Look up the user_id we previously stored for a Stripe customer. */
async function userIdForCustomer(
  customerId: string | null,
): Promise<string | null> {
  if (!customerId) return null;
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return (data?.user_id as string | undefined) ?? null;
}

/** Read supabase_user_id from a subscription's metadata, if present. */
function subMetadataUserId(sub: MinimalStripeSubscription): string | null {
  const meta = (sub as { metadata?: Record<string, unknown> | null }).metadata;
  const v = meta?.supabase_user_id;
  return typeof v === "string" && v.length > 0 ? v : null;
}

/** Retrieve a subscription with its items + price expanded for mapping. */
async function retrieveSubscription(
  stripe: Stripe,
  subscriptionId: string,
): Promise<MinimalStripeSubscription | null> {
  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["items.data.price"],
    });
    return sub as unknown as MinimalStripeSubscription;
  } catch (err) {
    console.error(
      `[stripe/webhook] failed to retrieve subscription ${subscriptionId}`,
      err,
    );
    return null;
  }
}

/** Normalize a Stripe expandable (string id | object | null) to its id. */
function idOf(
  ref: string | { id?: string } | null | undefined,
): string | null {
  if (!ref) return null;
  if (typeof ref === "string") return ref;
  return ref.id ?? null;
}

/**
 * The subscription id attached to an invoice. Across API versions this lives
 * either on `invoice.subscription` or nested under
 * `invoice.parent.subscription_details.subscription` (basil+). Read defensively.
 */
function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const direct = idOf(
    (invoice as unknown as { subscription?: string | { id?: string } | null })
      .subscription ?? null,
  );
  if (direct) return direct;

  const parent = (
    invoice as unknown as {
      parent?: {
        subscription_details?: {
          subscription?: string | { id?: string } | null;
        } | null;
      } | null;
    }
  ).parent;
  return idOf(parent?.subscription_details?.subscription ?? null);
}
