import Link from "next/link";
import { Waves, Fish, Flower2, Droplets, Calendar, ChevronRight } from "lucide-react";
import {
  Card,
  SectionLabel,
  Badge,
  EmptyState,
  DisclaimerBanner,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  listTanks,
  listLivestock,
  getLatestParameters,
} from "@/lib/data";
import {
  classifyReading,
  cycleStage,
  type Tank,
  type ParameterRow,
  type Livestock,
} from "@reef/shared";
import { NewTankForm } from "./new-tank-form";

export const metadata = { title: "Tanks · Reef Doctor" };

const TYPE_LABELS: Record<string, string> = {
  fowlr: "FOWLR",
  soft: "Soft coral",
  lps: "LPS",
  sps: "SPS",
  mixed: "Mixed reef",
  nano: "Nano",
};

type Health = {
  tone: "healthy" | "caution" | "danger" | "neutral";
  label: string;
};

/** Derive an at-a-glance health signal from the most recent reading. */
function healthFromReading(
  tank: Tank,
  latest: ParameterRow | null,
): Health {
  if (!latest) return { tone: "neutral", label: "No data yet" };
  const stage = cycleStage(latest);
  if (stage !== "cycled" && stage !== "not-started") {
    return { tone: "caution", label: "Cycling" };
  }
  const results = classifyReading(latest, tank.type);
  if (results.some((r) => r.status === "critical")) {
    return { tone: "danger", label: "Needs attention" };
  }
  if (results.some((r) => r.status === "low" || r.status === "high")) {
    return { tone: "caution", label: "Out of range" };
  }
  return { tone: "healthy", label: "Healthy" };
}

const DOT_TONE: Record<Health["tone"], string> = {
  healthy: "bg-lagoon-400 shadow-[0_0_10px_2px_rgba(45,212,191,0.5)]",
  caution: "bg-amber-400 shadow-[0_0_10px_2px_rgba(251,191,36,0.45)]",
  danger: "bg-coral-400 shadow-[0_0_10px_2px_rgba(251,113,133,0.5)]",
  neutral: "bg-abyss-300/50",
};

function tankAge(startedAt?: string | null): string | null {
  if (!startedAt) return null;
  const start = new Date(startedAt);
  if (Number.isNaN(start.getTime())) return null;
  const now = new Date();
  const months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());
  if (months < 1) return "New";
  if (months < 12) return `${months} mo`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem ? `${years}y ${rem}m` : `${years}y`;
}

function volumeGallons(liters: number): number {
  return Math.round(liters / 3.785);
}

function countByKind(livestock: Livestock[]) {
  const alive = livestock.filter((l) => l.status === "alive");
  return {
    total: alive.length,
    fish: alive.filter((l) => l.kind === "fish").length,
    coral: alive.filter((l) => l.kind === "coral").length,
    invert: alive.filter((l) => l.kind === "invert").length,
  };
}

export default async function TanksPage() {
  const tanks = await listTanks();

  const cards = await Promise.all(
    tanks.map(async (tank) => {
      const [livestock, latest] = await Promise.all([
        listLivestock(tank.id),
        getLatestParameters(tank.id),
      ]);
      return {
        tank,
        counts: countByKind(livestock),
        health: healthFromReading(tank, latest),
        measuredAt: latest?.measured_at ?? null,
      };
    }),
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <SectionLabel>Your systems</SectionLabel>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-abyss-50">
            Tank logbook
          </h1>
          <p className="mt-2 max-w-prose text-abyss-200/70">
            Every system you keep, with its livestock, water chemistry and
            history in one place — your digital twin of the reef.
          </p>
        </div>
      </header>

      {tanks.length === 0 ? (
        <EmptyState
          icon={Waves}
          title="No tanks yet"
          description="Add your first system to start logging parameters, building a livestock inventory and tracking its journey."
          action={<NewTankForm />}
        />
      ) : (
        <>
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map(({ tank, counts, health, measuredAt }, i) => (
              <li
                key={tank.id}
                className="reef-reveal"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <Link
                  href={`/tanks/${tank.id}`}
                  className="group block h-full rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-lagoon-400 focus-visible:ring-offset-2 focus-visible:ring-offset-abyss-950"
                >
                  <Card className="flex h-full flex-col transition duration-200 group-hover:border-lagoon-400/30 group-hover:bg-white/[0.06]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate font-display text-xl font-semibold text-abyss-50">
                          {tank.name}
                        </h2>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge tone="brand">
                            {TYPE_LABELS[tank.type] ?? tank.type}
                          </Badge>
                          <span className="inline-flex items-center gap-1.5 text-xs text-abyss-200/70">
                            <span
                              className={cn(
                                "h-2 w-2 rounded-full",
                                DOT_TONE[health.tone],
                              )}
                              aria-hidden
                            />
                            {health.label}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-abyss-300/40 transition group-hover:translate-x-0.5 group-hover:text-lagoon-300" />
                    </div>

                    <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                      <div className="flex items-center gap-2 text-abyss-200/70">
                        <Droplets className="h-4 w-4 text-lagoon-300/80" aria-hidden />
                        <dt className="sr-only">Volume</dt>
                        <dd>
                          {tank.volume_liters} L
                          <span className="text-abyss-200/40">
                            {" "}
                            · {volumeGallons(tank.volume_liters)} gal
                          </span>
                        </dd>
                      </div>
                      <div className="flex items-center gap-2 text-abyss-200/70">
                        <Calendar className="h-4 w-4 text-lagoon-300/80" aria-hidden />
                        <dt className="sr-only">Age</dt>
                        <dd>{tankAge(tank.started_at) ?? "Age unknown"}</dd>
                      </div>
                      <div className="flex items-center gap-2 text-abyss-200/70">
                        <Fish className="h-4 w-4 text-lagoon-300/80" aria-hidden />
                        <dt className="sr-only">Fish</dt>
                        <dd>
                          {counts.fish} fish · {counts.invert} invert
                        </dd>
                      </div>
                      <div className="flex items-center gap-2 text-abyss-200/70">
                        <Flower2 className="h-4 w-4 text-lagoon-300/80" aria-hidden />
                        <dt className="sr-only">Coral</dt>
                        <dd>{counts.coral} coral</dd>
                      </div>
                    </dl>

                    <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-abyss-200/50">
                      <span>{counts.total} living inhabitants</span>
                      {measuredAt && (
                        <span>
                          Tested{" "}
                          {new Date(measuredAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      )}
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>

          <div className="pt-2">
            <NewTankForm />
          </div>
        </>
      )}

      <DisclaimerBanner />

      {/* Scoped entrance motion — respects reduced-motion via media query. */}
      <style>{`
        .reef-reveal {
          opacity: 0;
          animation: reefReveal 0.5s ease-out forwards;
        }
        @keyframes reefReveal {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .reef-reveal { animation: none; opacity: 1; }
        }
      `}</style>
    </div>
  );
}
