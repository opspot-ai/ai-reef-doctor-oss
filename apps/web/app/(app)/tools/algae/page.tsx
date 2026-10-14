"use client";

import * as React from "react";
import {
  Leaf,
  Sprout,
  Waves,
  Droplets,
  Sparkles,
  Bug,
  Filter,
  ListChecks,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { retrieve, KNOWLEDGE, type KnowledgeEntry } from "@reef/shared";
import {
  Card,
  SectionLabel,
  Badge,
  DisclaimerBanner,
} from "@/components/ui";
import { cn } from "@/lib/cn";

/* ──────────────────────────────────────────────────────────────────────────
 * Algae & pest remediation planner ( always-on). Deterministic, offline,
 * no AI: pick a type and we surface a step-by-step plan plus the grounding
 * knowledge entry retrieved from the curated corpus. Plans are practical and
 * reef-safe-minded; the disclaimer renders on this health surface.
 * ────────────────────────────────────────────────────────────────────────── */

type AlgaeId =
  | "cyano"
  | "dinos"
  | "diatom"
  | "hair"
  | "bryopsis"
  | "aiptasia";

interface AlgaeType {
  id: AlgaeId;
  label: string;
  icon: LucideIcon;
  /** Short identifier the user can match against what they see. */
  tagline: string;
  /** Retrieval query (keywords) to pull the grounding KNOWLEDGE entry. */
  query: string;
  /** Tone for the difficulty/urgency cue. */
  difficulty: { tone: "healthy" | "caution" | "danger"; label: string };
  /** Ordered remediation plan. */
  plan: { title: string; detail: string }[];
}

const TYPES: AlgaeType[] = [
  {
    id: "cyano",
    label: "Cyanobacteria",
    icon: Waves,
    tagline: "Red/maroon slimy sheets, often with bubbles",
    query: "cyanobacteria red slime low flow nutrients",
    difficulty: { tone: "caution", label: "Manageable" },
    plan: [
      {
        title: "Boost flow into dead spots",
        detail:
          "Cyano thrives where water stagnates. Reposition or add powerheads so detritus can't settle on rock, sand, and equipment.",
      },
      {
        title: "Manually siphon the sheets",
        detail:
          "Siphon out as much slime as you can during a water change. It lifts off easily — remove it rather than just stirring it around.",
      },
      {
        title: "Tighten nutrient export",
        detail:
          "Improve skimming, run GFO for phosphate, and do consistent water changes. Cut back overfeeding, which is the most common fuel source.",
      },
      {
        title: "Treat the cause, not just the symptom",
        detail:
          "Erythromycin-based 'red slime removers' work fast but return if flow and nutrients aren't fixed. Use them as a last resort while you address husbandry.",
      },
    ],
  },
  {
    id: "dinos",
    label: "Dinoflagellates",
    icon: Sparkles,
    tagline: "Brown/golden snotty strings with trapped bubbles",
    query: "dinoflagellates dinos brown snot low nutrient blackout uv",
    difficulty: { tone: "danger", label: "Stubborn" },
    plan: [
      {
        title: "Stop chasing zero nutrients",
        detail:
          "Dinos exploit ultra-clean water. Don't let nitrate or phosphate bottom out — gently raise them so other life can outcompete the dinos.",
      },
      {
        title: "Rebuild biodiversity",
        detail:
          "Add pods, beneficial bacteria, and even a little live rock/sand from a healthy system to crowd dinos out with a richer microbiome.",
      },
      {
        title: "Run UV + a blackout",
        detail:
          "A UV sterilizer knocks down free-floating cells; a 3-day lights-out blackout (cover the tank) stresses the bloom. Manually siphon strands first.",
      },
      {
        title: "Raise and steady pH; be patient",
        detail:
          "Slightly higher pH and stable parameters help. If you can, ID the dino type under a microscope — some are toxic to cleanup crews. Recovery takes weeks.",
      },
    ],
  },
  {
    id: "diatom",
    label: "Diatoms",
    icon: Sprout,
    tagline: "Dusty brown films on sand, rock, and glass",
    query: "diatoms brown algae silicate new tank rodi cleanup crew",
    difficulty: { tone: "healthy", label: "Usually self-resolving" },
    plan: [
      {
        title: "Recognize the 'ugly stage'",
        detail:
          "Brown diatom films are normal in the first weeks of a new tank as it matures. They typically fade on their own once silicates are consumed.",
      },
      {
        title: "Use low-silicate source water",
        detail:
          "Mix with RODI water, not tap. Persistent diatoms usually mean ongoing silicate input — check your source water and replace exhausted RODI media.",
      },
      {
        title: "Let the cleanup crew graze",
        detail:
          "Snails and a modest cleanup crew browse diatoms down. Good flow keeps films from caking on surfaces while the biome balances.",
      },
      {
        title: "Be patient",
        detail:
          "Resist the urge to overreact in a young system. Stable husbandry and time resolve most diatom blooms without intervention.",
      },
    ],
  },
  {
    id: "hair",
    label: "Green hair algae",
    icon: Leaf,
    tagline: "Stringy green filaments overgrowing rock & sand",
    query: "green hair algae gha nutrients phosphate gfo refugium",
    difficulty: { tone: "caution", label: "Persistent" },
    plan: [
      {
        title: "Pull it out by hand first",
        detail:
          "Manually remove as much as possible — twist filaments around a toothbrush or pull clumps. This instantly reduces the algae's foothold.",
      },
      {
        title: "Export nutrients hard",
        detail:
          "Water changes, skimming, GFO for phosphate, and a refugium with macroalgae all compete for the nitrate and phosphate that fuel GHA.",
      },
      {
        title: "Recruit grazers",
        detail:
          "A hungry cleanup crew or herbivore — certain tangs, urchins, and hermits — keeps regrowth in check between manual removals.",
      },
      {
        title: "Cut the input",
        detail:
          "Reduce overfeeding and fix dirty source water. Starving plus grazing finishes the job over several weeks — consistency wins.",
      },
    ],
  },
  {
    id: "bryopsis",
    label: "Bryopsis",
    icon: Filter,
    tagline: "Feathery, fern-like green that resists cleanup crews",
    query: "bryopsis feathery fern algae magnesium tech-m fluconazole reef flux",
    difficulty: { tone: "danger", label: "Tenacious" },
    plan: [
      {
        title: "Confirm it's bryopsis, not hair algae",
        detail:
          "Bryopsis is distinctly feathery/fern-like and regrows from fragments, so it shrugs off normal grazers — that's the tell versus stringy hair algae.",
      },
      {
        title: "Elevate magnesium (carefully)",
        detail:
          "The most-cited cure is raising magnesium to ~1600–1800 ppm using a specific brand (Kent Tech-M) over several weeks. Monitor inverts and corals closely.",
      },
      {
        title: "Consider fluconazole",
        detail:
          "Fluconazole (Reef Flux) is a popular reef-safe alternative many find effective. Run carbon afterward and watch for an algae die-off.",
      },
      {
        title: "Manual removal + nutrient control",
        detail:
          "Combine treatment with hand-pulling and tighter nutrient export. Fragments regrow, so persistence over weeks is essential.",
      },
    ],
  },
  {
    id: "aiptasia",
    label: "Aiptasia",
    icon: Bug,
    tagline: "Pest glass anemones that sting corals and multiply",
    query: "aiptasia glass anemone peppermint shrimp berghia aiptasia-x kalkwasser",
    difficulty: { tone: "caution", label: "Spreads if torn" },
    plan: [
      {
        title: "Never just cut or pull them",
        detail:
          "Any torn fragment regenerates into more aiptasia. Manual tearing makes an outbreak worse — always remove or kill them whole.",
      },
      {
        title: "Spot-treat the mouth",
        detail:
          "Inject the pest directly in its mouth with a product like Aiptasia-X or a dab of kalkwasser paste so it can't retract and survive.",
      },
      {
        title: "Add biological control",
        detail:
          "Peppermint shrimp, Berghia nudibranchs (which eat only aiptasia), and certain filefish/butterflies help keep populations down.",
      },
      {
        title: "Combine and stay vigilant",
        detail:
          "Pair predators with ongoing spot-treatment for persistent outbreaks, and inspect/quarantine new rock and frags to prevent reintroduction.",
      },
    ],
  },
];

/** Find the best grounding entry for a type from the corpus via the retriever,
 * falling back to a direct id lookup so a plan always has a cited source. */
const FALLBACK_IDS: Record<AlgaeId, string> = {
  cyano: "algae-cyanobacteria",
  dinos: "algae-dinoflagellates",
  diatom: "algae-diatoms",
  hair: "algae-hair-algae",
  bryopsis: "algae-bryopsis",
  aiptasia: "pest-aiptasia",
};

function groundingFor(type: AlgaeType): KnowledgeEntry | null {
  const hits = retrieve(type.query, 3);
  const direct = KNOWLEDGE.find((e) => e.id === FALLBACK_IDS[type.id]) ?? null;
  // Prefer the retrieved top hit if it matches the intended entry; otherwise
  // fall back to the explicit id so the source is always correct.
  if (direct && hits.some((h) => h.id === direct.id)) return direct;
  return hits[0] ?? direct;
}

export default function AlgaePage() {
  const [selected, setSelected] = React.useState<AlgaeId | null>(null);
  const type = selected ? TYPES.find((t) => t.id === selected) ?? null : null;
  const grounding = type ? groundingFor(type) : null;

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <SectionLabel>Algae &amp; pests</SectionLabel>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-abyss-50 sm:text-4xl">
            Algae remediation planner
          </h1>
          <Badge tone="brand">
            <ListChecks className="h-3.5 w-3.5" /> Step-by-step
          </Badge>
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-abyss-200/75">
          Identify what&apos;s taking over, then follow a practical, reef-safe
          plan to beat it back. Every plan is grounded in our curated knowledge
          base — pick the closest match to what you see.
        </p>
        <DisclaimerBanner />
      </header>

      {/* Type picker */}
      <section aria-labelledby="picker-heading">
        <h2 id="picker-heading" className="sr-only">
          Choose an algae or pest type
        </h2>
        <div
          role="radiogroup"
          aria-label="Algae or pest type"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {TYPES.map((t) => {
            const Icon = t.icon;
            const active = selected === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSelected(t.id)}
                className={cn(
                  "flex items-start gap-3 rounded-2xl border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-lagoon-400 focus-visible:ring-offset-2 focus-visible:ring-offset-abyss-950",
                  active
                    ? "border-lagoon-400/40 bg-lagoon-500/10 shadow-glow"
                    : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/5",
                )}
              >
                <span
                  className={cn(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-xl transition",
                    active
                      ? "bg-lagoon-400 text-abyss-950"
                      : "bg-white/5 text-lagoon-300",
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-base font-semibold text-abyss-50">
                    {t.label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-abyss-200/65">
                    {t.tagline}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Plan */}
      {type === null ? (
        <Card className="!p-8 text-center">
          <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-white/5 text-lagoon-300">
            <Droplets className="h-6 w-6" aria-hidden />
          </span>
          <h2 className="font-display text-lg font-semibold text-abyss-50">
            Pick a type to see its plan
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-abyss-200/65">
            Choose the algae or pest above that best matches what&apos;s in your
            tank, and we&apos;ll lay out the remediation steps.
          </p>
        </Card>
      ) : (
        <Plan type={type} grounding={grounding} />
      )}
    </div>
  );
}

function Plan({
  type,
  grounding,
}: {
  type: AlgaeType;
  grounding: KnowledgeEntry | null;
}) {
  const Icon = type.icon;
  return (
    <div className="space-y-5" aria-live="polite">
      {/* Header card */}
      <Card className="border-l-4 border-l-lagoon-400">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-lagoon-500/15 text-lagoon-200">
            <Icon className="h-6 w-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-2xl font-semibold text-abyss-50">
                {type.label}
              </h2>
              <Badge tone={type.difficulty.tone}>{type.difficulty.label}</Badge>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-abyss-100/80">
              {grounding?.body ?? type.tagline}
            </p>
          </div>
        </div>
      </Card>

      {/* Step plan */}
      <section aria-labelledby="plan-heading" className="space-y-3">
        <h3
          id="plan-heading"
          className="font-display text-lg font-semibold text-abyss-50"
        >
          Your remediation plan
        </h3>
        <ol className="space-y-3">
          {type.plan.map((step, i) => (
            <li key={step.title}>
              <Card className="!p-4">
                <div className="flex gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-lagoon-500/15 font-display text-sm font-semibold text-lagoon-200">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-medium text-abyss-50">{step.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-abyss-100/80">
                      {step.detail}
                    </p>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {/* Safety note */}
      <Card className="!p-4">
        <div className="flex items-start gap-2.5">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-300"
            aria-hidden
          />
          <p className="text-sm leading-relaxed text-abyss-100/80">
            Go slow with any whole-tank treatment, run carbon during large algae
            die-offs to absorb released toxins, and never overdose. Address the
            underlying cause (flow, nutrients, source water) so the problem
            doesn&apos;t simply return.
          </p>
        </div>
      </Card>

      {/* Grounding source */}
      {grounding && (
        <div className="border-t border-white/5 pt-3">
          <SectionLabel>Source</SectionLabel>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">{grounding.source}</Badge>
            <span className="text-xs text-abyss-200/55">
              via “{grounding.title}” in the reef knowledge base
            </span>
          </div>
        </div>
      )}

      <DisclaimerBanner text="Remediation guidance is educational and drawn from curated reef-keeping references — not veterinary advice. Identify the nuisance carefully (a microscope helps for dinos), verify any product against its label, and observe livestock closely throughout treatment." />
    </div>
  );
}
