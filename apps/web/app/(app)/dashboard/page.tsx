import Link from "next/link";
import type { Metadata } from "next";
import {
  Fish,
  Waves,
  MessageCircle,
  Camera,
  FlaskConical,
  Bell,
  Stethoscope,
  CheckCircle2,
  ArrowRight,
  Droplets,
  CalendarClock,
  Activity,
} from "lucide-react";
import {
  Card,
  SectionLabel,
  LinkButton,
  Badge,
  UrgencyBadge,
  DisclaimerBanner,
  EmptyState,
  Stat,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  getSessionUser,
  getActiveTank,
  getLatestParameters,
  listReminders,
  listDiagnoses,
} from "@/lib/data";
import {
  classifyParameter,
  classifyReading,
  cycleStage,
  TARGET_RANGES,
  type ParamKey,
  type ParamStatus,
  type ParameterRow,
  type Reminder,
  type Tank,
  type TankType,
} from "@reef/shared";
import type { LucideIcon } from "lucide-react";

export const metadata: Metadata = { title: "Dashboard" };

/* ─────────────────────────── small helpers ─────────────────────────── */

const TANK_TYPE_LABEL: Record<TankType, string> = {
  fowlr: "Fish-only / live rock",
  soft: "Soft coral",
  lps: "LPS reef",
  sps: "SPS reef",
  mixed: "Mixed reef",
  nano: "Nano reef",
};

const REMINDER_KIND_LABEL: Record<string, string> = {
  test: "Test",
  "water-change": "Water change",
  maintenance: "Maintenance",
  dose: "Dosing",
  feed: "Feeding",
};

/** Map a parameter status to a Stat/Badge tone. */
function statusTone(status: ParamStatus | string): "neutral" | "healthy" | "caution" | "danger" {
  switch (status) {
    case "ok":
      return "healthy";
    case "low":
    case "high":
      return "caution";
    case "critical":
      return "danger";
    default:
      return "neutral";
  }
}

/** Human label for an out-of-range status. */
function statusLabel(status: string): string {
  switch (status) {
    case "low":
      return "Low";
    case "high":
      return "High";
    case "critical":
      return "Critical";
    case "ok":
      return "In range";
    default:
      return "—";
  }
}

const CYCLE_LABEL: Record<string, string> = {
  "not-started": "Not started",
  ammonia: "Ammonia phase",
  nitrite: "Nitrite phase",
  nitrate: "Nitrate phase",
  cycled: "Fully cycled",
};

/** Format a numeric value for display with a sensible precision per key. */
function fmtParam(key: ParamKey, value: number, unit: string): string {
  let num: string;
  if (key === "salinity_sg") num = value.toFixed(4);
  else if (key === "ph") num = value.toFixed(2);
  else if (key === "alkalinity_dkh") num = value.toFixed(1);
  else if (key === "phosphate_ppm") num = value.toFixed(2);
  else if (key === "temp_c") num = value.toFixed(1);
  else num = String(Math.round(value));
  return unit ? `${num} ${unit}` : num;
}

const DAY_MS = 86_400_000;

/** Whole days since an ISO date (UTC-safe). Null when no date. */
function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.floor((Date.now() - then) / DAY_MS));
}

/** Whole days until an ISO date (negative = overdue). */
function daysUntil(iso: string): number {
  const due = new Date(iso).getTime();
  return Math.round((due - Date.now()) / DAY_MS);
}

function dueLabel(iso: string): { text: string; tone: "neutral" | "caution" | "danger" | "healthy" } {
  const d = daysUntil(iso);
  if (d < 0) return { text: `Overdue by ${Math.abs(d)}d`, tone: "danger" };
  if (d === 0) return { text: "Due today", tone: "danger" };
  if (d === 1) return { text: "Due tomorrow", tone: "caution" };
  if (d <= 3) return { text: `Due in ${d}d`, tone: "caution" };
  return { text: `Due in ${d}d`, tone: "neutral" };
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/* ─────────────────────────── page ─────────────────────────── */

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tank?: string }>;
}) {
  const [{ tank: preferredTank }, user] = await Promise.all([
    searchParams,
    getSessionUser(),
  ]);

  const activeTank = await getActiveTank(preferredTank);

  const firstName = (user.full_name || "").trim().split(/\s+/)[0] || "Reefer";
  const greeting = greetingFor(new Date());

  /* No tanks yet → first-run experience. */
  if (!activeTank) {
    return (
      <div className="space-y-8">
        <header className="space-y-1">
          <SectionLabel>Dashboard</SectionLabel>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-abyss-50">
            {greeting}, {firstName}.
          </h1>
          <p className="text-abyss-200/70">
            Let&apos;s get your reef set up so the Doctor can keep an eye on it.
          </p>
        </header>

        <EmptyState
          icon={Fish}
          title="Add your first tank"
          description="Create a tank to start logging parameters, tracking livestock, and unlocking AI diagnosis tuned to your setup."
          action={
            <LinkButton href="/tanks">
              <Fish className="h-4 w-4" /> Add a tank
            </LinkButton>
          }
        />

        <DisclaimerBanner />
      </div>
    );
  }

  const tankParam = `?tank=${activeTank.id}`;

  /* Load the rest of the dashboard data in parallel. */
  const [latest, reminders, diagnoses] = await Promise.all([
    getLatestParameters(activeTank.id),
    listReminders(),
    listDiagnoses(activeTank.id),
  ]);

  const tankReminders = reminders
    .filter((r) => r.tank_id === activeTank.id)
    .slice(0, 3);
  const recentDiagnoses = diagnoses.slice(0, 3);

  return (
    <div className="space-y-8">
      {/* Greeting + tank context */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <SectionLabel>Dashboard</SectionLabel>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-abyss-50">
            {greeting}, {firstName}.
          </h1>
          <p className="flex items-center gap-2 text-abyss-200/70">
            <Waves className="h-4 w-4 text-lagoon-300" aria-hidden />
            <span>
              Watching{" "}
              <span className="font-medium text-abyss-100">{activeTank.name}</span> —{" "}
              {TANK_TYPE_LABEL[activeTank.type]}
            </span>
          </p>
        </div>
        <LinkButton href={`/doctor${tankParam}`} variant="secondary" className="self-start sm:self-auto">
          <MessageCircle className="h-4 w-4" /> Ask the Doctor
        </LinkButton>
      </header>

      {/* Top stat row */}
      <StatRow tank={activeTank} latest={latest} />

      {/* Health at a glance + cycle */}
      <HealthAtAGlance tank={activeTank} latest={latest} tankParam={tankParam} />

      {/* Quick actions */}
      <section aria-labelledby="quick-actions-heading">
        <h2 id="quick-actions-heading" className="sr-only">
          Quick actions
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <QuickAction
            href={`/doctor${tankParam}`}
            icon={MessageCircle}
            title="Ask the Reef Doctor"
            description="Chat through symptoms, dosing, and care questions."
          />
          <QuickAction
            href={`/diagnose${tankParam}`}
            icon={Camera}
            title="Photo diagnosis"
            description="Upload a photo of a fish, coral, or algae for analysis."
          />
          <QuickAction
            href={`/parameters${tankParam}`}
            icon={FlaskConical}
            title="Log parameters"
            description="Record a test and see how your chemistry is trending."
          />
        </div>
      </section>

      {/* Reminders + diagnoses */}
      <div className="grid gap-6 lg:grid-cols-2">
        <RemindersCard reminders={tankReminders} tankParam={tankParam} />
        <DiagnosesCard diagnoses={recentDiagnoses} tankParam={tankParam} />
      </div>

      <DisclaimerBanner />
    </div>
  );
}

function greetingFor(d: Date): string {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/* ─────────────────────────── Stat row ─────────────────────────── */

function StatRow({ tank, latest }: { tank: Tank; latest: ParameterRow | null }) {
  const started = daysSince(tank.started_at);
  const volume = `${Math.round(tank.volume_liters)} L`;
  const volumeGal = Math.round(tank.volume_liters / 3.785);

  const KEY_PARAMS: ParamKey[] = [
    "alkalinity_dkh",
    "calcium_ppm",
    "nitrate_ppm",
    "temp_c",
  ];

  return (
    <section aria-label="Tank summary" className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      <Stat
        label="Tank"
        value={TANK_TYPE_LABEL[tank.type].split(" ")[0]}
        sub={`${volume} · ${volumeGal} gal`}
      />
      {KEY_PARAMS.map((key) => {
        const range = TARGET_RANGES[tank.type][key];
        const value = latest ? latest[key] : null;
        if (value === null || value === undefined || !range) {
          return (
            <Stat
              key={key}
              label={range?.label ?? key}
              value="—"
              sub="No reading"
            />
          );
        }
        const status = classifyParameter(key, value, tank.type);
        return (
          <Stat
            key={key}
            label={range.label}
            value={fmtParam(key, value, range.unit)}
            sub={`Target ${fmtParam(key, range.min, "")}–${fmtParam(key, range.max, range.unit)}`}
            tone={statusTone(status)}
          />
        );
      })}
      <Stat
        label="Days running"
        value={started === null ? "—" : started}
        sub={tank.started_at ? `Since ${fmtDate(tank.started_at)}` : "No start date"}
      />
    </section>
  );
}

/* ─────────────────────────── Health at a glance ─────────────────────────── */

function HealthAtAGlance({
  tank,
  latest,
  tankParam,
}: {
  tank: Tank;
  latest: ParameterRow | null;
  tankParam: string;
}) {
  return (
    <Card>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <SectionLabel>Tank health at a glance</SectionLabel>
          <h2 className="font-display text-xl font-semibold text-abyss-50">
            Water chemistry
          </h2>
        </div>
        <Link
          href={`/parameters${tankParam}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-lagoon-300 transition hover:text-lagoon-200"
        >
          View all <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {latest ? (
        <HealthBody tank={tank} latest={latest} />
      ) : (
        <EmptyState
          icon={Droplets}
          title="No readings yet"
          description="Log your first water test to see how your chemistry stacks up against targets for this tank type."
          action={
            <LinkButton href={`/parameters${tankParam}`}>
              <FlaskConical className="h-4 w-4" /> Log a reading
            </LinkButton>
          }
        />
      )}
    </Card>
  );
}

function HealthBody({ tank, latest }: { tank: Tank; latest: ParameterRow }) {
  const classified = classifyReading(latest, tank.type);
  const outOfRange = classified.filter((c) => c.status !== "ok" && c.status !== "unknown");
  const stage = cycleStage(latest);

  // Sort critical first, then others.
  const ordered = [...outOfRange].sort((a, b) => {
    const rank = (s: string) => (s === "critical" ? 0 : 1);
    return rank(a.status) - rank(b.status);
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-abyss-200/60">
          Measured {fmtDate(latest.measured_at)}
        </span>
        <span aria-hidden className="text-abyss-200/30">
          •
        </span>
        <span className="inline-flex items-center gap-1.5 text-abyss-200/70">
          <Activity className="h-3.5 w-3.5 text-lagoon-300" aria-hidden />
          Cycle:{" "}
          <Badge tone={stage === "cycled" ? "healthy" : stage === "not-started" ? "neutral" : "caution"}>
            {CYCLE_LABEL[stage] ?? stage}
          </Badge>
        </span>
      </div>

      {ordered.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-lagoon-400/25 bg-lagoon-500/[0.08] px-4 py-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-lagoon-500/15 text-lagoon-300">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <div>
            <p className="font-medium text-lagoon-100">Everything looks healthy</p>
            <p className="text-sm text-abyss-200/70">
              All measured parameters are within target range for a{" "}
              {TANK_TYPE_LABEL[tank.type].toLowerCase()} tank. Keep it up.
            </p>
          </div>
        </div>
      ) : (
        <div>
          <p className="mb-3 text-sm text-abyss-200/70">
            {ordered.length} parameter{ordered.length > 1 ? "s" : ""} need
            {ordered.length > 1 ? "" : "s"} attention:
          </p>
          <ul className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/5">
            {ordered.map(({ key, value, status }) => {
              const range = TARGET_RANGES[tank.type][key];
              const label = range?.label ?? key;
              return (
                <li
                  key={key}
                  className="flex items-center justify-between gap-3 bg-white/[0.02] px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-abyss-50">{label}</p>
                    {range && (
                      <p className="text-xs text-abyss-200/60">
                        Target {fmtParam(key, range.min, "")}–
                        {fmtParam(key, range.max, range.unit)}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span
                      className={cn(
                        "font-display text-lg font-semibold tabular-nums",
                        status === "critical" ? "text-coral-300" : "text-amber-300",
                      )}
                    >
                      {range ? fmtParam(key, value, range.unit) : value}
                    </span>
                    <Badge tone={statusTone(status)}>{statusLabel(status)}</Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Quick action tile ─────────────────────────── */

function QuickAction({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group reef-card flex flex-col gap-3 transition hover:border-lagoon-400/30 hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-lagoon-400 focus-visible:ring-offset-2 focus-visible:ring-offset-abyss-950"
    >
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-lagoon-500/15 text-lagoon-300 transition group-hover:bg-lagoon-500/25">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="flex items-center gap-1.5 font-display text-base font-semibold text-abyss-50">
          {title}
          <ArrowRight className="h-4 w-4 -translate-x-1 text-lagoon-300 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
        </p>
        <p className="mt-0.5 text-sm text-abyss-200/70">{description}</p>
      </div>
    </Link>
  );
}

/* ─────────────────────────── Reminders card ─────────────────────────── */

function RemindersCard({
  reminders,
  tankParam,
}: {
  reminders: Reminder[];
  tankParam: string;
}) {
  return (
    <Card>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <SectionLabel>Upcoming</SectionLabel>
          <h2 className="font-display text-xl font-semibold text-abyss-50">
            Reminders
          </h2>
        </div>
        <Link
          href={`/reminders${tankParam}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-lagoon-300 transition hover:text-lagoon-200"
        >
          All <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {reminders.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No reminders scheduled"
          description="Set up maintenance reminders so tests and water changes never slip."
          action={
            <LinkButton href={`/reminders${tankParam}`} variant="secondary">
              <Bell className="h-4 w-4" /> Add a reminder
            </LinkButton>
          }
        />
      ) : (
        <ul className="space-y-2.5">
          {reminders.map((r) => {
            const due = dueLabel(r.due_at);
            return (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/5 text-lagoon-300">
                    <CalendarClock className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-abyss-50">{r.title}</p>
                    <p className="truncate text-xs text-abyss-200/60">
                      {REMINDER_KIND_LABEL[r.kind] ?? r.kind}
                      {r.recurrence !== "none" ? ` · ${r.recurrence}` : ""}
                    </p>
                  </div>
                </div>
                <Badge tone={due.tone}>{due.text}</Badge>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ─────────────────────────── Diagnoses card ─────────────────────────── */

type DiagnosisRow = Awaited<ReturnType<typeof listDiagnoses>>[number];

function DiagnosesCard({
  diagnoses,
  tankParam,
}: {
  diagnoses: DiagnosisRow[];
  tankParam: string;
}) {
  return (
    <Card>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <SectionLabel>Recent</SectionLabel>
          <h2 className="font-display text-xl font-semibold text-abyss-50">
            Diagnoses
          </h2>
        </div>
        <Link
          href={`/diagnose${tankParam}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-lagoon-300 transition hover:text-lagoon-200"
        >
          New <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {diagnoses.length === 0 ? (
        <EmptyState
          icon={Stethoscope}
          title="No diagnoses yet"
          description="Run a photo or symptom diagnosis to build a health history for this tank."
          action={
            <LinkButton href={`/diagnose${tankParam}`} variant="secondary">
              <Camera className="h-4 w-4" /> Start a diagnosis
            </LinkButton>
          }
        />
      ) : (
        <ul className="space-y-2.5">
          {diagnoses.map((d) => (
            <li
              key={d.id}
              className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-abyss-50">{d.summary}</p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-abyss-200/50">
                    {d.kind} · {fmtDate(d.created_at)}
                  </p>
                </div>
                <span className="shrink-0">
                  <UrgencyBadge urgency={d.urgency} />
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
