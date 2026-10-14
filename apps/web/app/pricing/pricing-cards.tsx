"use client";

import * as React from "react";
import { Check, Sparkles, ArrowRight } from "lucide-react";
import { LinkButton, Badge } from "@/components/ui";
import { cn } from "@/lib/cn";
import { TIERS, formatPrice, type TierDef, type SubTier } from "@reef/shared";

type Interval = "month" | "year";

const ORDER: SubTier[] = ["free", "pro", "premium"];
const POPULAR: SubTier = "pro";

function priceFor(tier: TierDef, interval: Interval) {
  return tier.prices.find((p) => p.interval === interval) ?? null;
}

/** Effective monthly cost of an annual plan, for an honest comparison. */
function monthlyEquivalent(amountCents: number): string {
  return formatPrice(Math.round(amountCents / 12));
}

export function PricingCards() {
  const [interval, setInterval] = React.useState<Interval>("month");

  return (
    <div>
      {/* Billing interval toggle */}
      <div className="flex flex-col items-center gap-3">
        <div
          role="group"
          aria-label="Billing interval"
          className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] p-1"
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
              </button>
            );
          })}
        </div>
        <p
          className="h-5 text-xs font-medium text-lagoon-200"
          aria-live="polite"
        >
          {interval === "year" ? "Save ~17% with annual billing" : " "}
        </p>
      </div>

      {/* Tier cards */}
      <div className="mt-12 grid gap-6 lg:grid-cols-3 lg:items-start">
        {ORDER.map((id) => {
          const tier = TIERS[id];
          const isPaid = tier.prices.length > 0;
          const price = isPaid ? priceFor(tier, interval) : null;
          const popular = id === POPULAR;

          return (
            <div
              key={id}
              className={cn(
                "reef-card relative flex h-full flex-col !rounded-3xl",
                popular
                  ? "border-lagoon-400/40 shadow-glow lg:-mt-4 lg:pb-8 lg:pt-8"
                  : "",
              )}
            >
              {popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge tone="healthy" className="shadow-glow">
                    <Sparkles className="h-3.5 w-3.5" /> Most popular
                  </Badge>
                </span>
              )}

              <div>
                <h2 className="font-display text-xl font-semibold text-abyss-50">
                  {tier.name}
                </h2>
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
              {isPaid && tier.trialDays > 0 && (
                <p className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-lg bg-lagoon-500/10 px-2.5 py-1 text-xs font-medium text-lagoon-200">
                  <Sparkles className="h-3.5 w-3.5" />
                  {tier.trialDays}-day free trial
                </p>
              )}

              {/* CTA */}
              <div className="mt-6">
                <LinkButton
                  href="/signup"
                  variant={popular ? "primary" : "secondary"}
                  className="w-full"
                >
                  {isPaid ? (
                    <>
                      Start {tier.trialDays}-day trial{" "}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  ) : (
                    "Get started free"
                  )}
                </LinkButton>
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

      <p className="mt-10 text-center text-xs text-abyss-200/55">
        Prices in USD. Paid plans include a 7-day free trial — completing
        checkout requires a free account so we can manage your subscription
        securely.
      </p>
    </div>
  );
}
