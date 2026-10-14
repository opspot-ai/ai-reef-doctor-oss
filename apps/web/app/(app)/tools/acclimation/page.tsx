"use client";

import * as React from "react";
import {
  Droplets,
  Thermometer,
  Timer,
  Play,
  Pause,
  RotateCcw,
  Check,
  ShieldCheck,
  Fish,
  Waves,
  ArrowRight,
  CircleDot,
  type LucideIcon,
} from "lucide-react";
import {
  Card,
  SectionLabel,
  Button,
  Badge,
  DisclaimerBanner,
} from "@/components/ui";
import { cn } from "@/lib/cn";

/* ──────────────────────────────────────────────────────────────────────────
 * Drip-acclimation + quarantine walkthrough ( always-on). Educational,
 * deterministic, fully offline — an interactive stepper with an optional timer.
 * No AI, no network. Sourced from the curated acclimation guidance in the reef
 * knowledge base; pairs with the medical disclaimer on this health surface.
 * ────────────────────────────────────────────────────────────────────────── */

interface Step {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Suggested duration in seconds; null = self-paced (no timer). */
  seconds: number | null;
  summary: string;
  details: string[];
}

const STEPS: Step[] = [
  {
    id: "float",
    label: "Float the bag",
    icon: Thermometer,
    seconds: 15 * 60,
    summary: "Match temperature before anything else.",
    details: [
      "Dim the tank lights to reduce stress, and turn off any strong flow near the surface.",
      "Float the sealed, unopened bag in the tank for about 15 minutes so bag water reaches tank temperature.",
      "Don't open the bag yet — you're only equalizing temperature at this stage.",
    ],
  },
  {
    id: "open",
    label: "Open & seat",
    icon: Droplets,
    seconds: null,
    summary: "Move the animal and its water into a clean container.",
    details: [
      "Gently pour the fish/invert and its bag water into a clean bucket or container kept just for the tank.",
      "Tilt the container so the animal is comfortably submerged; add an airstone on low if you have one.",
      "Keep the container out of direct light and drafts to hold temperature steady.",
    ],
  },
  {
    id: "drip",
    label: "Drip acclimate",
    icon: Timer,
    seconds: 40 * 60,
    summary: "Slowly blend tank water in over 30–60 minutes.",
    details: [
      "Start a slow siphon from the tank using airline tubing; a loose knot or a drip valve sets the rate.",
      "Aim for roughly 2–4 drips per second — slower for sensitive inverts, shrimp, and snails.",
      "Continue until the water volume has at least doubled (30–60 minutes). Discard excess to keep the container from overflowing.",
      "Inverts and sensitive fish benefit from a longer, gentler drip — patience here prevents shock.",
    ],
  },
  {
    id: "transfer",
    label: "Net & transfer",
    icon: Fish,
    seconds: null,
    summary: "Move the animal — never the shipping water.",
    details: [
      "Net fish directly into the tank (or quarantine). For corals, do a quick pest dip and inspection before placement.",
      "Never pour the bag/acclimation water into your system — it can carry parasites, ammonia, and copper.",
      "Release low and gently near a hiding spot; keep lights dim for the rest of the day.",
    ],
  },
  {
    id: "quarantine",
    label: "Quarantine",
    icon: ShieldCheck,
    seconds: null,
    summary: "The single best defense against tank-wide disease.",
    details: [
      "Quarantine every new fish ~4–6 weeks in a bare-bottom tank with PVC hides, a sponge filter, and stable water.",
      "Observe for ich, velvet, flukes, and bacterial issues; a common workup pairs therapeutic copper with praziquantel.",
      "Only graduate the fish to the display once it's eating well and symptom-free. Quarantine lets you treat without harming corals and inverts.",
    ],
  },
];

const DRIP_TIPS = [
  "Use a refractometer to confirm your tank salinity matches what the animal is used to where you can.",
  "Shrimp, snails, and other inverts are the most sensitive — go slowest for them.",
  "Stop and reassess if the animal gasps, lies on its side, or shows severe distress.",
];

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function AcclimationPage() {
  const [current, setCurrent] = React.useState(0);
  const [done, setDone] = React.useState<Set<number>>(new Set());

  const step = STEPS[current]!;

  function markDoneAndAdvance() {
    setDone((prev) => {
      const next = new Set(prev);
      next.add(current);
      return next;
    });
    if (current < STEPS.length - 1) setCurrent(current + 1);
  }

  function resetAll() {
    setDone(new Set());
    setCurrent(0);
  }

  const allDone = done.size === STEPS.length;
  const progressPct = Math.round((done.size / STEPS.length) * 100);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <SectionLabel>Acclimation &amp; QT</SectionLabel>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-abyss-50 sm:text-4xl">
            Settle new arrivals in safely
          </h1>
          <Badge tone="brand">
            <Waves className="h-3.5 w-3.5" /> Walkthrough
          </Badge>
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-abyss-200/75">
          Proper acclimation eases the shock of temperature, salinity, and pH
          differences between the bag and your tank. Follow the steps below —
          each has an optional timer — and always quarantine before the display.
        </p>
        <DisclaimerBanner />
      </header>

      {/* Progress */}
      <div>
        <div className="mb-2 flex items-center justify-between text-xs text-abyss-200/65">
          <span>
            Step {Math.min(current + 1, STEPS.length)} of {STEPS.length}
          </span>
          <span aria-live="polite">{progressPct}% complete</span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Acclimation progress"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-lagoon-400 to-lagoon-300 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        {/* Step rail */}
        <nav aria-label="Acclimation steps">
          <ol className="space-y-1.5">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isDone = done.has(i);
              const isCurrent = i === current;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setCurrent(i)}
                    aria-current={isCurrent ? "step" : undefined}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-lagoon-400",
                      isCurrent
                        ? "bg-lagoon-500/15 ring-1 ring-inset ring-lagoon-400/30"
                        : "hover:bg-white/5",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-7 w-7 shrink-0 place-items-center rounded-lg",
                        isDone
                          ? "bg-lagoon-400 text-abyss-950"
                          : isCurrent
                            ? "bg-lagoon-500/25 text-lagoon-200"
                            : "bg-white/5 text-abyss-200/60",
                      )}
                    >
                      {isDone ? (
                        <Check className="h-4 w-4" aria-hidden />
                      ) : (
                        <Icon className="h-4 w-4" aria-hidden />
                      )}
                    </span>
                    <span
                      className={cn(
                        "font-medium",
                        isCurrent ? "text-abyss-50" : "text-abyss-100/80",
                      )}
                    >
                      {s.label}
                    </span>
                    {isDone && (
                      <span className="ml-auto text-[10px] uppercase tracking-wide text-lagoon-300">
                        Done
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Active step */}
        <div className="space-y-6">
          <StepDetail
            key={step.id}
            step={step}
            index={current}
            total={STEPS.length}
            isDone={done.has(current)}
            onDone={markDoneAndAdvance}
          />

          {allDone && (
            <Card className="border-l-4 border-l-lagoon-400">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-lagoon-500/15 text-lagoon-200">
                  <ShieldCheck className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h2 className="font-display text-xl font-semibold text-abyss-50">
                    Walkthrough complete
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-abyss-100/80">
                    Keep lights dim and disturbance low for the first day, watch
                    feeding and breathing, and resist the urge to add more
                    livestock at once. Steady beats fast.
                  </p>
                  <div className="mt-3">
                    <Button type="button" variant="secondary" onClick={resetAll}>
                      <RotateCcw className="h-4 w-4" /> Start over
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Tips */}
          <Card className="!p-4">
            <SectionLabel>Tips for a gentle drip</SectionLabel>
            <ul className="space-y-2 text-sm leading-relaxed text-abyss-100/80">
              {DRIP_TIPS.map((tip) => (
                <li key={tip} className="flex gap-2">
                  <CircleDot
                    className="mt-1 h-3.5 w-3.5 shrink-0 text-lagoon-300"
                    aria-hidden
                  />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </Card>

          <div className="border-t border-white/5 pt-3">
            <SectionLabel>Source</SectionLabel>
            <Badge tone="brand">WetWebMedia — Acclimating New Livestock</Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepDetail({
  step,
  index,
  total,
  isDone,
  onDone,
}: {
  step: Step;
  index: number;
  total: number;
  isDone: boolean;
  onDone: () => void;
}) {
  const Icon = step.icon;
  const isLast = index === total - 1;

  return (
    <Card className="space-y-5">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-lagoon-500/15 text-lagoon-200">
          <Icon className="h-6 w-6" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-lagoon-300">
            Step {index + 1}
          </p>
          <h2 className="font-display text-2xl font-semibold text-abyss-50">
            {step.label}
          </h2>
          <p className="mt-0.5 text-sm text-abyss-100/80">{step.summary}</p>
        </div>
      </div>

      {step.seconds !== null && (
        <StepTimer seconds={step.seconds} stepId={step.id} />
      )}

      <ol className="space-y-2.5">
        {step.details.map((d, i) => (
          <li key={i} className="flex gap-3 text-sm leading-relaxed text-abyss-100/85">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/5 text-[11px] font-semibold text-lagoon-200 ring-1 ring-inset ring-white/10">
              {i + 1}
            </span>
            <span>{d}</span>
          </li>
        ))}
      </ol>

      <div className="flex items-center gap-3 pt-1">
        <Button type="button" onClick={onDone}>
          {isLast ? (
            <>
              <Check className="h-4 w-4" /> Mark complete
            </>
          ) : isDone ? (
            <>
              Next step <ArrowRight className="h-4 w-4" />
            </>
          ) : (
            <>
              Mark done &amp; continue <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
        {isDone && (
          <span className="inline-flex items-center gap-1 text-xs text-lagoon-300">
            <Check className="h-3.5 w-3.5" /> Completed
          </span>
        )}
      </div>
    </Card>
  );
}

function StepTimer({ seconds, stepId }: { seconds: number; stepId: string }) {
  const [remaining, setRemaining] = React.useState(seconds);
  const [running, setRunning] = React.useState(false);
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset the timer whenever the step changes.
  React.useEffect(() => {
    setRemaining(seconds);
    setRunning(false);
  }, [seconds, stepId]);

  React.useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setRunning(false);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  const finished = remaining === 0;
  const elapsedPct = Math.round(((seconds - remaining) / seconds) * 100);

  return (
    <div className="rounded-2xl border border-white/10 bg-abyss-900/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-abyss-200/60">
            Suggested timer
          </p>
          <p
            className={cn(
              "font-display text-3xl font-semibold tabular-nums",
              finished ? "text-lagoon-300" : "text-abyss-50",
            )}
            aria-live="polite"
          >
            {finished ? "Time's up" : formatClock(remaining)}
          </p>
        </div>
        <div className="flex gap-2">
          {!finished && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRunning((v) => !v)}
            >
              {running ? (
                <>
                  <Pause className="h-4 w-4" /> Pause
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" /> Start
                </>
              )}
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setRunning(false);
              setRemaining(seconds);
            }}
            aria-label="Reset timer"
          >
            <RotateCcw className="h-4 w-4" /> Reset
          </Button>
        </div>
      </div>
      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-valuenow={elapsedPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Timer progress"
      >
        <div
          className="h-full rounded-full bg-lagoon-400 transition-all duration-500"
          style={{ width: `${elapsedPct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-abyss-200/55">
        Timers are guidance — go slower for sensitive inverts. The app keeps
        running while you watch the drip.
      </p>
    </div>
  );
}
