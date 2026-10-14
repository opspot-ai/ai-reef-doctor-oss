import * as React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  classifyParameter,
  classifyReading,
  cycleStage,
  TARGET_RANGES,
  type ParamKey,
  type ParameterRow,
  type Reminder,
  type Tank,
} from "@reef/shared";
import {
  Screen,
  Card,
  Stat,
  Title,
  Badge,
  Button,
  GlassCTA,
  Sym,
  EmptyState,
  DisclaimerBanner,
  UrgencyBadge,
  Spinner,
  type Tone,
} from "@/components/ui";
import { FishIcon } from "@/components/icons";
import { colors, spacing, radii, fontSize, fontWeight } from "@/theme/tokens";
import { useAuth } from "@/lib/auth";
import {
  getActiveTank,
  getLatestParameters,
  listReminders,
  listDiagnoses,
  type DiagnosisRow,
} from "@/lib/data";
import {
  statusTone,
  fmtParam,
  dueLabel,
} from "@/lib/format";

/**
 * Dashboard "Reef" — a glanceable, visual home. Hero tank name + one overall
 * health pill, a glass grid of key-parameter tiles (big number + status color +
 * SF Symbol), two focal GlassCTAs (Ask the Doctor / Scan), and compact glass
 * rows for the next reminder + latest diagnosis. Show, don't tell.
 */

interface DashboardData {
  tank: Tank | null;
  latest: ParameterRow | null;
  reminders: Reminder[];
  diagnoses: DiagnosisRow[];
}

const KEY_PARAMS: { key: ParamKey; symbol: Parameters<typeof Sym>[0]["name"] }[] = [
  { key: "alkalinity_dkh", symbol: "drop.fill" },
  { key: "calcium_ppm", symbol: "flask.fill" },
  { key: "nitrate_ppm", symbol: "leaf.fill" },
  { key: "temp_c", symbol: "thermometer.medium" },
];

const TONE_SYMBOL: Record<Tone, Parameters<typeof Sym>[0]["name"]> = {
  healthy: "checkmark.circle.fill",
  caution: "exclamationmark.triangle.fill",
  danger: "exclamationmark.octagon.fill",
  neutral: "minus.circle.fill",
  brand: "checkmark.circle.fill",
};

const TONE_COLOR: Record<Tone, string> = {
  healthy: colors.brandSoft,
  caution: colors.cautionText,
  danger: colors.dangerText,
  neutral: colors.textFaint,
  brand: colors.brandSoft,
};

/** One overall health verdict for the whole reading. */
function overallHealth(
  tank: Tank,
  latest: ParameterRow | null,
): { tone: Tone; label: string } {
  if (!latest) return { tone: "neutral", label: "No data" };
  const stage = cycleStage(latest);
  if (stage !== "cycled" && stage !== "not-started") {
    return { tone: "caution", label: "Cycling" };
  }
  const results = classifyReading(latest, tank.type);
  if (results.some((r) => r.status === "critical")) {
    return { tone: "danger", label: "Action needed" };
  }
  if (results.some((r) => r.status === "low" || r.status === "high")) {
    return { tone: "caution", label: "Watch" };
  }
  return { tone: "healthy", label: "Healthy" };
}

export default function DashboardScreen() {
  const { user, isDemo } = useAuth();
  const router = useRouter();
  const [data, setData] = React.useState<DashboardData | null>(null);

  React.useEffect(() => {
    let active = true;
    (async () => {
      const tank = await getActiveTank();
      if (!tank) {
        if (active) setData({ tank: null, latest: null, reminders: [], diagnoses: [] });
        return;
      }
      const [latest, reminders, diagnoses] = await Promise.all([
        getLatestParameters(tank.id),
        listReminders(),
        listDiagnoses(tank.id),
      ]);
      if (active) setData({ tank, latest, reminders, diagnoses });
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!data) {
    return (
      <Screen scroll={false} contentStyle={styles.center}>
        <Spinner />
      </Screen>
    );
  }

  const { tank } = data;

  /* No tanks yet → first-run experience. */
  if (!tank) {
    return (
      <Screen>
        <EmptyState
          Icon={FishIcon}
          title="Add your first tank"
          description="Log parameters, track livestock, and unlock AI diagnosis tuned to your reef."
          action={<Button onPress={() => router.push("/tanks")}>Add a tank</Button>}
        />
        <DisclaimerBanner />
      </Screen>
    );
  }

  const health = overallHealth(tank, data.latest);
  const nextReminder = data.reminders
    .filter((r) => r.tank_id === tank.id)
    .slice()
    .sort((a, b) => +new Date(a.due_at) - +new Date(b.due_at))[0];
  const latestDiagnosis = data.diagnoses[0];

  return (
    <Screen>
      {isDemo ? (
        <View style={styles.demoChip}>
          <Badge tone="brand">
            <View style={styles.iconRow}>
              <Sym name="sparkles" size={12} color={colors.brandSoft} />
              <Text style={styles.demoText}>Demo reef</Text>
            </View>
          </Badge>
        </View>
      ) : null}

      {/* Hero: big tank name + one overall health pill */}
      <View style={styles.hero}>
        <View style={styles.heroTitleRow}>
          <Sym name="water.waves" size={26} color={colors.brandSoft} />
          <Title style={styles.heroTitle}>{tank.name}</Title>
        </View>
        <View
          style={[
            styles.healthPill,
            { borderColor: TONE_COLOR[health.tone] + "55" },
          ]}
          accessibilityLabel={`Overall health: ${health.label}`}
        >
          <Sym
            name={TONE_SYMBOL[health.tone]}
            size={20}
            color={TONE_COLOR[health.tone]}
          />
          <Text style={[styles.healthText, { color: TONE_COLOR[health.tone] }]}>
            {health.label}
          </Text>
        </View>
      </View>

      {/* Key parameter tiles — big number + status color + symbol */}
      <View style={styles.statGrid}>
        {KEY_PARAMS.map(({ key, symbol }) => {
          const range = TARGET_RANGES[tank.type][key];
          const value = data.latest ? data.latest[key] : null;
          if (value === null || value === undefined || !range) {
            return (
              <Stat
                key={key}
                label={range?.label ?? key}
                value={
                  <ParamValue
                    big="—"
                    unit=""
                    symbol={symbol}
                    color={colors.textFaint}
                  />
                }
                style={styles.statCell}
              />
            );
          }
          const status = classifyParameter(key, value, tank.type);
          const tone = statusTone(status);
          const formatted = fmtParam(key, value, "");
          return (
            <Pressable
              key={key}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                router.push("/(tabs)/parameters");
              }}
              accessibilityRole="button"
              accessibilityLabel={`${range.label} ${formatted} ${range.unit}`}
              style={({ pressed }) => [styles.statCell, pressed && styles.pressed]}
            >
              <Stat
                label={range.label}
                value={
                  <ParamValue
                    big={formatted}
                    unit={range.unit}
                    symbol={symbol}
                    color={TONE_COLOR[tone]}
                  />
                }
                tone={tone}
              />
            </Pressable>
          );
        })}
      </View>

      {/* Two focal actions */}
      <View style={styles.ctaRow}>
        <GlassCTA
          label="Ask the Doctor"
          symbol="stethoscope"
          tone="brand"
          onPress={() => router.push("/(tabs)/doctor")}
          style={styles.ctaFlex}
        />
        <GlassCTA
          label="Scan"
          symbol="camera.viewfinder"
          tone="accent"
          onPress={() => router.push("/(tabs)/diagnose")}
          style={styles.ctaFlex}
        />
      </View>

      {/* Next reminder — compact glass row */}
      {nextReminder ? (
        <Pressable
          onPress={() => router.push("/(tabs)/parameters")}
          accessibilityRole="button"
          accessibilityLabel={`Next reminder: ${nextReminder.title}`}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Card style={styles.rowCard}>
            <View style={styles.rowIcon}>
              <Sym name="bell.fill" size={20} color={colors.brandSoft} />
            </View>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {nextReminder.title}
            </Text>
            <Badge tone={dueLabel(nextReminder.due_at).tone}>
              {dueLabel(nextReminder.due_at).text}
            </Badge>
          </Card>
        </Pressable>
      ) : null}

      {/* Latest diagnosis — compact glass row */}
      {latestDiagnosis ? (
        <Pressable
          onPress={() => router.push("/(tabs)/diagnose")}
          accessibilityRole="button"
          accessibilityLabel={`Latest diagnosis: ${latestDiagnosis.summary}`}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Card style={styles.rowCard}>
            <View style={styles.rowIcon}>
              <Sym
                name="stethoscope.circle.fill"
                size={20}
                color={colors.brandSoft}
              />
            </View>
            <Text style={styles.rowTitle} numberOfLines={2}>
              {latestDiagnosis.summary}
            </Text>
            <UrgencyBadge urgency={latestDiagnosis.urgency} />
          </Card>
        </Pressable>
      ) : null}

      <DisclaimerBanner />
    </Screen>
  );
}

/* Big numeral + unit + status symbol, used inside a glass Stat tile. */
function ParamValue({
  big,
  unit,
  symbol,
  color,
}: {
  big: string;
  unit: string;
  symbol: Parameters<typeof Sym>[0]["name"];
  color: string;
}) {
  return (
    <View style={styles.paramValueWrap}>
      <View style={styles.paramNumRow}>
        <Text style={[styles.paramBig, { color }]}>{big}</Text>
        {unit ? <Text style={styles.paramUnit}>{unit}</Text> : null}
      </View>
      <Sym name={symbol} size={16} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  demoChip: {
    flexDirection: "row",
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  demoText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.brandSoft,
  },
  hero: {
    gap: spacing.md,
  },
  heroTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  heroTitle: {
    flex: 1,
    fontSize: fontSize["3xl"],
  },
  healthPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.full,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  healthText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  statCell: {
    flexGrow: 1,
    flexBasis: "47%",
  },
  pressed: {
    opacity: 0.85,
  },
  paramValueWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
    gap: spacing.sm,
  },
  paramNumRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    flex: 1,
  },
  paramBig: {
    fontSize: fontSize["3xl"],
    fontWeight: fontWeight.bold,
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.5,
  },
  paramUnit: {
    fontSize: fontSize.xs,
    color: colors.textFaint,
    fontWeight: fontWeight.medium,
  },
  ctaRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  ctaFlex: {
    flex: 1,
  },
  rowCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  rowTitle: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text,
    lineHeight: 19,
  },
});
