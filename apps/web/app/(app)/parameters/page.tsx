import { FlaskConical, Droplets } from "lucide-react";
import {
  getActiveTank,
  getParameterHistory,
  getLatestParameters,
} from "@/lib/data";
import {
  TARGET_RANGES,
  classifyReading,
  type ParamKey,
  type TankType,
} from "@reef/shared";
import {
  Card,
  SectionLabel,
  Badge,
  DisclaimerBanner,
  EmptyState,
  LinkButton,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { ParamCharts } from "./param-charts";
import { LogParametersForm } from "./log-parameters-form";
import { CycleTracker } from "./cycle-tracker";

export const metadata = {
  title: "Parameters · Reef Doctor",
  description:
    "Track and chart your reef water chemistry over time with target bands and a cycle tracker.",
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

/** Decimal precision per parameter for readable display. */
const DECIMALS: Partial<Record<ParamKey, number>> = {
  salinity_sg: 4,
  temp_c: 1,
  ph: 2,
  alkalinity_dkh: 1,
  calcium_ppm: 0,
  magnesium_ppm: 0,
  ammonia_ppm: 2,
  nitrite_ppm: 2,
  nitrate_ppm: 1,
  phosphate_ppm: 3,
  orp_mv: 0,
};

function fmt(value: number, key: ParamKey): string {
  const d = DECIMALS[key] ?? 1;
  return value.toFixed(d);
}

export default async function ParametersPage({
  searchParams,
}: {
  searchParams: Promise<{ tank?: string }>;
}) {
  const { tank: tankParam } = await searchParams;
  const tank = await getActiveTank(tankParam);

  if (!tank) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <EmptyState
          icon={Droplets}
          title="No tank yet"
          description="Create a tank to start logging and charting your water parameters."
          action={<LinkButton href="/tanks">Add a tank</LinkButton>}
        />
      </div>
    );
  }

  const [history, latest] = await Promise.all([
    getParameterHistory(tank.id, 30),
    getLatestParameters(tank.id),
  ]);

  const tankType = tank.type as TankType;
  const ranges = TARGET_RANGES[tankType];
  const classified = latest ? classifyReading(latest, tankType) : [];

  return (
    <div className="space-y-8">
      <PageHeader tankName={tank.name} tankType={tankType} />

      <DisclaimerBanner text="Target ranges are general reef-keeping guidance and vary by livestock. Stability matters more than chasing exact numbers — change parameters slowly." />

      {history.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="No readings yet"
          description="Log your first water test below to start building trend charts and tracking your nitrogen cycle."
        />
      ) : (
        <>
          {/* Latest reading vs. target bands */}
          <section aria-labelledby="latest-heading">
            <SectionLabel>
              <span id="latest-heading">
                Latest reading
                {latest?.measured_at
                  ? ` · ${new Date(latest.measured_at).toLocaleDateString(
                      undefined,
                      { month: "short", day: "numeric", year: "numeric" },
                    )}`
                  : ""}
              </span>
            </SectionLabel>
            <Card className="!p-0 overflow-hidden">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Latest water parameters with their target ranges and status for
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
                    const range = ranges[key as ParamKey];
                    const k = key as ParamKey;
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
                          {fmt(value, k)}
                          {unit ? (
                            <span className="text-abyss-200/50"> {unit}</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-abyss-200/70">
                          {range
                            ? `${fmt(range.min, k)}–${fmt(range.max, k)}${
                                unit ? ` ${unit}` : ""
                              }`
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

          {/* Trend charts with shaded target bands */}
          <ParamCharts history={history} tankType={tankType} />
        </>
      )}

      {/* Cycle tracker — always shown so new tanks see guidance */}
      <CycleTracker latest={latest} />

      {/* Log a new reading */}
      <LogParametersForm tankId={tank.id} />
    </div>
  );
}

function PageHeader({
  tankName,
  tankType,
}: {
  tankName?: string;
  tankType?: TankType;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-abyss-50">
          Parameters
        </h1>
        <p className="mt-1 text-sm text-abyss-200/70">
          {tankName ? (
            <>
              Water chemistry for{" "}
              <span className="font-medium text-abyss-100">{tankName}</span>
              {tankType ? (
                <span
                  className={cn(
                    "ml-2 inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-abyss-100",
                  )}
                >
                  {tankType}
                </span>
              ) : null}
            </>
          ) : (
            "Track and chart your reef water chemistry over time."
          )}
        </p>
      </div>
    </header>
  );
}
