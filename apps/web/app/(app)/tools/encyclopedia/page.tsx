import * as React from "react";
import { BookOpen } from "lucide-react";
import { KNOWLEDGE } from "@reef/shared";
import { SectionLabel, DisclaimerBanner, Badge } from "@/components/ui";
import { EncyclopediaSearch } from "./encyclopedia-search";

export const metadata = {
  title: "Species & Care Encyclopedia · Reef Doctor",
  description:
    "Search a curated, citeable reef knowledge base — diseases, treatments, corals, algae, parameters, species care, and husbandry.",
};

/**
 * Species/care encyclopedia ( always-on). Fully deterministic and
 * offline: the page hands the entire curated KNOWLEDGE corpus to a client
 * component that filters by topic + free-text (via the keyword retriever).
 * No AI dependency.
 */
export default function EncyclopediaPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <SectionLabel>Encyclopedia</SectionLabel>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-abyss-50 sm:text-4xl">
            Species &amp; care encyclopedia
          </h1>
          <Badge tone="brand">
            <BookOpen className="h-3.5 w-3.5" /> {KNOWLEDGE.length} entries
          </Badge>
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-abyss-200/75">
          A curated, citeable reference for reef-keeping — disease guides,
          treatment protocols, coral and algae ID, parameter targets, and
          species care. Filter by topic or search in plain language; every entry
          names a reputable source.
        </p>
        <DisclaimerBanner />
      </header>

      <EncyclopediaSearch entries={KNOWLEDGE} />
    </div>
  );
}
