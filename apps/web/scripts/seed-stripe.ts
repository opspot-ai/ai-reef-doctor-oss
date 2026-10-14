/**
 * seed-stripe.ts — create/verify Stripe Products + Prices for each PAID tier
 * (TEST mode). Idempotent: a Price with a given lookup_key is created only if it
 * does not already exist; the Product is found by metadata.reef_tier or created.
 *
 * Run:  pnpm --filter @reef/web stripe:seed
 * Requires STRIPE_SECRET_KEY (TEST mode) in the environment.
 *
 * This is a one-off ops script (tsx), NOT shipped to any client bundle.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Stripe from "stripe";
import { PAID_TIERS, TIERS, type SubTier } from "@reef/shared";

const STRIPE_API_VERSION = "2026-06-24.synthetic" as const;

/**
 * Best-effort, dependency-free loader for `apps/web/.env.local` so the seed can
 * be run directly with `pnpm stripe:seed`. Existing process env wins; missing
 * file is silently ignored. (Next loads this automatically; tsx does not.)
 */
function loadEnvLocal(): void {
  try {
    const file = resolve(process.cwd(), ".env.local");
    const text = readFileSync(file, "utf8");
    for (const rawLine of text.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const k = line.slice(0, eq).trim();
      let v = line.slice(eq + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch {
    /* no .env.local — rely on the ambient environment. */
  }
}

async function main(): Promise<void> {
  loadEnvLocal();
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error(
      "✗ STRIPE_SECRET_KEY is not set. Add your Stripe TEST secret key to the " +
        "environment (e.g. apps/web/.env.local) before running the seed.",
    );
    process.exit(1);
  }
  if (!key.startsWith("sk_test_")) {
    console.warn(
      "⚠ STRIPE_SECRET_KEY does not look like a TEST key (sk_test_…). " +
        "This project is TEST-mode only — aborting to avoid touching live data.",
    );
    process.exit(1);
  }

  const stripe = new Stripe(key, { apiVersion: STRIPE_API_VERSION });

  console.log("Seeding Stripe catalog (TEST mode)…\n");

  const summary: string[] = [];

  for (const tierId of PAID_TIERS) {
    const tier = TIERS[tierId];
    const product = await findOrCreateProduct(stripe, tierId, tier.name);
    summary.push(`Product ${tier.name} → ${product.id}`);

    for (const priceDef of tier.prices) {
      const result = await findOrCreatePrice(stripe, {
        productId: product.id,
        lookupKey: priceDef.lookupKey,
        amount: priceDef.amount,
        interval: priceDef.interval,
      });
      summary.push(
        `  ${result.created ? "created" : "exists "} ${priceDef.lookupKey} ` +
          `(${formatUsd(priceDef.amount)}/${priceDef.interval}) → ${result.price.id}`,
      );
    }
  }

  console.log("\nSummary");
  console.log("───────");
  for (const line of summary) console.log(line);
  console.log("\n✓ Done.");
}

/** Find a Product tagged with metadata.reef_tier, or create it. */
async function findOrCreateProduct(
  stripe: Stripe,
  tierId: SubTier,
  name: string,
): Promise<Stripe.Product> {
  // Search isn't always enabled on fresh test accounts; list + filter instead.
  const existing = await stripe.products.list({ active: true, limit: 100 });
  const match = existing.data.find((p) => p.metadata?.reef_tier === tierId);
  if (match) {
    console.log(`• Product for "${tierId}" already exists: ${match.id}`);
    return match;
  }

  const product = await stripe.products.create({
    name: `AI Reef Doctor — ${name}`,
    metadata: { reef_tier: tierId },
  });
  console.log(`• Created product for "${tierId}": ${product.id}`);
  return product;
}

/** Find a Price by lookup_key, or create it bound to the product. */
async function findOrCreatePrice(
  stripe: Stripe,
  opts: {
    productId: string;
    lookupKey: string;
    amount: number;
    interval: "month" | "year";
  },
): Promise<{ price: Stripe.Price; created: boolean }> {
  const found = await stripe.prices.list({
    lookup_keys: [opts.lookupKey],
    limit: 1,
  });
  const existing = found.data[0];
  if (existing) {
    return { price: existing, created: false };
  }

  const price = await stripe.prices.create({
    product: opts.productId,
    currency: "usd",
    unit_amount: opts.amount,
    recurring: { interval: opts.interval },
    lookup_key: opts.lookupKey,
    transfer_lookup_key: true,
  });
  return { price, created: true };
}

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

main().catch((err) => {
  console.error("✗ Seed failed:", err);
  process.exit(1);
});
