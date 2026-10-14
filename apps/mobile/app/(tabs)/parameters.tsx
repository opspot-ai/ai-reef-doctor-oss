import * as React from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Link } from "expo-router";
import * as Haptics from "expo-haptics";
import type { SymbolViewProps } from "expo-symbols";
import {
  classifyReading,
  cycleStage,
  TARGET_RANGES,
  type ParamKey,
  type ParameterReading,
  type ParameterRow,
  type Tank,
  type CycleStage,
} from "@reef/shared";
import {
  Screen,
  Card,
  SectionLabel,
  Title,
  Badge,
  Button,
  GlassCTA,
  Sym,
  EmptyState,
  DisclaimerBanner,
  Spinner,
} from "@/components/ui";
import { Glass } from "@/components/glass";
import { Sparkline } from "@/components/sparkline";
import { DropletIcon } from "@/components/icons";
import { colors, spacing, radii, fontSize, fontWeight, palette } from "@/theme/tokens";
import { useAuth } from "@/lib/auth";
import {
  getActiveTank,
  getParameterHistory,
  getLatestParameters,
} from "@/lib/data";
import {
  TANK_TYPE_LABEL,
  statusTone,
  statusLabel,
  fmtParam,
  fmtDate,
} from "@/lib/format";

/**
 * Parameters (Water) — Liquid Glass, visual-first redesign.
 *
 * Behavior is unchanged from the original: active tank context, latest reading
 * classified against TARGET_RANGES, trend sparklines, a nitrogen-cycle stepper,
 * and a quick-log form that persists locally for the session (demo-safe).
 *
 * Presentation is glanceable rather than wordy:
 *  - a hero glass tile = one big status numeral (in-range count) + Sym,
 *  - a grid of big glass parameter tiles: huge number + unit + status color +
 *    SF Symbol + mini sparkline (no sentences),
 *  - a horizontal cycle stepper of SF Symbols with the current stage lit + 1 line,
 *  - a single GlassCTA "Log reading" that opens a glass sheet of terse numeric
 *    inputs (labels + units only); a success haptic fires on save.
 */

/* ─────────────────────────── parameter visuals ─────────────────────────── */

interface ParamMeta {
  key: ParamKey;
  /** SF Symbol that reads at a glance. */
  symbol: SymbolViewProps["name"];
  /** Accent for the sparkline line. */
  trend: string;
  placeholder: string;
  int?: boolean;
}

/** Display order for the tile grid + the log sheet (terse, no prose). */
const PARAMS: ParamMeta[] = [
  { key: "alkalinity_dkh", symbol: "drop.fill", trend: palette.lagoon[300], placeholder: "8.5" },
  { key: "calcium_ppm", symbol: "circle.grid.cross.fill", trend: palette.lagoon[400], placeholder: "425", int: true },
  { key: "magnesium_ppm", symbol: "bolt.fill", trend: palette.lagoon[200], placeholder: "1350", int: true },
  { key: "salinity_sg", symbol: "water.waves", trend: palette.abyss[300], placeholder: "1.0255" },
  { key: "temp_c", symbol: "thermometer.medium", trend: palette.coral[300], placeholder: "25.5" },
  { key: "ph", symbol: "drop.degreesign", trend: palette.abyss[200], placeholder: "8.2" },
  { key: "ammonia_ppm", symbol: "exclamationmark.triangle.fill", trend: palette.coral[400], placeholder: "0" },
  { key: "nitrite_ppm", symbol: "exclamationmark.triangle.fill", trend: palette.coral[400], placeholder: "0" },
  { key: "nitrate_ppm", symbol: "leaf.fill", trend: palette.coral[300], placeholder: "5" },
  { key: "phosphate_ppm", symbol: "atom", trend: palette.amber[400], placeholder: "0.05" },
  { key: "orp_mv", symbol: "bolt.horizontal.fill", trend: palette.abyss[300], placeholder: "375", int: true },
];

const PARAM_BY_KEY: Record<string, ParamMeta> = Object.fromEntries(
  PARAMS.map((p) => [p.key, p]),
);

type StatusToneKey = "neutral" | "healthy" | "caution" | "danger";

/** Color used for big values / accents per status tone. */
function toneColor(tone: StatusToneKey): string {
  switch (tone) {
    case "healthy":
      return colors.brandSoft;
    case "caution":
      return colors.cautionText;
    case "danger":
      return colors.dangerText;
    default:
      return colors.text;
  }
}

/** SF Symbol that encodes a parameter's status at a glance. */
function statusSymbol(tone: StatusToneKey): SymbolViewProps["name"] {
  switch (tone) {
    case "healthy":
      return "checkmark.seal.fill";
    case "caution":
      return "exclamationmark.circle.fill";
    case "danger":
      return "exclamationmark.triangle.fill";
    default:
      return "minus.circle";
  }
}

type Feedback =
  | { kind: "saved" }
  | { kind: "demo" }
  | { kind: "error"; message: string }
  | null;

interface Loaded {
  tank: Tank | null;
  history: ParameterRow[]; // ascending (oldest → newest)
  latest: ParameterRow | null;
}

export default function ParametersScreen() {
  const { isDemo } = useAuth();
  const [loaded, setLoaded] = React.useState<Loaded | null>(null);
  /** Locally-logged readings this session (newest first), layered over loaded data. */
  const [localReadings, setLocalReadings] = React.useState<ParameterRow[]>([]);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    (async () => {
      const tank = await getActiveTank();
      if (!tank) {
        if (active) setLoaded({ tank: null, history: [], latest: null });
        return;
      }
      const [history, latest] = await Promise.all([
        getParameterHistory(tank.id, 30),
        getLatestParameters(tank.id),
      ]);
      if (active) setLoaded({ tank, history, latest });
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!loaded) {
    return (
      <Screen scroll={false} contentStyle={styles.center}>
        <Spinner />
      </Screen>
    );
  }

  const { tank } = loaded;

  if (!tank) {
    return (
      <Screen>
        <Header />
        <EmptyState
          Icon={DropletIcon}
          title="No tank yet"
          description="Add a tank to start tracking water chemistry."
          action={
            <Link href="/tanks" asChild>
              <Button>Add a tank</Button>
            </Link>
          }
        />
        <Guidance />
      </Screen>
    );
  }

  // Merge any locally-logged readings (this session) on top of loaded history.
  const mergedAsc: ParameterRow[] = [
    ...loaded.history,
    ...[...localReadings].reverse(),
  ];
  const latest: ParameterRow | null = localReadings[0] ?? loaded.latest ?? null;

  function handleSaved(row: ParameterRow) {
    setLocalReadings((prev) => [row, ...prev]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    setSheetOpen(false);
  }

  return (
    <Screen>
      <Header tank={tank} isDemo={isDemo} />

      {latest ? (
        <ParameterGrid tank={tank} latest={latest} history={mergedAsc} />
      ) : (
        <Card>
          <View style={styles.emptyReading}>
            <Sym name="flask.fill" size={30} color={colors.brandSoft} />
            <Text style={styles.emptyReadingTitle}>No readings yet</Text>
            <Text style={styles.emptyReadingSub}>Log your first water test.</Text>
          </View>
        </Card>
      )}

      <CycleTracker latest={latest} />

      <Guidance />

      <GlassCTA
        label="Log reading"
        symbol="plus.circle.fill"
        tone="brand"
        onPress={() => setSheetOpen(true)}
      />

      <LogSheet
        visible={sheetOpen}
        tank={tank}
        isDemo={isDemo}
        onClose={() => setSheetOpen(false)}
        onSaved={handleSaved}
        existingUserId={latest?.user_id ?? loaded.history[0]?.user_id ?? null}
      />
    </Screen>
  );
}

/* ─────────────────────────── header ─────────────────────────── */

function Header({ tank, isDemo }: { tank?: Tank; isDemo?: boolean }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <SectionLabel>Water</SectionLabel>
      <View style={styles.titleRow}>
        <Sym name="drop.fill" size={26} color={colors.brandSoft} />
        <Title>Chemistry</Title>
      </View>
      {tank ? (
        <View style={styles.tankContext}>
          <Sym name="water.waves" size={14} color={colors.brandSoft} />
          <Text style={styles.tankContextText} numberOfLines={1}>
            <Text style={styles.tankName}>{tank.name}</Text> ·{" "}
            {TANK_TYPE_LABEL[tank.type]}
          </Text>
          {isDemo ? <Badge tone="brand">Demo</Badge> : null}
        </View>
      ) : null}
    </View>
  );
}

function Guidance() {
  return (
    <DisclaimerBanner text="Targets are general guidance — stability beats chasing exact numbers. Change slowly." />
  );
}

/* ─────────────────────────── parameter grid ─────────────────────────── */

function ParameterGrid({
  tank,
  latest,
  history,
}: {
  tank: Tank;
  latest: ParameterRow;
  history: ParameterRow[];
}) {
  const classified = classifyReading(latest, tank.type);
  const ranges = TARGET_RANGES[tank.type];

  const okCount = classified.filter(
    (c) => c.status === "ok" || c.status === "unknown",
  ).length;
  const total = classified.length;
  const allOk = okCount === total && total > 0;
  const issues = total - okCount;

  return (
    <View style={{ gap: spacing.md }}>
      {/* Hero status tile: one big numeral + a single status color + Sym. */}
      <Card style={styles.hero}>
        <View style={styles.heroLeft}>
          <Sym
            name={allOk ? "checkmark.seal.fill" : "exclamationmark.triangle.fill"}
            size={34}
            color={allOk ? colors.brandSoft : colors.cautionText}
          />
          <View>
            <Text style={styles.heroBig}>
              {allOk ? total : issues}
              <Text style={styles.heroBigUnit}>
                {allOk ? " in range" : issues === 1 ? " to watch" : " to watch"}
              </Text>
            </Text>
            <Text style={styles.heroSub}>
              {fmtDate(latest.measured_at)} · {total} tested
            </Text>
          </View>
        </View>
        <Badge tone={allOk ? "healthy" : "caution"}>
          {allOk ? "Healthy" : "Check"}
        </Badge>
      </Card>

      {classified.length === 0 ? (
        <Card>
          <Text style={styles.bodyMuted}>No measures on this reading.</Text>
        </Card>
      ) : (
        <View style={styles.grid}>
          {classified.map(({ key, value, status }) => {
            const k = key as ParamKey;
            const range = ranges[k];
            const meta = PARAM_BY_KEY[k];
            const tone = statusTone(status) as StatusToneKey;
            const valueColor = toneColor(tone);
            const series = history.map((row) => {
              const raw = row[k];
              return typeof raw === "number" ? raw : null;
            });
            return (
              <ParamTile
                key={key}
                label={range?.label ?? key}
                symbol={meta?.symbol ?? "circle.fill"}
                value={range ? fmtParam(k, value, "") : String(value)}
                unit={range?.unit ?? ""}
                statusSymbol={statusSymbol(tone)}
                statusColor={valueColor}
                series={series}
                band={range ? { min: range.min, max: range.max } : null}
                trendColor={meta?.trend ?? colors.brand}
                accessibilityLabel={`${range?.label ?? key}: ${
                  range ? fmtParam(k, value, range.unit) : value
                }, ${statusLabel(status)}`}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}

/** Big glass parameter tile: huge number + unit + status color + Sym + sparkline. */
function ParamTile({
  label,
  symbol,
  value,
  unit,
  statusSymbol: statusSym,
  statusColor,
  series,
  band,
  trendColor,
  accessibilityLabel,
}: {
  label: string;
  symbol: SymbolViewProps["name"];
  value: string;
  unit: string;
  statusSymbol: SymbolViewProps["name"];
  statusColor: string;
  series: Array<number | null>;
  band: { min: number; max: number } | null;
  trendColor: string;
  accessibilityLabel: string;
}) {
  const hasTrend = series.filter((v) => typeof v === "number").length >= 2;
  return (
    <Glass
      variant="regular"
      style={styles.tile}
      accessibilityLabel={accessibilityLabel}
    >
      <View style={styles.tileHead}>
        <View style={styles.tileLabelRow}>
          <Sym name={symbol} size={14} color={colors.textMuted} />
          <Text style={styles.tileLabel} numberOfLines={1}>
            {label}
          </Text>
        </View>
        <Sym name={statusSym} size={16} color={statusColor} />
      </View>

      <View style={styles.tileValueRow}>
        <Text style={[styles.tileValue, { color: statusColor }]}>{value}</Text>
        {unit ? <Text style={styles.tileUnit}>{unit}</Text> : null}
      </View>

      {hasTrend ? (
        <Sparkline
          values={series}
          band={band}
          color={trendColor}
          width={132}
          height={30}
        />
      ) : (
        <View style={styles.tileNoTrend} />
      )}
    </Glass>
  );
}

/* ─────────────────────────── cycle tracker ─────────────────────────── */

interface StepMeta {
  stage: CycleStage;
  title: string;
  /** SF Symbol per stage: hourglass → circle.dotted → checkmark.seal.fill. */
  symbol: SymbolViewProps["name"];
  /** One-line guidance — terse. */
  hint: string;
}

const CYCLE_ORDER: CycleStage[] = ["not-started", "ammonia", "nitrite", "cycled"];

const CYCLE_STEPS: StepMeta[] = [
  {
    stage: "not-started",
    title: "Start",
    symbol: "hourglass",
    hint: "Add an ammonia source to begin — keep temp + salinity steady.",
  },
  {
    stage: "ammonia",
    title: "Ammonia",
    symbol: "circle.dotted",
    hint: "First bacteria forming. No livestock yet — wait for nitrite.",
  },
  {
    stage: "nitrite",
    title: "Nitrite",
    symbol: "circle.dotted.circle",
    hint: "Nitrite climbing. Stay patient — nearly there.",
  },
  {
    stage: "cycled",
    title: "Cycled",
    symbol: "checkmark.seal.fill",
    hint: "Biofilter ready. Water change, then add livestock slowly.",
  },
];

/** Map the 5-value CycleStage onto the 4-step visual ("nitrate" = late nitrite). */
function cycleVisualIndex(stage: CycleStage): number {
  if (stage === "nitrate") return CYCLE_ORDER.indexOf("nitrite");
  return CYCLE_ORDER.indexOf(stage);
}

function CycleTracker({ latest }: { latest: ParameterRow | null }) {
  const stage: CycleStage = latest ? cycleStage(latest) : "not-started";
  const activeIdx = cycleVisualIndex(stage);
  const current = CYCLE_STEPS[activeIdx] ?? CYCLE_STEPS[0]!;
  const cycled = stage === "cycled";

  return (
    <Card>
      <View style={styles.cardHeadRow}>
        <View style={styles.tileLabelRow}>
          <Sym name="arrow.triangle.2.circlepath" size={15} color={colors.brandSoft} />
          <SectionLabel>Nitrogen cycle</SectionLabel>
        </View>
        <Badge tone={cycled ? "healthy" : "caution"}>
          {cycled ? "Cycled" : "Cycling"}
        </Badge>
      </View>

      <View
        style={styles.stepper}
        accessibilityRole="progressbar"
        accessibilityLabel={`Nitrogen cycle: ${current.title}`}
      >
        {CYCLE_STEPS.map((step, i) => {
          const state: "done" | "current" | "upcoming" =
            i < activeIdx ? "done" : i === activeIdx ? "current" : "upcoming";
          const isLast = i === CYCLE_STEPS.length - 1;
          const symColor =
            state === "current"
              ? colors.textOnAccent
              : state === "done"
                ? colors.textOnAccent
                : colors.textFaint;
          const dotBg =
            state === "done"
              ? colors.brand
              : state === "current"
                ? colors.accent
                : "transparent";
          const dotBorder =
            state === "done"
              ? colors.brand
              : state === "current"
                ? colors.accent
                : "rgba(169,210,232,0.3)";
          return (
            <View key={step.stage} style={styles.step}>
              <View style={styles.stepTop}>
                <View
                  style={[
                    styles.stepDot,
                    { backgroundColor: dotBg, borderColor: dotBorder },
                  ]}
                >
                  <Sym name={step.symbol} size={18} color={symColor} />
                </View>
                {!isLast ? (
                  <View
                    style={[
                      styles.stepLine,
                      {
                        backgroundColor:
                          i < activeIdx
                            ? "rgba(33,184,165,0.5)"
                            : "rgba(255,255,255,0.1)",
                      },
                    ]}
                  />
                ) : null}
              </View>
              <Text
                style={[
                  styles.stepTitle,
                  state === "upcoming" && styles.stepTitleUpcoming,
                  state === "current" && { color: colors.cautionText },
                ]}
                numberOfLines={1}
              >
                {step.title}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.hintRow}>
        <Sym name="lightbulb.fill" size={14} color={colors.brandSoft} />
        <Text style={styles.hintText} numberOfLines={2}>
          {latest ? current.hint : "Log a reading to track your cycle."}
        </Text>
      </View>
    </Card>
  );
}

/* ─────────────────────────── log sheet ─────────────────────────── */

function LogSheet({
  visible,
  tank,
  isDemo,
  onClose,
  onSaved,
  existingUserId,
}: {
  visible: boolean;
  tank: Tank;
  isDemo: boolean;
  onClose: () => void;
  onSaved: (row: ParameterRow) => void;
  existingUserId: string | null;
}) {
  const [draft, setDraft] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const ranges = TARGET_RANGES[tank.type];

  function setField(key: string, value: string) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    if (error) setError(null);
  }

  function reset() {
    setDraft({});
    setError(null);
    setSaving(false);
  }

  function onSubmit() {
    const reading: ParameterReading = { source: "manual" };
    let any = false;
    for (const p of PARAMS) {
      const raw = (draft[p.key] ?? "").trim();
      if (raw === "") continue;
      const num = Number(raw);
      if (Number.isNaN(num)) continue;
      reading[p.key] = p.int ? Math.round(num) : num;
      any = true;
    }

    if (!any) {
      setError("Enter at least one value.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => {},
      );
      return;
    }

    setSaving(true);
    const now = new Date().toISOString();
    // Local ParameterRow so trends + status update immediately. Backend write is
    // a future build; in demo this lives in session state only.
    const row = {
      ...reading,
      id: `local-${Date.now()}`,
      tank_id: tank.id,
      user_id: existingUserId ?? tank.user_id,
      measured_at: now,
      created_at: now,
    } as ParameterRow;

    onSaved(row);
    reset();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.sheetBackdrop}>
        <Pressable style={styles.sheetDismiss} onPress={onClose} accessibilityLabel="Close" />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.sheetWrap}
        >
          <Glass
            variant="regular"
            fallbackColor={colors.backgroundAlt}
            style={styles.sheet}
          >
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHead}>
              <View style={styles.tileLabelRow}>
                <Sym name="flask.fill" size={18} color={colors.brandSoft} />
                <Text style={styles.sheetTitle}>Log reading</Text>
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={10}
                accessibilityLabel="Close"
              >
                <Sym name="xmark.circle.fill" size={26} color={colors.textFaint} />
              </Pressable>
            </View>

            {isDemo ? (
              <View style={styles.demoRow}>
                <Badge tone="brand">Demo</Badge>
                <Text style={styles.demoText}>Saves to this session.</Text>
              </View>
            ) : null}

            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetGrid}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {PARAMS.map((p) => {
                const range = ranges[p.key];
                const label = range?.label ?? p.key;
                const unit = range?.unit ?? "";
                return (
                  <View key={p.key} style={styles.field}>
                    <View style={styles.fieldLabelRow}>
                      <Sym name={p.symbol} size={12} color={colors.textFaint} />
                      <Text style={styles.fieldLabel} numberOfLines={1}>
                        {label}
                        {unit ? (
                          <Text style={styles.fieldUnit}> {unit}</Text>
                        ) : null}
                      </Text>
                    </View>
                    <TextInput
                      value={draft[p.key] ?? ""}
                      onChangeText={(t) => setField(p.key, t)}
                      placeholder={p.placeholder}
                      placeholderTextColor={colors.textFaint}
                      keyboardType="decimal-pad"
                      inputMode="decimal"
                      style={styles.input}
                      accessibilityLabel={`${label}${unit ? ` in ${unit}` : ""}`}
                      returnKeyType="done"
                    />
                  </View>
                );
              })}
            </ScrollView>

            {error ? (
              <View style={styles.errorRow} accessibilityLiveRegion="polite">
                <Sym
                  name="exclamationmark.triangle.fill"
                  size={15}
                  color={colors.dangerText}
                />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Solid Button (not GlassCTA) — avoids glass-on-glass inside the
                glass sheet. Haptics fire from onSubmit (success/error). */}
            <Button
              onPress={onSubmit}
              disabled={saving}
              style={styles.sheetCta}
            >
              <Sym
                name="checkmark.circle.fill"
                size={18}
                color={colors.textOnAccent}
              />
              <Text style={styles.saveBtnText}>
                {saving ? "Saving…" : "Save"}
              </Text>
            </Button>
          </Glass>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/* ─────────────────────────── styles ─────────────────────────── */

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  tankContext: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: 2,
  },
  tankContextText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  tankName: {
    color: colors.text,
    fontWeight: fontWeight.semibold,
  },
  bodyMuted: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },

  // ── empty reading ──
  emptyReading: {
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.lg,
  },
  emptyReadingTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginTop: spacing.sm,
  },
  emptyReadingSub: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },

  // ── hero status tile ──
  hero: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },
  heroBig: {
    fontSize: fontSize["3xl"],
    fontWeight: fontWeight.bold,
    color: colors.text,
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
  },
  heroBigUnit: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
  },
  heroSub: {
    fontSize: fontSize.xs,
    color: colors.textFaint,
    marginTop: 2,
  },

  // ── parameter grid ──
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  tile: {
    flexGrow: 1,
    flexBasis: "47%",
    minWidth: 150,
    borderRadius: radii.xl,
    padding: spacing.md,
    overflow: "hidden",
    gap: spacing.sm,
  },
  tileHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  tileLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flexShrink: 1,
  },
  tileLabel: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.textMuted,
    flexShrink: 1,
  },
  tileValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  tileValue: {
    fontSize: fontSize["3xl"],
    fontWeight: fontWeight.bold,
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
  },
  tileUnit: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textFaint,
  },
  tileNoTrend: {
    height: 30,
  },

  // ── cycle stepper ──
  cardHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  stepper: {
    flexDirection: "row",
    marginTop: spacing.lg,
  },
  step: {
    flex: 1,
    alignItems: "flex-start",
  },
  stepTop: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    height: 36,
  },
  stepDot: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 3,
  },
  stepTitle: {
    marginTop: spacing.sm,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  stepTitleUpcoming: {
    color: colors.textFaint,
    fontWeight: fontWeight.medium,
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  hintText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    lineHeight: 19,
  },

  // ── log sheet ──
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(6,26,42,0.55)",
    justifyContent: "flex-end",
  },
  sheetDismiss: {
    flex: 1,
  },
  sheetWrap: {
    width: "100%",
  },
  sheet: {
    borderTopLeftRadius: radii["2xl"],
    borderTopRightRadius: radii["2xl"],
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing["2xl"],
    maxHeight: "88%",
    overflow: "hidden",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: radii.full,
    backgroundColor: "rgba(255,255,255,0.25)",
    marginBottom: spacing.md,
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  sheetTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  demoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  demoText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  sheetScroll: {
    flexGrow: 0,
  },
  sheetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  field: {
    flexGrow: 1,
    flexBasis: "30%",
    minWidth: 96,
  },
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: spacing.xs,
  },
  fieldLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
    flexShrink: 1,
  },
  fieldUnit: {
    color: colors.textFaint,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardBorder,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    fontVariant: ["tabular-nums"],
    minHeight: 48,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.dangerText,
  },
  sheetCta: {
    marginTop: spacing.lg,
  },
  saveBtnText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textOnAccent,
  },
});
