"use client";

import * as React from "react";
import {
  Check,
  Sparkles,
  ArrowRight,
  CreditCard,
  ShieldCheck,
  Loader2,
  Info,
  AlertTriangle,
} from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  TIERS,
  formatPrice,
  type SubTier,
  type TierDef,
  type TierPrice,
} from "@reef/shared";

type Interval = "month" | "year";

const ORDER: SubTier[] = ["free", "pro", "premium"];
const POPULAR: SubTier = "pro";

const TIER_RANK: Record<SubTier, number> = { free: 0, pro: 1, premium: 2 };

function priceFor(tier: TierDef, interval: Interval): TierPrice | null {
  return tier.prices.find((p) => p.interval === interval) ?? null;
}

/** Effective monthly cost of an annual plan, for an honest comparison. */
function monthlyEquivalent(amountCents: number): string {
  return formatPrice(Math.round(amountCents / 12));
}

/** A short, friendly note pinned below the panel — never a hard error. */
type Notice =
  | { kind: "info"; text: string }
  | { kind: "error"; text: string }
  | null;

export function BillingPanel({ currentTier }: { currentTier: SubTier }) {
  const [interval, setInterval] = React.useState<Interval>("month");
  /** lookupKey (or "portal") currently in-flight, so only one button spins. */
  const [pending, setPending] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<Notice>(null);

  /** Shared POST → { url } helper that handles the 503 not-configured case. */
  async function go(
    endpoint: string,
    body: Record<string, unknown> | undefined,
    key: string,
  ) {
    setNotice(null);
    setPending(key);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });

      if (res.status === 503) {
        // Stripe keys are an owner deliverable — degrade gracefully, no error.
        setNotice({
          kind: "info",
          text: "Billing isn't connected yet — the owner needs to add Stripe keys before checkout can open. Everything else works in the meantime.",
        });
        return;
      }

      const data = (await res.json().catch(() => null)) as
        | { url?: string; error?: string }
        | null;

      if (res.ok && data?.url) {
        window.location.assign(data.url);
        return;
      }

      setNotice({
        kind: "error",
        text:
          data?.error ??
          "We couldn't reach billing just now. Please try again in a moment.",
      });
    } catch {
      setNotice({
        kind: "error",
        text: "Network error reaching billing. Check your connection and try again.",
      });
    } finally {
      setPending(null);
    }
  }

  function checkout(lookupKey: string) {
    void go("/api/stripe/checkout", { lookupKey }, lookupKey);
  }

  function openPortal() {
    void go("/api/stripe/portal", undefined, "portal");
  }

  const onPaidPlan = currentTier !== "free";

  return (
    <div className="space-y-6">
      {/* Interval toggle + manage billing */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="group"
          aria-label="Billing interval"
          className="inline-flex items-center self-start rounded-full border border-white/10 bg-white/[0.04] p-1"
        >
          {(["month", "year"] as const).map((value) => {
            const active = interval === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setInterval(value)}
                aria-pressed={active}
                className={cn(
                  "relative rounded-full px-5 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-lagoon-400 focus-visible:ring-offset-2 focus-visible:ring-offset-abyss-950",
                  active
                    ? "bg-lagoon-500/90 text-abyss-950"
                    : "text-abyss-100/70 hover:text-abyss-50",
                )}
              >
                {value === "month" ? "Monthly" : "Annual"}
                {value === "year" && (
                  <span className="ml-1.5 hidden text-[0.7rem] font-medium text-abyss-950/70 sm:inline">
                    save ~17%
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {onPaidPlan && (
          <Button
            variant="secondary"
            onClick={openPortal}
            disabled={pending !== null}
            aria-busy={pending === "portal"}
          >
            {pending === "portal" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CreditCard className="h-4 w-4" />
            )}
            Manage billing
          </Button>
        )}
      </div>

      {/* Plan cards */}
      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        {ORDER.map((id) => {
          const tier = TIERS[id];
          const isPaid = tier.prices.length > 0;
          const price = isPaid ? priceFor(tier, interval) : null;
          const popular = id === POPULAR;
          const isCurrent = id === currentTier;
          const isDowngrade = TIER_RANK[id] < TIER_RANK[currentTier];

          return (
            <div
              key={id}
              className={cn(
                "reef-card relative flex h-full flex-col !rounded-3xl transition",
                isCurrent
                  ? "border-lagoon-400/50 shadow-glow ring-1 ring-lagoon-400/30"
                  : popular
                    ? "border-lagoon-400/25"
                    : "",
              )}
              aria-current={isCurrent ? "true" : undefined}
            >
              {/* Top badge: current plan wins over "most popular". */}
              {isCurrent ? (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge tone="healthy" className="shadow-glow">
                    <Check className="h-3.5 w-3.5" /> Your plan
                  </Badge>
                </span>
              ) : (
                popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge tone="brand">
                      <Sparkles className="h-3.5 w-3.5" /> Most popular
                    </Badge>
                  </span>
                )
              )}

              <div>
                <h3 className="font-display text-xl font-semibold text-abyss-50">
                  {tier.name}
                </h3>
                <p className="mt-1 text-sm text-abyss-100/65">{tier.tagline}</p>
              </div>

              {/* Price */}
              <div className="mt-6 min-h-[4.5rem]">
                {isPaid && price ? (
                  <>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-display text-4xl font-semibold text-abyss-50">
                        {interval === "year"
                          ? monthlyEquivalent(price.amount)
                          : formatPrice(price.amount)}
                      </span>
                      <span className="text-sm text-abyss-200/60">/ month</span>
                    </div>
                    <p className="mt-1 text-xs text-abyss-200/55">
                      {interval === "year"
                        ? `${formatPrice(price.amount)} billed yearly`
                        : "billed monthly"}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-display text-4xl font-semibold text-abyss-50">
                        Free
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-abyss-200/55">
                      forever, no card required
                    </p>
                  </>
                )}
              </div>

              {/* Trial note */}
              {isPaid && tier.trialDays > 0 && !isCurrent && (
                <p className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-lg bg-lagoon-500/10 px-2.5 py-1 text-xs font-medium text-lagoon-200">
                  <Sparkles className="h-3.5 w-3.5" />
                  {tier.trialDays}-day free trial
                </p>
              )}

              {/* CTA */}
              <div className="mt-6">
                {isCurrent ? (
                  <Button
                    variant="secondary"
                    className="w-full"
                    disabled
                    aria-disabled="true"
                  >
                    <Check className="h-4 w-4" /> Current plan
                  </Button>
                ) : !isPaid || !price ? (
                  // Free tier (or no price for the interval): managed via portal.
                  isDowngrade ? (
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={openPortal}
                      disabled={pending !== null}
                    >
                      <ArrowRight className="h-4 w-4 rotate-180" /> Downgrade
                    </Button>
                  ) : (
                    <Button variant="secondary" className="w-full" disabled>
                      Included
                    </Button>
                  )
                ) : isDowngrade ? (
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={openPortal}
                    disabled={pending !== null}
                    aria-busy={pending === "portal"}
                  >
                    {pending === "portal" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4 rotate-180" />
                    )}
                    Switch to {tier.name}
                  </Button>
                ) : (
                  <Button
                    variant={popular ? "primary" : "secondary"}
                    className="w-full"
                    onClick={() => checkout(price.lookupKey)}
                    disabled={pending !== null}
                    aria-busy={pending === price.lookupKey}
                  >
                    {pending === price.lookupKey ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Opening checkout…
                      </>
                    ) : (
                      <>
                        {onPaidPlan ? `Switch to ${tier.name}` : "Upgrade"}
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                )}
              </div>

              {/* Features */}
              <ul className="mt-7 space-y-3">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm">
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-lagoon-300"
                      aria-hidden
                    />
                    <span className="text-abyss-100/85">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Inline notice (aria-live so async outcomes are announced). */}
      <div aria-live="polite" className="min-h-[1.25rem]">
        {notice && (
          <div
            role={notice.kind === "error" ? "alert" : "note"}
            className={cn(
              "flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm leading-relaxed",
              notice.kind === "error"
                ? "border-coral-400/25 bg-coral-500/[0.08] text-coral-100"
                : "border-lagoon-400/20 bg-lagoon-500/[0.07] text-abyss-100/85",
            )}
          >
            {notice.kind === "error" ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-coral-300" />
            ) : (
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-lagoon-300" />
            )}
            <p>{notice.text}</p>
          </div>
        )}
      </div>

      {/* Secure-billing reassurance */}
      <p className="flex items-center justify-center gap-2 text-center text-xs text-abyss-200/55">
        <ShieldCheck className="h-4 w-4 text-lagoon-300" aria-hidden />
        Billing is handled securely by Stripe. We never see or store your card
        details.
      </p>
    </div>
  );
}
