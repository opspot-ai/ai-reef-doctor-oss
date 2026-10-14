import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Fish,
  Flower2,
  Shell,
  Wrench,
  ClipboardList,
  FlaskConical,
  StickyNote,
  Skull,
  CircleSlash,
} from "lucide-react";
import {
  Card,
  SectionLabel,
  Badge,
  Stat,
  EmptyState,
  DisclaimerBanner,
  LinkButton,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  getTank,
  listLivestock,
  getLatestParameters,
} from "@/lib/data";
import {
  classifyReading,
  cycleStage,
  TARGET_RANGES,
  type Tank,
  type ParameterRow,
  type Livestock,
} from "@reef/shared";
import { AddLivestockForm } from "../add-livestock-form";
import { DeleteTankButton } from "../new-tank-form";

const TYPE_LABELS: Record<string, string> = {
  fowlr: "Fish-only (FOWLR)",
  soft: "Soft coral",
  lps: "LPS dominant",
  sps: "SPS dominant",
  mixed: "Mixed reef",
  nano: "Nano",
};

const CYCLE_LABELS: Record<string, { label: string; tone: "healthy" | "caution" | "danger" | "neutral" }> = {
  "not-started": { label: "Not started", tone: "neutral" },
  ammonia: { label: "Cycling · ammonia", tone: "caution" },
  nitrite: { label: "Cycling · nitrite", tone: "caution" },
  nitrate: { label: "Cycling · nitrate", tone: "caution" },
  cycled: { label: "Cycled", tone: "healthy" },
};

const STATUS_TONE: Record<string, "healthy" | "caution" | "danger" | "neutral"> = {
  alive: "healthy",
  deceased: "danger",
  removed: "neutral",
};

function volumeGallons(liters: number): number {
  return Math.round(liters / 3.785);
}

function tankAge(startedAt?: string | null): string {
  if (!startedAt) return "Unknown";
  const start = new Date(startedAt);
  if (Number.isNaN(start.getTime())) return "Unknown";
  const now = new Date();
  const months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());
  if (months < 1) return "Under a month";
  if (months < 12) return `${months} months`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem ? `${years}y ${rem}m` : `${years} years`;
}

function fmtDate(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Overall health snapshot derived from the most recent reading. */
function paramHealth(tank: Tank, latest: ParameterRow | null) {
  if (!latest)
    return { tone: "neutral" as const, label: "No data yet", outOfRange: 0 };
  const results = classifyReading(latest, tank.type);
  const critical = results.filter((r) => r.status === "critical").length;
  const off = results.filter(
    (r) => r.status === "low" || r.status === "high",
  ).length;
  if (critical)
    return { tone: "danger" as const, label: "Needs attention", outOfRange: critical + off };
  if (off)
    return { tone: "caution" as const, label: "Out of range", outOfRange: off };
  return { tone: "healthy" as const, label: "All in range", outOfRange: 0 };
}

export default async function TankDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tank = await getTank(id);
  if (!tank) notFound();

  const [livestock, latest] = await Promise.all([
    listLivestock(tank.id),
    getLatestParameters(tank.id),
  ]);

  const stage = cycleStage(latest ?? ({} as ParameterRow));
  const cycle = CYCLE_LABELS[stage] ?? CYCLE_LABELS["not-started"]!;
  const health = paramHealth(tank, latest);

  const fishItems = livestock.filter((l) => l.kind === "fish");
  const coralItems = livestock.filter((l) => l.kind === "coral");
  const invertItems = livestock.filter((l) => l.kind === "invert");
  const groups: Array<{ key: string; label: string; icon: typeof Fish; items: Livestock[] }> = [
    { key: "fish", label: "Fish", icon: Fish, items: fishItems },
    { key: "coral", label: "Corals", icon: Flower2, items: coralItems },
    { key: "invert", label: "Invertebrates", icon: Shell, items: invertItems },
  ];
  const aliveCount = livestock.filter((l) => l.status === "alive").length;

  const tempTarget = TARGET_RANGES[tank.type].temp_c;

  return (
    <div className="space-y-8">
      {/* Back link */}
      <div>
        <Link
          href="/tanks"
          className="inline-flex items-center gap-1.5 text-sm text-abyss-200/70 transition hover:text-lagoon-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-lagoon-400 focus-visible:ring-offset-2 focus-visible:ring-offset-abyss-950 rounded"
        >
          <ArrowLeft className="h-4 w-4" /> All tanks
        </Link>
      </div>

      {/* Header + specs */}
      <header className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <SectionLabel>Digital twin</SectionLabel>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-abyss-50">
              {tank.name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge tone="brand">{TYPE_LABELS[tank.type] ?? tank.type}</Badge>
              <Badge tone={cycle.tone === "neutral" ? "neutral" : cycle.tone}>
                {cycle.label}
              </Badge>
              <Badge tone={health.tone === "neutral" ? "neutral" : health.tone}>
                {health.label}
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <LinkButton href={`/parameters?tank=${tank.id}`} variant="secondary">
              <FlaskConical className="h-4 w-4" /> Parameters
            </LinkButton>
            <LinkButton href={`/dashboard?tank=${tank.id}`}>
              View dashboard
            </LinkButton>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat
            label="Volume"
            value={`${tank.volume_liters} L`}
            sub={`${volumeGallons(tank.volume_liters)} gallons`}
          />
          <Stat label="Age" value={tankAge(tank.started_at)} sub={fmtDate(tank.started_at) ?? "Start date not set"} />
          <Stat
            label="Inhabitants"
            value={aliveCount}
            sub={`${fishItems.length} fish · ${coralItems.length} coral · ${invertItems.length} invert`}
          />
          <Stat
            label="Temperature"
            value={latest?.temp_c != null ? `${latest.temp_c} °C` : "—"}
            sub={
              tempTarget
                ? `Target ${tempTarget.min}–${tempTarget.max} °C`
                : "No reading"
            }
            tone={
              latest?.temp_c == null
                ? "neutral"
                : classifyReading(latest, tank.type).find(
                      (r) => r.key === "temp_c",
                    )?.status === "ok"
                  ? "healthy"
                  : "caution"
            }
          />
        </div>

        {tank.notes && (
          <Card className="!p-4">
            <div className="flex items-start gap-3">
              <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-lagoon-300" />
              <p className="text-sm leading-relaxed text-abyss-100/85">
                {tank.notes}
              </p>
            </div>
          </Card>
        )}
      </header>

      {/* Livestock inventory */}
      <section aria-labelledby="livestock-heading" className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <SectionLabel>Inventory</SectionLabel>
            <h2
              id="livestock-heading"
              className="font-display text-2xl font-semibold text-abyss-50"
            >
              Livestock
            </h2>
          </div>
          <AddLivestockForm tankId={tank.id} />
        </div>

        {livestock.length === 0 ? (
          <EmptyState
            icon={Fish}
            title="No livestock logged"
            description="Add your fish, corals and inverts to build a living inventory of this tank."
          />
        ) : (
          <div className="space-y-6">
            {groups.map(({ key, label, icon: Icon, items }) => {
                if (!items.length) return null;
                return (
                  <div key={key}>
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-abyss-100">
                      <Icon className="h-4 w-4 text-lagoon-300" aria-hidden />
                      {label}
                      <span className="text-abyss-200/50">({items.length})</span>
                    </h3>
                    <ul className="grid gap-3 sm:grid-cols-2">
                      {items.map((l) => (
                        <li key={l.id}>
                          <Card className="!p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-medium text-abyss-50">
                                  {l.common_name}
                                  {l.nickname && (
                                    <span className="text-abyss-200/60">
                                      {" "}
                                      “{l.nickname}”
                                    </span>
                                  )}
                                </p>
                                {l.scientific_name && (
                                  <p className="mt-0.5 truncate text-sm italic text-abyss-200/60">
                                    {l.scientific_name}
                                  </p>
                                )}
                              </div>
                              <Badge tone={STATUS_TONE[l.status] ?? "neutral"}>
                                {l.status === "deceased" && (
                                  <Skull className="h-3 w-3" aria-hidden />
                                )}
                                {l.status === "removed" && (
                                  <CircleSlash className="h-3 w-3" aria-hidden />
                                )}
                                {l.status}
                              </Badge>
                            </div>
                            {(fmtDate(l.added_at) || l.notes) && (
                              <div className="mt-3 space-y-1 border-t border-white/10 pt-3 text-xs text-abyss-200/60">
                                {fmtDate(l.added_at) && (
                                  <p>Added {fmtDate(l.added_at)}</p>
                                )}
                                {l.notes && (
                                  <p className="text-abyss-100/70">{l.notes}</p>
                                )}
                              </div>
                            )}
                          </Card>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              },
            )}
          </div>
        )}
      </section>

      {/* Equipment + Journal */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="equipment-heading">
          <SectionLabel>Hardware</SectionLabel>
          <h2
            id="equipment-heading"
            className="mb-4 font-display text-2xl font-semibold text-abyss-50"
          >
            Equipment
          </h2>
          <EmptyState
            icon={Wrench}
            title="No equipment tracked yet"
            description="Pumps, skimmers, dosers, lighting and controllers will appear here once equipment tracking is connected."
          />
        </section>

        <section aria-labelledby="journal-heading">
          <SectionLabel>History</SectionLabel>
          <h2
            id="journal-heading"
            className="mb-4 font-display text-2xl font-semibold text-abyss-50"
          >
            Journal &amp; timeline
          </h2>
          {tank.notes ? (
            <Card>
              <ol className="relative space-y-5 border-l border-white/10 pl-5">
                <li className="relative">
                  <span className="absolute -left-[1.42rem] top-1.5 h-2.5 w-2.5 rounded-full bg-lagoon-400 shadow-[0_0_8px_2px_rgba(45,212,191,0.4)]" aria-hidden />
                  <p className="text-xs text-abyss-200/50">
                    {fmtDate(tank.started_at) ?? fmtDate(tank.created_at) ?? "Setup"}
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-abyss-50">
                    Tank established
                  </p>
                  <p className="mt-1 text-sm text-abyss-100/75">{tank.notes}</p>
                </li>
              </ol>
              <p className="mt-5 flex items-center gap-2 text-xs text-abyss-200/50">
                <ClipboardList className="h-3.5 w-3.5" />
                A full event journal (dosing, additions, observations) is coming
                soon.
              </p>
            </Card>
          ) : (
            <EmptyState
              icon={ClipboardList}
              title="No journal entries yet"
              description="Milestones, additions, dosing changes and observations will form a timeline here as you log them."
            />
          )}
        </section>
      </div>

      <DisclaimerBanner />

      {/* Danger zone */}
      <section aria-labelledby="danger-heading">
        <SectionLabel>Danger zone</SectionLabel>
        <h2 id="danger-heading" className="sr-only">
          Danger zone
        </h2>
        <Card className="border-coral-400/20 bg-coral-500/[0.04]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-medium text-abyss-50">Delete this tank</h3>
              <p className="mt-1 max-w-prose text-sm text-abyss-200/70">
                Removes the tank along with its livestock, parameter history and
                journal. This action is permanent.
              </p>
            </div>
            <DeleteTankButton tankId={tank.id} tankName={tank.name} />
          </div>
        </Card>
      </section>
    </div>
  );
}
