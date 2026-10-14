import {
  Circle,
  CircleDot,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { cycleStage, type CycleStage, type ParameterRow } from "@reef/shared";
import { Card, SectionLabel, Badge } from "@/components/ui";
import { cn } from "@/lib/cn";

/**
 * Nitrogen-cycle tracker (, ). Renders the tank's current cycle
 * stage as a stepper (not-started → ammonia → nitrite → cycled) with plain-language
 * guidance for the active stage. Pure/server-renderable — derives stage from the
 * latest reading via cycleStage().
 */

const ORDER: CycleStage[] = ["not-started", "ammonia", "nitrite", "cycled"];

interface StepMeta {
  stage: CycleStage;
  title: string;
  short: string;
  guidance: string;
}

// "nitrate" from cycleStage maps onto the late ammonia→nitrite conversion phase;
// we treat it as part of the "nitrite" milestone for the 4-step visual.
const STEPS: StepMeta[] = [
  {
    stage: "not-started",
    title: "Not started",
    short: "Day 0",
    guidance:
      "Add an ammonia source (fishless dosing or live rock) to kick off the cycle. " +
      "Keep temperature and salinity stable and start testing every couple of days.",
  },
  {
    stage: "ammonia",
    title: "Ammonia rising",
    short: "Phase 1",
    guidance:
      "Ammonia is present — the first bacteria colony is establishing. Don't add " +
      "livestock yet. Keep dosing/feeding lightly and wait for ammonia to peak, then fall " +
      "as nitrite appears.",
  },
  {
    stage: "nitrite",
    title: "Nitrite spike",
    short: "Phase 2",
    guidance:
      "Nitrite is climbing as ammonia converts. This phase can take a couple of weeks. " +
      "Stay patient — the cycle is nearly there once nitrite peaks and begins dropping " +
      "while nitrate rises.",
  },
  {
    stage: "cycled",
    title: "Cycled",
    short: "Ready",
    guidance:
      "Ammonia and nitrite read zero and nitrate is present — your biofilter is " +
      "established. Do a water change to lower nitrate, then add livestock slowly and keep " +
      "logging parameters.",
  },
];

/** Map the 5-value CycleStage onto the 4-step visual index. */
function visualIndex(stage: CycleStage): number {
  if (stage === "nitrate") return ORDER.indexOf("nitrite"); // late conversion phase
  return ORDER.indexOf(stage);
}

function StepIcon({
  state,
}: {
  state: "done" | "current" | "upcoming";
}): React.ReactElement {
  const Icon: LucideIcon =
    state === "done" ? CheckCircle2 : state === "current" ? CircleDot : Circle;
  return (
    <Icon
      className={cn(
        "h-5 w-5 shrink-0",
        state === "done" && "text-lagoon-300",
        state === "current" && "text-coral-300",
        state === "upcoming" && "text-abyss-200/40",
      )}
      aria-hidden
    />
  );
}

export function CycleTracker({ latest }: { latest: ParameterRow | null }) {
  const stage: CycleStage = latest ? cycleStage(latest) : "not-started";
  const activeIdx = visualIndex(stage);
  const current = STEPS[activeIdx] ?? STEPS[0]!;
  const cycled = stage === "cycled";

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <SectionLabel>Nitrogen cycle</SectionLabel>
        <Badge tone={cycled ? "healthy" : "caution"}>
          {cycled ? "Cycled" : "Cycling"}
        </Badge>
      </div>

      <ol className="flex flex-col gap-0 sm:flex-row sm:items-start sm:gap-0">
        {STEPS.map((step, i) => {
          const state: "done" | "current" | "upcoming" =
            i < activeIdx ? "done" : i === activeIdx ? "current" : "upcoming";
          const isLast = i === STEPS.length - 1;
          return (
            <li
              key={step.stage}
              aria-current={state === "current" ? "step" : undefined}
              className="relative flex flex-1 items-start gap-3 pb-5 sm:flex-col sm:items-center sm:gap-2 sm:pb-0 sm:text-center"
            >
              {/* Connector line to the next step */}
              {!isLast && (
                <span
                  aria-hidden
                  className={cn(
                    // vertical on mobile, horizontal on desktop
                    "absolute left-[9px] top-6 h-[calc(100%-1rem)] w-0.5 sm:left-1/2 sm:top-[9px] sm:h-0.5 sm:w-full",
                    i < activeIdx ? "bg-lagoon-400/40" : "bg-white/10",
                  )}
                />
              )}
              <span className="relative z-10 grid place-items-center rounded-full bg-abyss-950 sm:bg-transparent">
                <StepIcon state={state} />
              </span>
              <div className="min-w-0 sm:mt-1">
                <p
                  className={cn(
                    "text-sm font-medium",
                    state === "upcoming"
                      ? "text-abyss-200/50"
                      : "text-abyss-50",
                  )}
                >
                  {step.title}
                </p>
                <p className="text-xs text-abyss-200/50">{step.short}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-lagoon-300">
          {current.title}
          {!latest && " — log a reading to track progress"}
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-abyss-100/80">
          {current.guidance}
        </p>
      </div>
    </Card>
  );
}
