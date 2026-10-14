import * as React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Path, Line, Rect, Circle } from "react-native-svg";
import { colors, spacing, radii, fontSize, fontWeight } from "@/theme/tokens";

/**
 * A tiny dependency-free trend sparkline built on react-native-svg (no heavy
 * chart lib). Plots a series of numeric values as a smooth-ish polyline with an
 * optional shaded target band (min..max) so you can see at a glance whether a
 * parameter is trending into or out of range. Null/missing points are skipped so
 * a sparse series (you only log what you tested) still draws cleanly.
 */

export interface SparklineProps {
  /** Series oldest → newest. Nulls are gaps (not plotted). */
  values: Array<number | null | undefined>;
  /** Optional target band; shaded behind the line. */
  band?: { min: number; max: number } | null;
  /** Line color. */
  color?: string;
  width?: number;
  height?: number;
  /** Accessibility summary for screen readers. */
  accessibilityLabel?: string;
}

const PAD = 4;

/** Catmull-Rom → cubic bezier for a gently smoothed path through the points. */
function smoothPath(pts: Array<{ x: number; y: number }>): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) {
    const p = pts[0]!;
    // A tiny horizontal tick so a single point is still visible.
    return `M ${p.x - 2} ${p.y} L ${p.x + 2} ${p.y}`;
  }
  let d = `M ${pts[0]!.x} ${pts[0]!.y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export function Sparkline({
  values,
  band = null,
  color = colors.brand,
  width = 120,
  height = 40,
  accessibilityLabel,
}: SparklineProps) {
  const nums = values.filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );

  if (nums.length === 0) {
    return (
      <View
        style={[styles.empty, { width, height }]}
        accessibilityLabel={accessibilityLabel ?? "No trend data"}
        accessible
      >
        <Text style={styles.emptyText}>No data</Text>
      </View>
    );
  }

  // Domain spans both data and the target band so the band is always visible.
  let lo = Math.min(...nums);
  let hi = Math.max(...nums);
  if (band) {
    lo = Math.min(lo, band.min);
    hi = Math.max(hi, band.max);
  }
  if (hi === lo) {
    // Flat series: give it a little vertical breathing room.
    hi = lo + 1;
    lo = lo - 1;
  }
  const span = hi - lo;

  const innerW = width - PAD * 2;
  const innerH = height - PAD * 2;
  const n = values.length;
  const xFor = (i: number) =>
    PAD + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yFor = (v: number) => PAD + innerH - ((v - lo) / span) * innerH;

  const pts: Array<{ x: number; y: number }> = [];
  values.forEach((v, i) => {
    if (typeof v === "number" && Number.isFinite(v)) {
      pts.push({ x: xFor(i), y: yFor(v) });
    }
  });

  const path = smoothPath(pts);
  const last = pts[pts.length - 1]!;

  // Target band rectangle (clamped to the drawable area).
  let bandRect: { y: number; h: number } | null = null;
  if (band) {
    const yTop = yFor(band.max);
    const yBot = yFor(band.min);
    const y = Math.max(PAD, Math.min(yTop, yBot));
    const h = Math.max(1, Math.abs(yBot - yTop));
    bandRect = { y, h };
  }

  return (
    <View
      style={{ width, height }}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
      accessible={!!accessibilityLabel}
    >
      <Svg width={width} height={height}>
        {bandRect ? (
          <>
            <Rect
              x={0}
              y={bandRect.y}
              width={width}
              height={bandRect.h}
              fill={colors.healthy}
              fillOpacity={0.1}
            />
            <Line
              x1={0}
              x2={width}
              y1={bandRect.y}
              y2={bandRect.y}
              stroke={colors.healthy}
              strokeOpacity={0.25}
              strokeDasharray="3 3"
              strokeWidth={1}
            />
            <Line
              x1={0}
              x2={width}
              y1={bandRect.y + bandRect.h}
              y2={bandRect.y + bandRect.h}
              stroke={colors.healthy}
              strokeOpacity={0.25}
              strokeDasharray="3 3"
              strokeWidth={1}
            />
          </>
        ) : null}
        <Path
          d={path}
          stroke={color}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx={last.x} cy={last.y} r={2.6} fill={color} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  emptyText: {
    fontSize: fontSize.xs,
    color: colors.textFaint,
  },
});

/** A labeled sparkline tile: title + latest value + band + trend line. */
export function SparklineTile({
  title,
  latestText,
  values,
  band,
  color,
  statusTone = "neutral",
  accessibilityLabel,
}: {
  title: string;
  latestText: string;
  values: Array<number | null | undefined>;
  band?: { min: number; max: number } | null;
  color?: string;
  statusTone?: "neutral" | "healthy" | "caution" | "danger";
  accessibilityLabel?: string;
}) {
  const valueColor =
    statusTone === "healthy"
      ? colors.brandSoft
      : statusTone === "caution"
        ? colors.cautionText
        : statusTone === "danger"
          ? colors.dangerText
          : colors.text;
  return (
    <View style={styles2.tile}>
      <Text style={styles2.tileTitle}>{title}</Text>
      <Text style={[styles2.tileValue, { color: valueColor }]}>
        {latestText}
      </Text>
      <View style={styles2.tileChart}>
        <Sparkline
          values={values}
          band={band}
          color={color}
          width={140}
          height={42}
          accessibilityLabel={accessibilityLabel}
        />
      </View>
    </View>
  );
}

const styles2 = StyleSheet.create({
  tile: {
    flexGrow: 1,
    flexBasis: "47%",
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  tileTitle: {
    fontSize: 10,
    fontWeight: fontWeight.medium,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.textFaint,
  },
  tileValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    fontVariant: ["tabular-nums"],
  },
  tileChart: {
    marginTop: spacing.xs,
    alignItems: "stretch",
  },
});
