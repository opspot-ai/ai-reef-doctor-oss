"use client";

import * as React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { TARGET_RANGES, type ParamKey, type TankType } from "@reef/shared";
import type { ParameterRow } from "@reef/shared";
import { Card, SectionLabel } from "@/components/ui";

/**
 * Small-multiples line charts for each water parameter over time, each with a
 * shaded target band (from TARGET_RANGES for the tank type). Themed with the
 * reef palette; every chart is titled and carries a screen-reader data summary.
 */

/** The parameters we chart, in display order, with an accent color + decimals. */
const CHART_KEYS: Array<{ key: ParamKey; color: string; decimals: number }> = [
  { key: "alkalinity_dkh", color: "#4fd4c0", decimals: 1 }, // lagoon-300
  { key: "calcium_ppm", color: "#21b8a5", decimals: 0 }, // lagoon-400
  { key: "magnesium_ppm", color: "#0f9c8b", decimals: 0 }, // lagoon-500
  { key: "nitrate_ppm", color: "#ff9878", decimals: 1 }, // coral-300
  { key: "phosphate_ppm", color: "#ff6a42", decimals: 3 }, // coral-400
  { key: "ph", color: "#73b3d6", decimals: 2 }, // abyss-300
  { key: "temp_c", color: "#3d8dbd", decimals: 1 }, // abyss-400
];

interface Point {
  t: number; // measured_at epoch ms (numeric for time scale)
  label: string; // short date label
  value: number | null;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

function buildSeries(history: ParameterRow[], key: ParamKey): Point[] {
  return history.map((row) => {
    const raw = row[key];
    return {
      t: new Date(row.measured_at).getTime(),
      label: fmtDate(row.measured_at),
      value: typeof raw === "number" ? raw : null,
    };
  });
}

/** A11y: a one-line plain-language summary of the series for screen readers. */
function summarize(
  points: Point[],
  range: { min: number; max: number; unit: string; label: string },
  decimals: number,
): string {
  const vals = points
    .map((p) => p.value)
    .filter((v): v is number => v !== null);
  if (!vals.length) return `${range.label}: no readings recorded.`;
  const latest = vals[vals.length - 1]!;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const u = range.unit ? ` ${range.unit}` : "";
  const inBand = latest >= range.min && latest <= range.max;
  return (
    `${range.label}: ${vals.length} readings, ` +
    `latest ${round(latest, decimals)}${u} ` +
    `(${inBand ? "within" : "outside"} target ` +
    `${round(range.min, decimals)}–${round(range.max, decimals)}${u}). ` +
    `Range over period ${round(min, decimals)} to ${round(max, decimals)}${u}.`
  );
}

function ChartTooltip({
  active,
  payload,
  unit,
  decimals,
}: {
  active?: boolean;
  payload?: Array<{ payload: Point }>;
  unit: string;
  decimals: number;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0]!.payload;
  if (p.value === null) return null;
  return (
    <div className="rounded-lg border border-white/15 bg-abyss-900/95 px-3 py-1.5 text-xs shadow-reef backdrop-blur">
      <p className="font-medium text-abyss-50">
        {round(p.value, decimals)}
        {unit ? ` ${unit}` : ""}
      </p>
      <p className="text-abyss-200/70">{p.label}</p>
    </div>
  );
}

function ParamChart({
  paramKey,
  color,
  decimals,
  history,
  tankType,
}: {
  paramKey: ParamKey;
  color: string;
  decimals: number;
  history: ParameterRow[];
  tankType: TankType;
}) {
  const range = TARGET_RANGES[tankType][paramKey];
  const points = React.useMemo(
    () => buildSeries(history, paramKey),
    [history, paramKey],
  );

  const hasData = points.some((p) => p.value !== null);
  if (!range || !hasData) return null;

  const summary = summarize(points, range, decimals);
  const titleId = `chart-${paramKey}-title`;
  const descId = `chart-${paramKey}-desc`;
  const unit = range.unit;

  // Y domain padded around both data and the target band so the band is visible.
  const values = points
    .map((p) => p.value)
    .filter((v): v is number => v !== null);
  const lo = Math.min(range.min, ...values);
  const hi = Math.max(range.max, ...values);
  const pad = (hi - lo || 1) * 0.12;

  return (
    <Card className="!p-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 id={titleId} className="font-display text-sm font-semibold text-abyss-50">
          {range.label}
        </h3>
        <span className="text-xs text-abyss-200/60">
          target {round(range.min, decimals)}–{round(range.max, decimals)}
          {unit ? ` ${unit}` : ""}
        </span>
      </div>
      <figure
        role="img"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="m-0"
      >
        <div className="h-36 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={points}
              margin={{ top: 6, right: 6, bottom: 0, left: -18 }}
            >
              <ReferenceArea
                y1={range.min}
                y2={range.max}
                fill="#21b8a5"
                fillOpacity={0.1}
                stroke="#21b8a5"
                strokeOpacity={0.2}
                strokeDasharray="3 3"
                ifOverflow="extendDomain"
              />
              <XAxis
                dataKey="label"
                tick={{ fill: "#a9d2e8", fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                domain={[
                  Math.round((lo - pad) * 1000) / 1000,
                  Math.round((hi + pad) * 1000) / 1000,
                ]}
                tick={{ fill: "#a9d2e8", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={44}
                tickFormatter={(v: number) => `${round(v, decimals)}`}
              />
              <Tooltip
                content={<ChartTooltip unit={unit} decimals={decimals} />}
                cursor={{ stroke: "rgba(255,255,255,0.2)", strokeWidth: 1 }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                connectNulls
                dot={{ r: 2, fill: color, strokeWidth: 0 }}
                activeDot={{ r: 4, fill: color, stroke: "#061a2a", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <figcaption id={descId} className="sr-only">
          {summary}
        </figcaption>
      </figure>
    </Card>
  );
}

export function ParamCharts({
  history,
  tankType,
}: {
  history: ParameterRow[];
  tankType: TankType;
}) {
  const charts = CHART_KEYS.filter((c) =>
    history.some((row) => typeof row[c.key] === "number"),
  );

  if (!charts.length) return null;

  return (
    <section aria-labelledby="trends-heading">
      <SectionLabel>
        <span id="trends-heading">Trends · last {history.length} readings</span>
      </SectionLabel>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {charts.map((c) => (
          <ParamChart
            key={c.key}
            paramKey={c.key}
            color={c.color}
            decimals={c.decimals}
            history={history}
            tankType={tankType}
          />
        ))}
      </div>
    </section>
  );
}
