"use client";

import * as React from "react";
import {
  Plus,
  X,
  Users,
  ShieldCheck,
  AlertTriangle,
  Info,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { retrieve, type KnowledgeEntry } from "@reef/shared";
import {
  Card,
  SectionLabel,
  Button,
  Badge,
  DisclaimerBanner,
  EmptyState,
} from "@/components/ui";
import { cn } from "@/lib/cn";

/* ─────────────────────────── Built-in heuristics ───────────────────────────
 * Lightweight, deterministic rules-of-thumb keyed on common species/keywords.
 * These are intentionally conservative reef-keeping generalizations, clearly
 * labeled as guidance. They do NOT depend on the AI or any network call.
 */

type RuleLevel = "caution" | "watch" | "note";

interface Rule {
  /** Keyword groups that must each have a matching item for the rule to fire. */
  when: string[][];
  level: RuleLevel;
  title: string;
  detail: string;
}

const RULES: Rule[] = [
  {
    when: [["tang", "surgeonfish"], ["tang", "surgeonfish"]],
    level: "caution",
    title: "Multiple tangs together",
    detail:
      "Tangs are territorial toward similar-shaped fish. Mixing species needs a large footprint (often 5–6+ ft), adding them together, and differing body shapes/colors to reduce aggression.",
  },
  {
    when: [["clownfish", "clown"], ["clownfish", "clown"]],
    level: "watch",
    title: "More than one clownfish",
    detail:
      "Clownfish do best as a bonded pair of the SAME species. Two unrelated adults, or mixing species, often leads to fighting. Add them young and together.",
  },
  {
    when: [["shrimp", "cleaner shrimp", "peppermint"], ["wrasse", "hawkfish", "puffer", "trigger", "dottyback"]],
    level: "caution",
    title: "Shrimp with opportunistic predators",
    detail:
      "Larger wrasses, hawkfish, puffers, and triggers may pick at or eat ornamental shrimp. Provide cover, or skip the shrimp with confirmed shrimp-eaters.",
  },
  {
    when: [["coral", "sps", "lps", "softie", "zoa"], ["puffer", "angelfish", "angel", "butterfly", "butterflyfish"]],
    level: "caution",
    title: "Corals with known coral-nippers",
    detail:
      "Many angelfish and butterflyfish (and some puffers) nip coral and inverts. They suit FOWLR tanks; in a reef they are a calculated risk that varies by individual.",
  },
  {
    when: [["anemone", "nem"], ["sps", "acropora", "montipora"]],
    level: "watch",
    title: "Mobile anemone near fixed corals",
    detail:
      "Anemones wander and sting. Give them their own rock island away from prized corals, and accept they may relocate where flow and light suit them.",
  },
  {
    when: [["damsel", "damselfish"], ["damsel", "damselfish"]],
    level: "watch",
    title: "Multiple damsels",
    detail:
      "Damsels are scrappy and territorial. Multiples can bully each other and later additions. Stock cautiously, ideally last, with plenty of rockwork.",
  },
  {
    when: [["mandarin", "dragonet"], ["mandarin", "dragonet"]],
    level: "watch",
    title: "Mandarins / dragonets",
    detail:
      "These are picky pod-eaters that need a mature tank with a thriving copepod population and rarely tolerate conspecifics outside a male/female pair.",
  },
];

/* Topic / keyword hints used to bias the retrieval query toward compatibility,
 * aggression, and stocking guidance rather than disease content. */
const COMPAT_HINT = "compatibility aggression stocking order temperament predators reef safe";

/* ─────────────────────────── Component ─────────────────────────── */

interface Assessment {
  items: string[];
  fired: Rule[];
  knowledge: KnowledgeEntry[];
}

const LEVEL_META: Record<
  RuleLevel,
  { tone: "danger" | "caution" | "healthy"; icon: LucideIcon; label: string }
> = {
  caution: { tone: "danger", icon: AlertTriangle, label: "Watch closely" },
  watch: { tone: "caution", icon: Info, label: "Plan ahead" },
  note: { tone: "healthy", icon: Info, label: "Good to know" },
};

export function CompatibilityChecker() {
  const [draft, setDraft] = React.useState("");
  const [items, setItems] = React.useState<string[]>([]);
  const [result, setResult] = React.useState<Assessment | null>(null);
  const inputId = React.useId();

  function addItem() {
    const v = draft.trim();
    if (!v) return;
    // De-dupe case-insensitively.
    if (items.some((i) => i.toLowerCase() === v.toLowerCase())) {
      setDraft("");
      return;
    }
    setItems((prev) => [...prev, v]);
    setDraft("");
    setResult(null);
  }

  function removeItem(target: string) {
    setItems((prev) => prev.filter((i) => i !== target));
    setResult(null);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addItem();
    }
  }

  function assess() {
    const lower = items.map((i) => i.toLowerCase());
    const text = lower.join(" ");

    // Fire a rule when each of its keyword groups is satisfied by a DISTINCT
    // item (so "tang + tang" needs two tangs, while "tang + shrimp" needs one
    // of each). Distinctness avoids one item satisfying both halves of a rule.
    const fired: Rule[] = RULES.filter((rule) => {
      const used = new Set<number>();
      return rule.when.every((group) => {
        const idx = lower.findIndex(
          (item, i) =>
            !used.has(i) && group.some((kw) => item.includes(kw)),
        );
        if (idx === -1) return false;
        used.add(idx);
        return true;
      });
    });

    // Ground with the knowledge retriever: combine the items with a
    // compatibility-oriented hint so we pull stocking/aggression entries.
    const query = `${text} ${COMPAT_HINT}`;
    const knowledge = retrieve(query, 4);

    setResult({ items: [...items], fired, knowledge });
  }

  const canAssess = items.length >= 2;

  return (
    <div className="space-y-6">
      {/* Builder */}
      <Card className="space-y-4">
        <div>
          <label
            htmlFor={inputId}
            className="mb-2 block text-sm font-medium text-abyss-100"
          >
            Add a fish, coral, or invert
          </label>
          <div className="flex gap-2">
            <input
              id={inputId}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Yellow tang, Cleaner shrimp, Acropora…"
              className="reef-input"
              autoComplete="off"
              aria-describedby={`${inputId}-hint`}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={addItem}
              disabled={!draft.trim()}
              aria-label="Add item"
            >
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
          <p id={`${inputId}-hint`} className="mt-1.5 text-xs text-abyss-200/55">
            Press Enter to add. Add at least two to assess.
          </p>
        </div>

        {/* Chips */}
        {items.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Items to assess">
            {items.map((item) => (
              <li key={item}>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 py-1 pl-3 pr-1.5 text-sm text-abyss-50 ring-1 ring-inset ring-white/10">
                  {item}
                  <button
                    type="button"
                    onClick={() => removeItem(item)}
                    aria-label={`Remove ${item}`}
                    className="grid h-5 w-5 place-items-center rounded-full text-abyss-300/70 transition hover:bg-coral-500/20 hover:text-coral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-lagoon-400"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-3 pt-1">
          <Button type="button" onClick={assess} disabled={!canAssess}>
            <Users className="h-4 w-4" /> Assess compatibility
          </Button>
          {!canAssess && (
            <span className="text-xs text-abyss-200/55">
              Add {2 - items.length} more to assess
            </span>
          )}
        </div>
      </Card>

      {/* Result */}
      {result === null ? (
        <EmptyState
          icon={Users}
          title="Plan your mix"
          description="Add the species or items you're considering, then assess to see compatibility notes and reef-keeping rules of thumb."
        />
      ) : (
        <Results result={result} />
      )}
    </div>
  );
}

function Results({ result }: { result: Assessment }) {
  const { items, fired, knowledge } = result;

  // Overall "headline": danger if any caution rule fired, else caution if any
  // watch rule, else a positive note. Heuristic only.
  const hasCaution = fired.some((r) => r.level === "caution");
  const hasWatch = fired.some((r) => r.level === "watch");
  const headline = hasCaution
    ? {
        tone: "danger" as const,
        icon: AlertTriangle,
        title: "Mix with care",
        text: "We flagged combinations that commonly cause trouble. Read the notes below and plan tank size, stocking order, and hiding spots accordingly.",
      }
    : hasWatch
      ? {
          tone: "caution" as const,
          icon: Info,
          title: "Likely workable — with planning",
          text: "Nothing screams incompatible, but a few pairings reward thought about temperament, footprint, and order of addition.",
        }
      : {
          tone: "healthy" as const,
          icon: ShieldCheck,
          title: "No common red flags",
          text: "We didn't match these against any frequent conflict rules. Still research adult size, bioload, and individual temperament before stocking.",
        };

  const HeadlineIcon = headline.icon;

  return (
    <div className="space-y-5" aria-live="polite">
      {/* Headline summary */}
      <Card
        className={cn(
          "border-l-4",
          headline.tone === "danger" && "border-l-coral-400",
          headline.tone === "caution" && "border-l-amber-400",
          headline.tone === "healthy" && "border-l-lagoon-400",
        )}
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl",
              headline.tone === "danger" && "bg-coral-500/15 text-coral-200",
              headline.tone === "caution" && "bg-amber-500/15 text-amber-200",
              headline.tone === "healthy" && "bg-lagoon-500/15 text-lagoon-200",
            )}
          >
            <HeadlineIcon className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-xl font-semibold text-abyss-50">
                {headline.title}
              </h2>
              <Badge tone={headline.tone}>Heuristic guidance</Badge>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-abyss-100/80">
              {headline.text}
            </p>
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Assessed items">
              {items.map((i) => (
                <li key={i}>
                  <Badge>{i}</Badge>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      {/* Rule notes */}
      {fired.length > 0 && (
        <section aria-labelledby="rules-heading" className="space-y-3">
          <h3
            id="rules-heading"
            className="font-display text-lg font-semibold text-abyss-50"
          >
            What to watch
          </h3>
          <ul className="space-y-3">
            {fired.map((rule) => {
              const meta = LEVEL_META[rule.level];
              const Icon = meta.icon;
              return (
                <li key={rule.title}>
                  <Card className="!p-4">
                    <div className="flex items-start gap-3">
                      <Icon
                        className={cn(
                          "mt-0.5 h-4 w-4 shrink-0",
                          meta.tone === "danger" && "text-coral-300",
                          meta.tone === "caution" && "text-amber-300",
                          meta.tone === "healthy" && "text-lagoon-300",
                        )}
                        aria-hidden
                      />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-abyss-50">
                            {rule.title}
                          </p>
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-abyss-100/80">
                          {rule.detail}
                        </p>
                      </div>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Universal stocking principles (always shown — deterministic) */}
      <section aria-labelledby="principles-heading" className="space-y-3">
        <h3
          id="principles-heading"
          className="font-display text-lg font-semibold text-abyss-50"
        >
          Reef-keeping rules of thumb
        </h3>
        <Card className="!p-4">
          <ul className="space-y-2 text-sm leading-relaxed text-abyss-100/80">
            {[
              "Add peaceful, shy fish first and territorial or aggressive fish last so newcomers aren't bullied.",
              "Research adult size and bioload — not the small store specimen — and keep one fish per aggressive genus unless the tank is large.",
              "A bigger footprint and plenty of rockwork hiding spots ease aggression for almost any mix.",
              "Predators will eat shrimp and small fish; verify reef-safety per individual, as temperament varies within a species.",
              "Quarantine every new fish, and dip every new coral, before they ever touch the display.",
            ].map((tip) => (
              <li key={tip} className="flex gap-2">
                <Sparkles
                  className="mt-1 h-3.5 w-3.5 shrink-0 text-lagoon-300"
                  aria-hidden
                />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {/* Grounding knowledge */}
      {knowledge.length > 0 && (
        <section aria-labelledby="reading-heading" className="space-y-3">
          <h3
            id="reading-heading"
            className="font-display text-lg font-semibold text-abyss-50"
          >
            Related reading
          </h3>
          <ul className="grid gap-3 md:grid-cols-2">
            {knowledge.map((entry) => (
              <li key={entry.id}>
                <Card className="flex h-full flex-col !p-4">
                  <h4 className="font-display text-base font-semibold leading-snug text-abyss-50">
                    {entry.title}
                  </h4>
                  <p className="mt-1.5 flex-1 text-sm leading-relaxed text-abyss-100/75">
                    {entry.body}
                  </p>
                  <div className="mt-3 border-t border-white/5 pt-2.5">
                    <SectionLabel>Source</SectionLabel>
                    <Badge tone="brand">{entry.source}</Badge>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      <DisclaimerBanner text="Compatibility guidance is a heuristic starting point built from curated reef-keeping references, not a guarantee. Individual temperament, tank size, and stocking order all matter — research each species and observe closely." />
    </div>
  );
}
