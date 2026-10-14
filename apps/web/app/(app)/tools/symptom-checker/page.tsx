import * as React from "react";
import Link from "next/link";
import { Stethoscope, ArrowLeft } from "lucide-react";
import { getActiveTank } from "@/lib/data";
import { SectionLabel, Badge, DisclaimerBanner } from "@/components/ui";
import { SymptomChecker } from "./symptom-checker";

export const metadata = {
  title: "Symptom Checker · Reef Doctor",
  description:
    "Answer a few guided questions to get a deterministic, ranked shortlist of likely fish and reef conditions, grounded in curated reef knowledge.",
};

export default async function SymptomCheckerPage({
  searchParams,
}: {
  searchParams: Promise<{ tank?: string }>;
}) {
  const { tank: tankParam } = await searchParams;
  const tank = await getActiveTank(tankParam);

  const toolsHref = tank ? `/tools?tank=${tank.id}` : "/tools";
  const diagnoseHref = tank ? `/diagnose?tank=${tank.id}` : "/diagnose";

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
        <SectionLabel>Symptom Checker</SectionLabel>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-abyss-50 sm:text-4xl">
            What&apos;s troubling your reef?
          </h1>
          {tank && (
            <Badge tone="brand">
              <Stethoscope className="h-3.5 w-3.5" /> {tank.name}
            </Badge>
          )}
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-abyss-200/75">
          Answer a few quick questions and we&apos;ll match your observations
          against our curated reef knowledge base to rank the most likely
          conditions. This is a starting point — for a photo-based assessment,
          hand it off to the Reef Doctor.
        </p>
        <DisclaimerBanner />
      </header>

      <SymptomChecker diagnoseHref={diagnoseHref} />
    </div>
  );
}
