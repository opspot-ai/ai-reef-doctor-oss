import * as React from "react";
import Link from "next/link";
import { Calculator, ArrowLeft } from "lucide-react";
import { getActiveTank } from "@/lib/data";
import { SectionLabel, Badge, DisclaimerBanner } from "@/components/ui";
import type { TankType } from "@reef/shared";
import { DosingCalculator } from "./dosing-calculator";

export const metadata = {
  title: "Dosing Calculator · Reef Doctor",
  description:
    "Calculate alkalinity, calcium, magnesium, and copper doses with built-in safe-rate clamping. Always verify against your product's instructions.",
};

export default async function DosingPage({
  searchParams,
}: {
  searchParams: Promise<{ tank?: string }>;
}) {
  const { tank: tankParam } = await searchParams;
  const tank = await getActiveTank(tankParam);

  const toolsHref = tank ? `/tools?tank=${tank.id}` : "/tools";

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="space-y-3">
        <Link
          href={toolsHref}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-abyss-200/60 transition hover:text-lagoon-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-lagoon-400 focus-visible:ring-offset-2 focus-visible:ring-offset-abyss-950"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> All tools
        </Link>
        <SectionLabel>Dosing Calculator</SectionLabel>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-abyss-50 sm:text-4xl">
            Dose with confidence
          </h1>
          {tank && (
            <Badge tone="brand">
              <Calculator className="h-3.5 w-3.5" /> {tank.name}
            </Badge>
          )}
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-abyss-200/75">
          Estimate how much supplement to add to reach your target. Large
          changes are automatically spread over multiple days to protect your
          livestock. These are estimates for a standard supplement — your
          product&apos;s chart is always the authority.
        </p>
        <DisclaimerBanner />
      </header>

      <DosingCalculator
        defaultVolume={tank ? Math.round(tank.volume_liters) : undefined}
        tankType={tank?.type as TankType | undefined}
        tankName={tank?.name}
      />
    </div>
  );
}
