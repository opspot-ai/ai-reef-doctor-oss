import type { Metadata } from "next";
import {
  FileText,
  Droplets,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Activity,
  CalendarClock,
  Sparkles,
  Lock,
  TrendingUp,
} from "lucide-react";
import {
  Card,
  SectionLabel,
  Badge,
  LinkButton,
  DisclaimerBanner,
  EmptyState,
  Stat,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  getActiveTank,
  getLatestParameters,
  getParameterHistory,
  listReminders,
  listDiagnoses,
  getSessionEntitlements,
  isDemoMode,
} from "@/lib/data";
import {
  classifyReading,
  cycleStage,
  canUse,
  TARGET_RANGES,
  TIERS,
  type ParamKey,
  type ParameterRow,
  type Reminder,
  type Tank,
  type TankType,
} from "@reef/shared";
import { ReportNarrative, Recommendations } from "./report-narrative";

export const metadata: Metadata = {
  title: "Weekly Report · Reef Doctor",
  description:
    "An AI-grounded weekly health report for your reef: overall status, prioritized actions, and a parameter snapshot.",
};

/* ─────────────────────────── labels & formatting ─────────────────────────── */

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

const STATUS_TONE: Record<string, "healthy" | "caution" | "danger" | "neutral"> =
  {
    ok: "healthy",
    low: "caution",
    high: "caution",
    critical: "danger",
    unknown: "neutral",
  };

const STATUS_LABEL: Record<string, string> = {
  ok: "In range",
  low: "Low",
  high: "High",
  critical: "Critical",
  unknown: "—",
};

const CYCLE_LABEL: Record<string, string> = {
  "not-started": "Not started",
  ammonia: "Ammonia phase",
  nitrite: "Nitrite phase",
  nitrate: "Nitrate phase",
  cycled: "Fully cycled",
};

function fmtParam(key: ParamKey, value: number, unit: string): string {
  let num: string;
  if (key === "salinity_sg") num = value.toFixed(4);
  else if (key === "ph") num = value.toFixed(2);
  else if (key === "alkalinity_dkh") num = value.toFixed(1);
  else if (key === "phosphate_ppm") num = value.toFixed(3);
  else if (key === "nitrate_ppm") num = value.toFixed(1);
  else if (key === "temp_c") num = value.toFixed(1);
  else num = String(Math.round(value));
  return unit ? `${num} ${unit}` : num;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

const DAY_MS = 86_400_000;

function daysUntil(iso: string): number {
  return Math.round((new Date(iso).getTime() - Date.now()) / DAY_MS);
}

/* ─────────────────────────── deterministic health model ─────────────────────────── */

type Severity = "healthy" | "caution" | "danger";

interface HealthReport {
  /** Overall computed status across params + reminders. */
  status: Severity;
  headline: string;
  /** Out-of-range parameter classifications, critical first. */
  issues: { key: ParamKey; value: number; status: string }[];
  /** Reminders past their due date. */
  overdue: Reminder[];
  cycle: ReturnType<typeof cycleStage>;
  /** Prioritized, deterministic action items. */
  recommendations: string[];
}

const SEVERITY_RANK = (s: string) => (s === "critical" ? 0 : 1);

/**
 * Build the report entirely from local data — no AI required. This is the
 * source of truth the page renders; the AI narrative is purely additive.
 */
function buildReport(
  tank: Tank,
  latest: ParameterRow | null,
  reminders: Reminder[],
): HealthReport {
  const tankType = tank.type as TankType;
  const ranges = TARGET_RANGES[tankType];

  const classified = latest ? classifyReading(latest, tankType) : [];
  const issues = classified
    .filter((c) => c.status !== "ok" && c.status !== "unknown")
    .sort((a, b) => SEVERITY_RANK(a.status) - SEVERITY_RANK(b.status));

  const overdue = reminders
    .filter((r) => r.tank_id === tank.id && r.active && daysUntil(r.due_at) < 0)
    .sort((a, b) => a.due_at.localeCompare(b.due_at));

  const cycle = latest ? cycleStage(latest) : "not-started";

  const hasCritical = issues.some((i) => i.status === "critical");
  const cycleUnsafe = cycle === "ammonia" || cycle === "nitrite";

  let status: Severity = "healthy";
  if (hasCritical || cycleUnsafe) status = "danger";
  else if (issues.length > 0 || overdue.length > 0) status = "caution";

  // Prioritized recommendations: critical params → unsafe cycle → other
  // out-of-range params → overdue tasks. Deterministic, knowledge-aligned text.
  const recommendations: string[] = [];

  for (const i of issues.filter((x) => x.status === "critical")) {
    const label = ranges[i.key]?.label ?? i.key;
    recommendations.push(
      `Address ${label} immediately — it's in the critical zone (${fmtParam(
        i.key,
        i.value,
        ranges[i.key]?.unit ?? "",
      )}). Correct it gradually and re-test before adding livestock.`,
    );
  }

  if (cycle === "ammonia") {
    recommendations.push(
      "Ammonia is present: the tank is still cycling. Hold off on new livestock and keep testing until ammonia and nitrite read zero.",
    );
  } else if (cycle === "nitrite") {
    recommendations.push(
      "Nitrite is spiking: stay the course on the cycle, avoid feeding heavily, and wait for nitrite to clear to zero before stocking.",
    );
  }

  for (const i of issues.filter((x) => x.status !== "critical")) {
    const label = ranges[i.key]?.label ?? i.key;
    const dir = i.status === "low" ? "below" : "above";
    const target = ranges[i.key];
    recommendations.push(
      `Bring ${label} back into range — it's ${dir} target${
        target
          ? ` (${fmtParam(i.key, i.value, target.unit)} vs ${fmtParam(
              i.key,
              target.min,
              "",
            )}–${fmtParam(i.key, target.max, target.unit)})`
          : ""
      }. Adjust slowly and stably.`,
    );
  }

  for (const r of overdue) {
    const days = Math.abs(daysUntil(r.due_at));
    recommendations.push(
      `Complete the overdue task "${r.title}" (${
        REMINDER_KIND_LABEL[r.kind] ?? r.kind
      }), now ${days} day${days === 1 ? "" : "s"} past due.`,
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "No action needed this week — parameters are in range and tasks are on schedule. Keep logging tests to maintain the trend.",
    );
  }

  const headline =
    status === "danger"
      ? "Your reef needs attention"
      : status === "caution"
        ? "A few things to keep an eye on"
        : "Your reef is in good shape";

  return { status, headline, issues, overdue, cycle, recommendations };
}

const OVERALL: Record<
  Severity,
  { tone: "healthy" | "caution" | "danger"; icon: typeof Activity; label: string }
> = {
  healthy: { tone: "healthy", icon: CheckCircle2, label: "Healthy" },
  caution: { tone: "caution", icon: AlertTriangle, label: "Monitor" },
  danger: { tone: "danger", icon: ShieldAlert, label: "Attention" },
};

/* ─────────────────────────── page ─────────────────────────── */

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tank?: string }>;
}) {
  const [{ tank: preferredTank }, entitlements] = await Promise.all([
    searchParams,
    getSessionEntitlements(),
  ]);

  // Pro+ gate: deterministic-or-AI, the whole report surface is Reef Keeper.
  if (!canUse(entitlements, "weeklyReports")) {
    return (
      <div className="space-y-8">
        <PageHeader />
        <UpgradeCard />
        <DisclaimerBanner />
      </div>
    );
  }

  const tank = await getActiveTank(preferredTank);

  if (!tank) {
    return (
      <div className="space-y-8">
        <PageHeader />
        <EmptyState
          icon={Droplets}
          title="No tank yet"
          description="Create a tank and log some water tests to generate your first weekly health report."
          action={<LinkButton href="/tanks">Add a tank</LinkButton>}
        />
        <DisclaimerBanner />
      </div>
    );
  }

  const [latest, history, reminders] = await Promise.all([
    getLatestParameters(tank.id),
    getParameterHistory(tank.id, 30),
    listReminders(),
    // Loaded for parity with other surfaces; not rendered directly here.
    listDiagnoses(tank.id),
  ]);

  const tankType = tank.type as TankType;
  const ranges = TARGET_RANGES[tankType];
  const report = buildReport(tank, latest, reminders);
  const overall = OVERALL[report.status];
  const OverallIcon = overall.icon;
  const classified = latest ? classifyReading(latest, tankType) : [];

  return (
    <div className="space-y-8">
      <PageHeader tankName={tank.name} tankType={tankType} />

      {!latest ? (
        <>
          <EmptyState
            icon={FileText}
            title="Not enough data yet"
            description="Log at least one water test to generate a health report with prioritized recommendations and an AI narrative."
            action={
              <LinkButton href={`/parameters?tank=${tank.id}`}>
                <Droplets className="h-4 w-4" /> Log a reading
              </LinkButton>
            }
          />
          <DisclaimerBanner />
        </>
      ) : (
        <>
          {/* ── Overall status banner ── */}
          <Card
            className={cn(
              "border-l-4",
              report.status === "healthy" && "border-l-lagoon-400",
              report.status === "caution" && "border-l-amber-400",
              report.status === "danger" && "border-l-coral-400",
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <span
                  className={cn(
                    "grid h-12 w-12 shrink-0 place-items-center rounded-2xl",
                    report.status === "healthy" &&
                      "bg-lagoon-500/15 text-lagoon-300",
                    report.status === "caution" &&
                      "bg-amber-500/15 text-amber-300",
                    report.status === "danger" &&
                      "bg-coral-500/15 text-coral-300",
                  )}
                >
                  <OverallIcon className="h-6 w-6" aria-hidden />
                </span>
                <div>
                  <SectionLabel>This week&apos;s report</SectionLabel>
                  <h2 className="font-display text-2xl font-semibold text-abyss-50">
                    {report.headline}
                  </h2>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-abyss-200/70">
                    <span>
                      Based on the latest reading
                      {latest.measured_at
                        ? ` from ${fmtDate(latest.measured_at)}`
                        : ""}
                    </span>
                    <span aria-hidden className="text-abyss-200/30">
                      •
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Activity
                        className="h-3.5 w-3.5 text-lagoon-300"
                        aria-hidden
                      />
                      Cycle:{" "}
                      <Badge
                        tone={
                          report.cycle === "cycled"
                            ? "healthy"
                            : report.cycle === "not-started"
                              ? "neutral"
                              : "caution"
                        }
                      >
                        {CYCLE_LABEL[report.cycle] ?? report.cycle}
                      </Badge>
                    </span>
                  </p>
                </div>
              </div>
              <Badge tone={overall.tone} className="shrink-0">
                <OverallIcon className="h-3.5 w-3.5" /> {overall.label}
              </Badge>
            </div>

            {/* Quick counts */}
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Stat
                label="Params off target"
                value={report.issues.length}
                tone={
                  report.issues.some((i) => i.status === "critical")
                    ? "danger"
                    : report.issues.length
                      ? "caution"
                      : "healthy"
                }
                sub={
                  report.issues.length
                    ? "Out of range"
                    : "All measured in range"
                }
              />
              <Stat
                label="Overdue tasks"
                value={report.overdue.length}
                tone={report.overdue.length ? "caution" : "healthy"}
                sub={report.overdue.length ? "Past due date" : "On schedule"}
              />
              <Stat
                label="Readings logged"
                value={history.length}
                sub="Last 30 tests"
              />
            </div>
          </Card>

          {/* ── Prioritized recommendations (deterministic) ── */}
          <section aria-labelledby="recs-heading">
            <Card className="space-y-4">
              <div className="flex items-center gap-2">
                <SectionLabel>Prioritized actions</SectionLabel>
              </div>
              <h2
                id="recs-heading"
                className="font-display text-xl font-semibold text-abyss-50"
              >
                What to do this week
              </h2>
              {report.status === "healthy" ? (
                <div className="flex items-center gap-3 rounded-xl border border-lagoon-400/25 bg-lagoon-500/[0.08] px-4 py-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-lagoon-500/15 text-lagoon-300">
                    <CheckCircle2 className="h-5 w-5" />
                  </span>
                  <p className="text-sm text-abyss-100/90">
                    {report.recommendations[0]}
                  </p>
                </div>
              ) : (
                <Recommendations
                  title="Ordered by priority"
                  icon={TrendingUp}
                  items={report.recommendations}
                />
              )}
            </Card>
          </section>

          {/* ── Overdue tasks (when any) ── */}
          {report.overdue.length > 0 && (
            <section aria-labelledby="overdue-heading">
              <Card className="space-y-4">
                <SectionLabel>Maintenance</SectionLabel>
                <h2
                  id="overdue-heading"
                  className="font-display text-xl font-semibold text-abyss-50"
                >
                  Overdue tasks
                </h2>
                <ul className="space-y-2.5">
                  {report.overdue.map((r) => {
                    const days = Math.abs(daysUntil(r.due_at));
                    return (
                      <li
                        key={r.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/5 text-coral-300">
                            <CalendarClock className="h-[18px] w-[18px]" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-abyss-50">
                              {r.title}
                            </p>
                            <p className="truncate text-xs text-abyss-200/60">
                              {REMINDER_KIND_LABEL[r.kind] ?? r.kind}
                              {r.recurrence !== "none"
                                ? ` · ${r.recurrence}`
                                : ""}
                            </p>
                          </div>
                        </div>
                        <Badge tone="danger" className="shrink-0">
                          Overdue {days}d
                        </Badge>
                      </li>
                    );
                  })}
                </ul>
                <LinkButton
                  href={`/reminders?tank=${tank.id}`}
                  variant="secondary"
                  className="w-fit"
                >
                  <CalendarClock className="h-4 w-4" /> Manage reminders
                </LinkButton>
              </Card>
            </section>
          )}

          {/* ── Parameter snapshot ── */}
          <section aria-labelledby="snapshot-heading">
            <SectionLabel>
              <span id="snapshot-heading">Parameter snapshot</span>
            </SectionLabel>
            <Card className="!p-0 overflow-hidden">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Most recent water parameters with target ranges and status for
                  a {tankType} tank.
                </caption>
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-abyss-200/60">
                    <th scope="col" className="px-4 py-3 font-medium">
                      Parameter
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Value
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Target band
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {classified.map(({ key, value, status }) => {
                    const k = key as ParamKey;
                    const range = ranges[k];
                    const unit = range?.unit ?? "";
                    return (
                      <tr
                        key={key}
                        className="border-b border-white/5 last:border-0"
                      >
                        <th
                          scope="row"
                          className="px-4 py-3 text-left font-medium text-abyss-50"
                        >
                          {range?.label ?? key}
                        </th>
                        <td className="px-4 py-3 tabular-nums text-abyss-100">
                          {fmtParam(k, value, "")}
                          {unit ? (
                            <span className="text-abyss-200/50"> {unit}</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-abyss-200/70">
                          {range
                            ? `${fmtParam(k, range.min, "")}–${fmtParam(
                                k,
                                range.max,
                                "",
                              )}${unit ? ` ${unit}` : ""}`
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={STATUS_TONE[status] ?? "neutral"}>
                            {STATUS_LABEL[status] ?? status}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          </section>

          {/* ── AI narrative (client) ── */}
          <ReportNarrative
            tankId={tank.id}
            tankType={tankType}
            parameters={history}
            demo={isDemoMode()}
          />

          <DisclaimerBanner />
        </>
      )}
    </div>
  );
}

/* ─────────────────────────── header ─────────────────────────── */

function PageHeader({
  tankName,
  tankType,
}: {
  tankName?: string;
  tankType?: TankType;
}) {
  return (
    <header className="space-y-1">
      <SectionLabel>Weekly report</SectionLabel>
      <h1 className="font-display text-3xl font-semibold tracking-tight text-abyss-50">
        Tank health report
      </h1>
      <p className="mt-1 text-sm text-abyss-200/70">
        {tankName ? (
          <>
            A grounded weekly read on{" "}
            <span className="font-medium text-abyss-100">{tankName}</span>
            {tankType ? (
              <span className="ml-2 inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-abyss-100">
                {tankType}
              </span>
            ) : null}
          </>
        ) : (
          "A grounded weekly read on your reef — status, priorities, and trends."
        )}
      </p>
    </header>
  );
}

/* ─────────────────────────── upgrade gate ─────────────────────────── */

function UpgradeCard() {
  const pro = TIERS.pro;
  const monthly = pro.prices.find((p) => p.interval === "month");
  const priceLabel = monthly ? `$${(monthly.amount / 100).toFixed(0)}/mo` : "";

  const perks = [
    "AI-grounded weekly health reports",
    "Prioritized, evidence-based recommendations",
    "Written AI analysis of your parameter trends",
    "Dosing calculators, treatment protocols & reminders",
  ];

  return (
    <Card className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-lagoon-500/10 blur-3xl"
      />
      <div className="relative space-y-5">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-lagoon-500/15 text-lagoon-300">
          <Lock className="h-6 w-6" aria-hidden />
        </span>
        <div>
          <Badge tone="brand" className="mb-3">
            <Sparkles className="h-3.5 w-3.5" /> {pro.name}
            {priceLabel ? ` · ${priceLabel}` : ""}
          </Badge>
          <h2 className="font-display text-2xl font-semibold text-abyss-50">
            Weekly reports are a Reef Keeper feature
          </h2>
          <p className="mt-2 max-w-prose text-sm text-abyss-200/75">
            Upgrade to get a polished weekly health report for every tank:
            overall status, a prioritized action list computed from your
            chemistry and maintenance, and an AI-authored narrative grounded in
            the reef knowledge base.
          </p>
        </div>

        <ul className="grid gap-2.5 sm:grid-cols-2">
          {perks.map((perk) => (
            <li
              key={perk}
              className="flex items-start gap-2.5 text-sm text-abyss-100/90"
            >
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0 text-lagoon-300"
                aria-hidden
              />
              {perk}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <LinkButton href="/pricing">
            <Sparkles className="h-4 w-4" /> Upgrade to {pro.name}
          </LinkButton>
          <LinkButton href="/dashboard" variant="secondary">
            Back to dashboard
          </LinkButton>
        </div>
      </div>
    </Card>
  );
}
