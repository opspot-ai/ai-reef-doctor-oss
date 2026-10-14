"use client";

import * as React from "react";
import Link from "next/link";
import {
  Fish,
  Sparkles,
  Leaf,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Stethoscope,
  Search,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import {
  Card,
  SectionLabel,
  Button,
  Badge,
  ConfidenceBadge,
  DisclaimerBanner,
  EmptyState,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { retrieve, type KnowledgeEntry } from "@reef/shared";

/* ─────────────────────────── question model ─────────────────────────── */

type Subject = "fish" | "coral" | "algae";

interface Choice {
  id: string;
  label: string;
  /** Keywords appended to the retrieval query when chosen. */
  keywords: string;
}

interface Question {
  id: string;
  /** Subjects this question applies to. */
  subjects: Subject[];
  prompt: string;
  /** Allow selecting more than one symptom. */
  multi?: boolean;
  choices: Choice[];
}

const SUBJECTS: { id: Subject; label: string; hint: string; icon: LucideIcon }[] =
  [
    {
      id: "fish",
      label: "A fish",
      hint: "Behavior, spots, breathing, appetite",
      icon: Fish,
    },
    {
      id: "coral",
      label: "A coral",
      hint: "Bleaching, recession, pests",
      icon: Sparkles,
    },
    {
      id: "algae",
      label: "Algae or a pest",
      hint: "Nuisance growth, hitchhikers",
      icon: Leaf,
    },
  ];

const QUESTIONS: Question[] = [
  // ── fish ──
  {
    id: "fish-appearance",
    subjects: ["fish"],
    prompt: "What do you see on the fish's body or fins?",
    multi: true,
    choices: [
      {
        id: "white-spots",
        label: "Tiny white salt-grain spots",
        keywords: "white spot marine ich cryptocaryon spots",
      },
      {
        id: "gold-dust",
        label: "Fine gold or dusty velvet sheen",
        keywords: "gold dust velvet amyloodinium dusty sheen",
      },
      {
        id: "slime-peeling",
        label: "Excess slime / peeling skin",
        keywords: "excess slime sloughing skin brooklynella clownfish",
      },
      {
        id: "sores",
        label: "Red sores, ulcers, or lesions",
        keywords: "red bloody sores ulcers lesions uronema",
      },
      {
        id: "ragged-fins",
        label: "Ragged, eroding, or whitening fins",
        keywords: "ragged eroding fins fin rot bacterial",
      },
      {
        id: "swollen-eye",
        label: "Swollen or bulging eye",
        keywords: "swollen bulging eye popeye exophthalmia",
      },
      {
        id: "head-pitting",
        label: "Pitting around the head / lateral line",
        keywords: "head lateral line erosion hlle pitting tang",
      },
      {
        id: "cottony",
        label: "Cottony or fuzzy growth",
        keywords: "cottony fuzzy growth columnaris bacterial fungal",
      },
    ],
  },
  {
    id: "fish-behavior",
    subjects: ["fish"],
    prompt: "How is the fish behaving?",
    multi: true,
    choices: [
      {
        id: "flashing",
        label: "Flashing / scratching on rocks",
        keywords: "flashing scratching rubbing parasite flukes",
      },
      {
        id: "rapid-breathing",
        label: "Rapid or labored breathing",
        keywords: "rapid breathing gilling gills labored respiratory velvet flukes",
      },
      {
        id: "clamped",
        label: "Clamped fins, hiding, lethargic",
        keywords: "clamped fins lethargic hiding stressed",
      },
      {
        id: "normal-behavior",
        label: "Behaving fairly normally",
        keywords: "",
      },
    ],
  },
  {
    id: "fish-appetite",
    subjects: ["fish"],
    prompt: "Is the fish eating?",
    choices: [
      {
        id: "eating",
        label: "Eating well",
        keywords: "",
      },
      {
        id: "reduced",
        label: "Eating less than usual",
        keywords: "reduced appetite stress",
      },
      {
        id: "not-eating",
        label: "Not eating at all",
        keywords: "not eating appetite loss disease",
      },
    ],
  },
  {
    id: "fish-onset",
    subjects: ["fish"],
    prompt: "How fast did this come on?",
    choices: [
      {
        id: "sudden",
        label: "Suddenly — within a day or two (and/or deaths)",
        keywords: "sudden rapid emergency velvet deaths",
      },
      {
        id: "gradual",
        label: "Gradually over several days or weeks",
        keywords: "gradual slow",
      },
    ],
  },
  // ── coral ──
  {
    id: "coral-signs",
    subjects: ["coral"],
    prompt: "What's happening with the coral?",
    multi: true,
    choices: [
      {
        id: "pale-white",
        label: "Turning pale or stark white (tissue still on)",
        keywords: "pale white bleaching zooxanthellae light stress",
      },
      {
        id: "tissue-loss",
        label: "Tissue receding, exposing white skeleton",
        keywords: "tissue necrosis stn rtn receding skeleton sps",
      },
      {
        id: "bite-marks",
        label: "Bite marks / eggs on Acropora",
        keywords: "acropora eating flatworm aefw bite marks eggs",
      },
      {
        id: "poor-pe",
        label: "Poor polyp extension, dull color",
        keywords: "poor polyp extension red bugs tegastes acropora",
      },
      {
        id: "white-patches",
        label: "Bare white patches on Montipora",
        keywords: "montipora eating nudibranch white patches tissue loss",
      },
    ],
  },
  {
    id: "coral-context",
    subjects: ["coral"],
    prompt: "Have your parameters been swinging recently?",
    choices: [
      {
        id: "alk-swing",
        label: "Yes — alkalinity / chemistry has been unstable",
        keywords: "alkalinity swing unstable parameters stability",
      },
      {
        id: "stable",
        label: "No — parameters have been stable",
        keywords: "",
      },
      {
        id: "unsure",
        label: "Not sure",
        keywords: "",
      },
    ],
  },
  // ── algae / pests ──
  {
    id: "algae-look",
    subjects: ["algae"],
    prompt: "What does the growth or pest look like?",
    multi: true,
    choices: [
      {
        id: "red-slime",
        label: "Slimy red/maroon sheets with bubbles",
        keywords: "cyanobacteria red slime sheets bubbles low flow",
      },
      {
        id: "brown-snot",
        label: "Brown/golden snotty strings with bubbles",
        keywords: "dinoflagellates dinos brown snot bubbles low nutrient",
      },
      {
        id: "brown-film",
        label: "Brown dusty film (new tank)",
        keywords: "diatoms brown film silicate new tank dusty",
      },
      {
        id: "green-hair",
        label: "Stringy green hair algae",
        keywords: "green hair algae gha filamentous nutrients phosphate",
      },
      {
        id: "feathery",
        label: "Feathery, fern-like green algae",
        keywords: "bryopsis feathery fern algae magnesium stubborn",
      },
      {
        id: "glass-anemone",
        label: "Small brown anemones multiplying",
        keywords: "aiptasia glass anemone pest multiplying",
      },
      {
        id: "tube-snail",
        label: "Tubes with a mucus feeding net",
        keywords: "vermetid snails tube mucus net coral irritation",
      },
      {
        id: "red-flatworms",
        label: "Rusty-red flatworms carpeting surfaces",
        keywords: "red planaria flatworms convolutriloba rust carpet",
      },
    ],
  },
];

/* ─────────────────────────── scoring ─────────────────────────── */

interface Ranked {
  entry: KnowledgeEntry;
  /** 0..1 confidence-style score, normalized against the top match. */
  score: number;
}

const TOPIC_LABEL: Record<KnowledgeEntry["topic"], string> = {
  disease: "Fish disease",
  treatment: "Treatment",
  params: "Water chemistry",
  coral: "Coral health",
  algae: "Algae / pest",
  species: "Species care",
  general: "Husbandry",
};

const TOPIC_TONE: Record<
  KnowledgeEntry["topic"],
  "healthy" | "caution" | "danger" | "brand" | "neutral"
> = {
  disease: "danger",
  treatment: "caution",
  params: "brand",
  coral: "caution",
  algae: "healthy",
  species: "brand",
  general: "neutral",
};

/**
 * Build a deterministic ranked shortlist from the selected keywords. We retrieve
 * a slightly wider set, then assign a normalized confidence-style score using
 * each result's position (top result is most confident). Purely local — no AI.
 */
function rank(subject: Subject, keywords: string[]): Ranked[] {
  const query = [subject, ...keywords].join(" ").trim();
  if (!query) return [];
  const entries = retrieve(query, 5);
  if (entries.length === 0) return [];

  // Confidence derived from rank position: 1st ≈ 0.85, then a gentle decay,
  // capped so we never imply certainty from a keyword match alone.
  return entries.map((entry, i) => {
    const score = Math.max(0.35, 0.85 - i * 0.13);
    return { entry, score: Math.round(score * 100) / 100 };
  });
}

/* ─────────────────────────── component ─────────────────────────── */

type Phase = "subject" | "questions" | "results";

export function SymptomChecker({ diagnoseHref }: { diagnoseHref: string }) {
  const [phase, setPhase] = React.useState<Phase>("subject");
  const [subject, setSubject] = React.useState<Subject | null>(null);
  const [step, setStep] = React.useState(0);
  // questionId -> set of selected choice ids
  const [answers, setAnswers] = React.useState<Record<string, Set<string>>>({});
  const [results, setResults] = React.useState<Ranked[] | null>(null);

  const liveRef = React.useRef<HTMLDivElement>(null);

  const questions = React.useMemo(
    () => (subject ? QUESTIONS.filter((q) => q.subjects.includes(subject)) : []),
    [subject],
  );

  const current = questions[step];
  const totalSteps = questions.length;

  function chooseSubject(s: Subject) {
    setSubject(s);
    setAnswers({});
    setStep(0);
    setResults(null);
    setPhase("questions");
  }

  function toggleChoice(q: Question, choiceId: string) {
    setAnswers((prev) => {
      const next = { ...prev };
      const set = new Set(next[q.id] ?? []);
      if (q.multi) {
        if (set.has(choiceId)) set.delete(choiceId);
        else set.add(choiceId);
      } else {
        // Single-select: replace.
        set.clear();
        set.add(choiceId);
      }
      next[q.id] = set;
      return next;
    });
  }

  function gatherKeywords(): string[] {
    const out: string[] = [];
    for (const q of questions) {
      const selected = answers[q.id];
      if (!selected) continue;
      for (const c of q.choices) {
        if (selected.has(c.id) && c.keywords) out.push(c.keywords);
      }
    }
    return out;
  }

  function finish() {
    if (!subject) return;
    setResults(rank(subject, gatherKeywords()));
    setPhase("results");
  }

  function next() {
    if (step < totalSteps - 1) {
      setStep((s) => s + 1);
    } else {
      finish();
    }
  }

  function back() {
    if (phase === "results") {
      setPhase("questions");
      setStep(totalSteps - 1);
      return;
    }
    if (step > 0) {
      setStep((s) => s - 1);
    } else {
      setPhase("subject");
    }
  }

  function restart() {
    setPhase("subject");
    setSubject(null);
    setStep(0);
    setAnswers({});
    setResults(null);
  }

  const currentAnswered =
    current && (answers[current.id]?.size ?? 0) > 0;

  /* ── render: subject picker ── */
  if (phase === "subject") {
    return (
      <Card className="space-y-5">
        <SectionLabel>Step 1 — What are you worried about?</SectionLabel>
        <div
          role="radiogroup"
          aria-label="Subject of concern"
          className="grid gap-3 sm:grid-cols-3"
        >
          {SUBJECTS.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={subject === s.id}
                onClick={() => chooseSubject(s.id)}
                className="flex flex-col items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-left transition hover:-translate-y-0.5 hover:border-lagoon-400/30 hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-lagoon-400 focus-visible:ring-offset-2 focus-visible:ring-offset-abyss-950 motion-reduce:hover:translate-y-0"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-lagoon-500/15 text-lagoon-200 ring-1 ring-inset ring-lagoon-400/25">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="font-medium text-abyss-50">{s.label}</span>
                <span className="text-xs text-abyss-200/60">{s.hint}</span>
              </button>
            );
          })}
        </div>
      </Card>
    );
  }

  /* ── render: results ── */
  if (phase === "results" && results) {
    return (
      <div className="space-y-6">
        <Card className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <SectionLabel>Most likely conditions</SectionLabel>
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" type="button" onClick={back}>
                <ArrowLeft className="h-4 w-4" aria-hidden /> Edit answers
              </Button>
              <Button variant="secondary" type="button" onClick={restart}>
                <RotateCcw className="h-4 w-4" aria-hidden /> Start over
              </Button>
            </div>
          </div>

          <div ref={liveRef} aria-live="polite">
            {results.length === 0 ? (
              <EmptyState
                icon={Search}
                title="No clear match yet"
                description="Your selections didn't strongly match a known condition. Try adding more symptoms, or hand it to the Reef Doctor for a photo-based look."
                action={
                  <Link href={diagnoseHref} className="reef-btn-primary">
                    <Stethoscope className="h-4 w-4" aria-hidden /> Get AI
                    diagnosis
                  </Link>
                }
              />
            ) : (
              <ol className="space-y-3">
                {results.map((r, i) => (
                  <li key={r.entry.id}>
                    <ResultRow rank={i + 1} ranked={r} />
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Deep link to AI diagnosis */}
          {results.length > 0 && (
            <div className="rounded-2xl border border-lagoon-400/25 bg-lagoon-500/[0.08] p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
              <div>
                <p className="font-medium text-abyss-50">
                  Want a closer look?
                </p>
                <p className="mt-0.5 text-sm text-abyss-200/70">
                  Upload a photo and let the Reef Doctor weigh the evidence with
                  confidence, sources, and next steps.
                </p>
              </div>
              <Link
                href={diagnoseHref}
                className="reef-btn-primary mt-3 w-full justify-center sm:mt-0 sm:w-auto"
              >
                <Stethoscope className="h-4 w-4" aria-hidden /> Get AI diagnosis
              </Link>
            </div>
          )}

          <p className="text-xs leading-relaxed text-abyss-200/55">
            This shortlist is generated by keyword-matching your answers against
            a curated reef knowledge base — it is a starting point, not a
            confirmed diagnosis. Gather more evidence (clear photos, repeat
            tests) before treating.
          </p>
          <DisclaimerBanner />
        </Card>
      </div>
    );
  }

  /* ── render: questions ── */
  if (!current) {
    // Defensive: no questions for the subject (shouldn't happen).
    return (
      <Card>
        <EmptyState
          icon={Search}
          title="Nothing to ask"
          description="Pick a subject to begin."
          action={
            <Button type="button" onClick={restart}>
              Start over
            </Button>
          }
        />
      </Card>
    );
  }

  const progress = Math.round(((step + 1) / totalSteps) * 100);

  return (
    <Card className="space-y-6">
      {/* Progress */}
      <div>
        <div className="flex items-center justify-between">
          <SectionLabel>
            Step {step + 2} of {totalSteps + 1}
          </SectionLabel>
          <span className="text-xs text-abyss-200/55 tabular-nums">
            {progress}%
          </span>
        </div>
        <div
          className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Questionnaire progress"
        >
          <div
            className="h-full rounded-full bg-lagoon-400 transition-all duration-300 motion-reduce:transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <fieldset className="space-y-3">
        <legend className="font-display text-lg font-semibold text-abyss-50">
          {current.prompt}
        </legend>
        {current.multi && (
          <p className="text-xs text-abyss-200/55">Select all that apply.</p>
        )}
        <div
          role={current.multi ? "group" : "radiogroup"}
          aria-label={current.prompt}
          className="grid gap-2.5 sm:grid-cols-2"
        >
          {current.choices.map((c) => {
            const selected = answers[current.id]?.has(c.id) ?? false;
            return (
              <button
                key={c.id}
                type="button"
                role={current.multi ? "checkbox" : "radio"}
                aria-checked={selected}
                onClick={() => toggleChoice(current, c.id)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-lagoon-400 focus-visible:ring-offset-2 focus-visible:ring-offset-abyss-950",
                  selected
                    ? "border-lagoon-400/40 bg-lagoon-500/15 ring-1 ring-inset ring-lagoon-400/30 text-lagoon-50"
                    : "border-white/10 bg-white/[0.03] text-abyss-50 hover:border-white/20 hover:bg-white/[0.06]",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "grid h-5 w-5 shrink-0 place-items-center border transition",
                    current.multi ? "rounded-md" : "rounded-full",
                    selected
                      ? "border-lagoon-400 bg-lagoon-400 text-abyss-950"
                      : "border-white/25",
                  )}
                >
                  {selected && <ChevronRight className="h-3.5 w-3.5" />}
                </span>
                <span>{c.label}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Nav */}
      <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
        <Button variant="secondary" type="button" onClick={back}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back
        </Button>
        <div className="flex items-center gap-3">
          {!current.multi || currentAnswered ? null : (
            <span className="text-xs text-abyss-200/55">
              Pick at least one, or skip.
            </span>
          )}
          {/* Allow skipping a question (no selection contributes no keywords). */}
          <Button type="button" onClick={next}>
            {step < totalSteps - 1 ? (
              <>
                Next <ArrowRight className="h-4 w-4" aria-hidden />
              </>
            ) : (
              <>
                See results <Search className="h-4 w-4" aria-hidden />
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}

/* ─────────────────────────── result row ─────────────────────────── */

function ResultRow({ rank, ranked }: { rank: number; ranked: Ranked }) {
  const { entry, score } = ranked;
  const [open, setOpen] = React.useState(rank === 1);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-semibold text-abyss-100">
          {rank}
        </span>
        <h3 className="font-display text-base font-semibold text-abyss-50">
          {entry.title}
        </h3>
        <Badge tone={TOPIC_TONE[entry.topic]}>{TOPIC_LABEL[entry.topic]}</Badge>
        <div className="ml-auto">
          <ConfidenceBadge confidence={score} />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-lagoon-300 transition hover:text-lagoon-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-lagoon-400 focus-visible:ring-offset-2 focus-visible:ring-offset-abyss-950"
      >
        {open ? "Hide details" : "Show details"}
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 transition-transform motion-reduce:transition-none",
            open && "rotate-90",
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          <p className="text-sm leading-relaxed text-abyss-100/85">
            {entry.body}
          </p>
          <p className="text-xs text-abyss-200/50">Source: {entry.source}</p>
        </div>
      )}
    </div>
  );
}
