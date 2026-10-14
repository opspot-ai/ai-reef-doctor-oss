import * as React from "react";
import { Users } from "lucide-react";
import { SectionLabel, DisclaimerBanner, Badge } from "@/components/ui";
import { CompatibilityChecker } from "./compatibility-checker";

export const metadata = {
  title: "Compatibility Checker · Reef Doctor",
  description:
    "Add two or more fish, corals, or inverts and get plain-language compatibility guidance grounded in a curated reef knowledge base. Fully offline.",
};

/**
 * Compatibility checker ( always-on). Deterministic and offline: the
 * client component runs the keyword retriever over the curated KNOWLEDGE corpus
 * plus a small set of built-in heuristics. Guidance only — no AI dependency.
 */
export default function CompatibilityPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <SectionLabel>Compatibility</SectionLabel>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-abyss-50 sm:text-4xl">
            Will they get along?
          </h1>
          <Badge tone="brand">
            <Users className="h-3.5 w-3.5" /> Guidance tool
          </Badge>
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-abyss-200/75">
          List the fish, corals, or inverts you&apos;re thinking of mixing, then
          assess. We&apos;ll surface relevant care notes from our knowledge base
          plus reef-keeping rules of thumb so you can plan stocking with eyes
          open. This is a heuristic starting point, not a guarantee.
        </p>
        <DisclaimerBanner />
      </header>

      <CompatibilityChecker />
    </div>
  );
}
