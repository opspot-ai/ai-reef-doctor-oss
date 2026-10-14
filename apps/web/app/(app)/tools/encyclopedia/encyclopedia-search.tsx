"use client";

import * as React from "react";
import {
  Search,
  BookOpen,
  Stethoscope,
  Pill,
  Sparkles,
  Leaf,
  FlaskConical,
  Fish,
  Library,
  X,
  type LucideIcon,
} from "lucide-react";
import { retrieve, type KnowledgeEntry } from "@reef/shared";
import {
  Card,
  SectionLabel,
  Badge,
  EmptyState,
} from "@/components/ui";
import { cn } from "@/lib/cn";

type Topic = KnowledgeEntry["topic"];
type Filter = "all" | Topic;

/** Topic presentation: label + icon + accent tone. Order is the chip order. */
const TOPICS: { id: Filter; label: string; icon: LucideIcon }[] = [
  { id: "all", label: "All", icon: Library },
  { id: "disease", label: "Disease", icon: Stethoscope },
  { id: "treatment", label: "Treatment", icon: Pill },
  { id: "coral", label: "Coral", icon: Sparkles },
  { id: "algae", label: "Algae & pests", icon: Leaf },
  { id: "params", label: "Parameters", icon: FlaskConical },
  { id: "species", label: "Species", icon: Fish },
  { id: "general", label: "Husbandry", icon: BookOpen },
];

const TOPIC_META: Record<
  Topic,
  { label: string; icon: LucideIcon }
> = {
  disease: { label: "Disease", icon: Stethoscope },
  treatment: { label: "Treatment", icon: Pill },
  coral: { label: "Coral", icon: Sparkles },
  algae: { label: "Algae & pests", icon: Leaf },
  params: { label: "Parameters", icon: FlaskConical },
  species: { label: "Species", icon: Fish },
  general: { label: "Husbandry", icon: BookOpen },
};

export function EncyclopediaSearch({
  entries,
}: {
  entries: KnowledgeEntry[];
}) {
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");

  // Count per topic for the filter chips (stable for the given corpus).
  const counts = React.useMemo(() => {
    const c: Record<string, number> = { all: entries.length };
    for (const e of entries) c[e.topic] = (c[e.topic] ?? 0) + 1;
    return c;
  }, [entries]);

  // Free-text uses the deterministic keyword retriever (relevance-ranked over
  // the whole corpus); an empty query keeps the natural corpus order. The topic
  // filter is applied after, so search + filter compose.
  const results = React.useMemo(() => {
    const trimmed = query.trim();
    const base = trimmed
      ? retrieve(trimmed, entries.length)
      : entries;
    if (filter === "all") return base;
    return base.filter((e) => e.topic === filter);
  }, [query, filter, entries]);

  const inputId = React.useId();
  const hasQuery = query.trim().length > 0;

  return (
    <div className="space-y-6">
      {/* Search + filters */}
      <Card className="space-y-4">
        <div>
          <label
            htmlFor={inputId}
            className="mb-2 block text-sm font-medium text-abyss-100"
          >
            Search the knowledge base
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-abyss-300/60"
              aria-hidden
            />
            <input
              id={inputId}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. ich treatment, dinoflagellates, alkalinity swing…"
              className="reef-input pl-10 pr-10"
              autoComplete="off"
            />
            {hasQuery && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-lg text-abyss-300/70 transition hover:bg-white/10 hover:text-abyss-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-lagoon-400"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <fieldset>
          <legend className="sr-only">Filter by topic</legend>
          <div className="flex flex-wrap gap-2">
            {TOPICS.map((t) => {
              const Icon = t.icon;
              const active = filter === t.id;
              const n = counts[t.id] ?? 0;
              if (t.id !== "all" && n === 0) return null;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFilter(t.id)}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition focus:outline-none focus-visible:ring-2 focus-visible:ring-lagoon-400 focus-visible:ring-offset-2 focus-visible:ring-offset-abyss-950",
                    active
                      ? "bg-lagoon-500/20 text-lagoon-100 ring-lagoon-400/40"
                      : "bg-white/5 text-abyss-200/75 ring-white/10 hover:bg-white/10 hover:text-abyss-50",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {t.label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[10px] tabular-nums",
                      active ? "bg-lagoon-400/20" : "bg-white/10",
                    )}
                  >
                    {n}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      </Card>

      {/* Result count (aria-live so screen readers hear filter changes) */}
      <p
        className="text-sm text-abyss-200/65"
        role="status"
        aria-live="polite"
      >
        {results.length === 0
          ? "No matching entries"
          : `${results.length} ${results.length === 1 ? "entry" : "entries"}`}
        {hasQuery && results.length > 0 && (
          <>
            {" "}
            <span className="text-abyss-200/45">
              · sorted by relevance to “{query.trim()}”
            </span>
          </>
        )}
      </p>

      {/* Results / empty / no-results */}
      {results.length === 0 ? (
        hasQuery ? (
          <EmptyState
            icon={Search}
            title="No results"
            description={`Nothing matched “${query.trim()}”${
              filter !== "all" ? " in this topic" : ""
            }. Try a broader term, fix the spelling, or clear filters.`}
          />
        ) : (
          <EmptyState
            icon={BookOpen}
            title="No entries in this topic"
            description="Pick another topic or search across the whole library."
          />
        )
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {results.map((entry) => (
            <li key={entry.id}>
              <EntryCard entry={entry} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EntryCard({ entry }: { entry: KnowledgeEntry }) {
  const meta = TOPIC_META[entry.topic];
  const Icon = meta.icon;
  return (
    <Card className="flex h-full flex-col">
      <div className="mb-2 flex items-start justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-lagoon-300">
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {meta.label}
        </span>
      </div>
      <h3 className="font-display text-lg font-semibold leading-snug text-abyss-50">
        {entry.title}
      </h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-abyss-100/80">
        {entry.body}
      </p>

      {entry.tags.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Tags">
          {entry.tags.slice(0, 6).map((tag) => (
            <li key={tag}>
              <Badge>{tag}</Badge>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 border-t border-white/5 pt-3">
        <SectionLabel>Source</SectionLabel>
        <Badge tone="brand">{entry.source}</Badge>
      </div>
    </Card>
  );
}
