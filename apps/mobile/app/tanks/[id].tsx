import * as React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  classifyReading,
  cycleStage,
  TARGET_RANGES,
  type Tank,
  type ParameterRow,
  type Livestock,
} from "@reef/shared";
import {
  Screen,
  Card,
  Stat,
  Title,
  Badge,
  GlassCTA,
  Sym,
  EmptyState,
  DisclaimerBanner,
  Spinner,
  Button,
  type Tone,
} from "@/components/ui";
import { FishIcon } from "@/components/icons";
import { colors, spacing, radii, fontSize, fontWeight } from "@/theme/tokens";
import { getTank, listLivestock, getLatestParameters } from "@/lib/data";
import { TANK_TYPE_LABEL, CYCLE_LABEL, daysSince } from "@/lib/format";
import type { SymbolViewProps } from "expo-symbols";

/**
 * Tank detail — the system's digital twin rendered visually: a glass spec grid
 * (volume / age / inhabitants / temperature as big numbers), type + cycle +
 * health chips, and livestock grouped by kind with an SF Symbol per group.
 * Read-only and demo-safe.
 */

const CYCLE_TONE: Record<string, Tone> = {
  "not-started": "neutral",
  ammonia: "caution",
  nitrite: "caution",
  nitrate: "caution",
  cycled: "healthy",
};

const STATUS_TONE: Record<string, Tone> = {
  alive: "healthy",
  deceased: "danger",
  removed: "neutral",
};

const GROUPS: Array<{
  key: Livestock["kind"];
  label: string;
  symbol: SymbolViewProps["name"];
}> = [
  { key: "fish", label: "Fish", symbol: "fish.fill" },
  { key: "coral", label: "Corals", symbol: "leaf.fill" },
  { key: "invert", label: "Inverts", symbol: "ant.fill" },
];

function volumeGallons(liters: number): number {
  return Math.round(liters / 3.785);
}

function tankAge(startedAt?: string | null): { value: string; unit: string } {
  const days = daysSince(startedAt);
  if (days === null) return { value: "—", unit: "" };
  if (days < 60) return { value: String(days), unit: "days" };
  const months = Math.floor(days / 30);
  if (months < 24) return { value: String(months), unit: "months" };
  return { value: (months / 12).toFixed(1), unit: "years" };
}

function paramHealth(
  tank: Tank,
  latest: ParameterRow | null,
): { tone: Tone; label: string } {
  if (!latest) return { tone: "neutral", label: "No data" };
  const results = classifyReading(latest, tank.type);
  if (results.some((r) => r.status === "critical")) {
    return { tone: "danger", label: "Action needed" };
  }
  if (results.some((r) => r.status === "low" || r.status === "high")) {
    return { tone: "caution", label: "Watch" };
  }
  return { tone: "healthy", label: "Healthy" };
}

interface Loaded {
  tank: Tank | null;
  livestock: Livestock[];
  latest: ParameterRow | null;
}

export default function TankDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [loaded, setLoaded] = React.useState<Loaded | null>(null);

  React.useEffect(() => {
    let active = true;
    (async () => {
      if (!id) {
        if (active) setLoaded({ tank: null, livestock: [], latest: null });
        return;
      }
      const tank = await getTank(id);
      if (!tank) {
        if (active) setLoaded({ tank: null, livestock: [], latest: null });
        return;
      }
      const [livestock, latest] = await Promise.all([
        listLivestock(tank.id),
        getLatestParameters(tank.id),
      ]);
      if (active) setLoaded({ tank, livestock, latest });
    })();
    return () => {
      active = false;
    };
  }, [id]);

  if (!loaded) {
    return (
      <Screen scroll={false} contentStyle={styles.center}>
        <Spinner />
      </Screen>
    );
  }

  const { tank, livestock, latest } = loaded;

  if (!tank) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Tank" }} />
        <EmptyState
          Icon={FishIcon}
          title="Tank not found"
          description="This tank isn't available in the current session."
          action={
            <Button variant="secondary" onPress={() => router.replace("/tanks")}>
              Back to tanks
            </Button>
          }
        />
      </Screen>
    );
  }

  const stage = cycleStage(latest ?? ({} as ParameterRow));
  const health = paramHealth(tank, latest);
  const aliveCount = livestock.filter((l) => l.status === "alive").length;
  const age = tankAge(tank.started_at);

  const tempTarget = TARGET_RANGES[tank.type].temp_c;
  const tempStatus =
    latest?.temp_c != null
      ? classifyReading(latest, tank.type).find((r) => r.key === "temp_c")
          ?.status
      : undefined;
  const tempTone: "neutral" | "healthy" | "caution" | "danger" =
    tempStatus === undefined
      ? "neutral"
      : tempStatus === "ok"
        ? "healthy"
        : tempStatus === "critical"
          ? "danger"
          : "caution";

  return (
    <Screen>
      <Stack.Screen options={{ title: tank.name }} />

      {/* Hero: name + chips */}
      <View style={styles.hero}>
        <Title style={styles.heroTitle}>{tank.name}</Title>
        <View style={styles.badgeRow}>
          <Badge tone="brand">{TANK_TYPE_LABEL[tank.type]}</Badge>
          <Badge tone={CYCLE_TONE[stage] ?? "neutral"}>
            {CYCLE_LABEL[stage] ?? stage}
          </Badge>
          <Badge tone={health.tone}>{health.label}</Badge>
        </View>
      </View>

      {/* Spec grid — big visuals */}
      <View style={styles.statGrid}>
        <Stat
          label="Volume"
          value={
            <BigVal
              num={String(Math.round(tank.volume_liters))}
              unit={`L · ${volumeGallons(tank.volume_liters)} gal`}
              symbol="drop.fill"
              color={colors.text}
            />
          }
          style={styles.statCell}
        />
        <Stat
          label="Age"
          value={
            <BigVal
              num={age.value}
              unit={age.unit}
              symbol="calendar"
              color={colors.text}
            />
          }
          style={styles.statCell}
        />
        <Stat
          label="Inhabitants"
          value={
            <BigVal
              num={String(aliveCount)}
              unit="alive"
              symbol="fish.fill"
              color={colors.text}
            />
          }
          style={styles.statCell}
        />
        <Stat
          label="Temperature"
          value={
            <BigVal
              num={latest?.temp_c != null ? String(latest.temp_c) : "—"}
              unit={tempTarget ? `target ${tempTarget.min}–${tempTarget.max}°C` : "°C"}
              symbol="thermometer.medium"
              color={
                tempTone === "healthy"
                  ? colors.brandSoft
                  : tempTone === "caution"
                    ? colors.cautionText
                    : tempTone === "danger"
                      ? colors.dangerText
                      : colors.text
              }
            />
          }
          tone={tempTone}
          style={styles.statCell}
        />
      </View>

      {tank.notes ? (
        <Card style={styles.noteCard}>
          <Sym name="info.circle.fill" size={16} color={colors.brandSoft} />
          <Text style={styles.noteText}>{tank.notes}</Text>
        </Card>
      ) : null}

      {/* Focal action: parameters */}
      <GlassCTA
        label="View parameters"
        symbol="chart.line.uptrend.xyaxis"
        tone="brand"
        onPress={() => router.push("/(tabs)/parameters")}
      />

      {/* Livestock grouped by kind */}
      {livestock.length === 0 ? (
        <EmptyState
          Icon={FishIcon}
          title="No livestock yet"
          description="Add fish, corals and inverts to build the inventory."
        />
      ) : (
        GROUPS.map((g) => {
          const items = livestock.filter((l) => l.kind === g.key);
          if (!items.length) return null;
          return (
            <View key={g.key} style={styles.group}>
              <View style={styles.groupHead}>
                <Sym name={g.symbol} size={18} color={colors.brandSoft} />
                <Text style={styles.groupLabel}>{g.label}</Text>
                <View style={styles.groupCountChip}>
                  <Text style={styles.groupCount}>{items.length}</Text>
                </View>
              </View>
              <View style={styles.groupList}>
                {items.map((l) => (
                  <Card key={l.id} style={styles.liveCard}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.liveName} numberOfLines={1}>
                        {l.common_name}
                        {l.nickname ? (
                          <Text style={styles.liveNick}> “{l.nickname}”</Text>
                        ) : null}
                      </Text>
                      {l.scientific_name ? (
                        <Text style={styles.liveSci} numberOfLines={1}>
                          {l.scientific_name}
                        </Text>
                      ) : null}
                    </View>
                    {l.status !== "alive" ? (
                      <Badge tone={STATUS_TONE[l.status] ?? "neutral"}>
                        {l.status}
                      </Badge>
                    ) : (
                      <Sym
                        name="checkmark.circle.fill"
                        size={18}
                        color={colors.brandSoft}
                      />
                    )}
                  </Card>
                ))}
              </View>
            </View>
          );
        })
      )}

      {/* Secondary action: remove tank (kept low-emphasis) */}
      <Pressable
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          router.replace("/tanks");
        }}
        accessibilityRole="button"
        accessibilityLabel="Back to all tanks"
        style={({ pressed }) => [styles.secondaryRow, pressed && styles.pressed]}
      >
        <Sym name="chevron.left" size={14} color={colors.textMuted} />
        <Text style={styles.secondaryText}>All tanks</Text>
      </Pressable>

      <DisclaimerBanner />
    </Screen>
  );
}

/* Big numeral + unit + symbol, used inside a glass Stat tile. */
function BigVal({
  num,
  unit,
  symbol,
  color,
}: {
  num: string;
  unit: string;
  symbol: SymbolViewProps["name"];
  color: string;
}) {
  return (
    <View style={styles.bigValWrap}>
      <View style={styles.bigValTop}>
        <Text style={[styles.bigNum, { color }]}>{num}</Text>
        <Sym name={symbol} size={16} color={color} />
      </View>
      {unit ? <Text style={styles.bigUnit}>{unit}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  hero: {
    gap: spacing.md,
  },
  heroTitle: {
    fontSize: fontSize["3xl"],
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
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
  bigValWrap: {
    marginTop: 2,
  },
  bigValTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  bigNum: {
    fontSize: fontSize["3xl"],
    fontWeight: fontWeight.bold,
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.5,
  },
  bigUnit: {
    marginTop: 2,
    fontSize: fontSize.xs,
    color: colors.textFaint,
    fontWeight: fontWeight.medium,
  },
  noteCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  noteText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    lineHeight: 21,
  },
  group: {
    gap: spacing.sm,
  },
  groupHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  groupLabel: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  groupCountChip: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  groupCount: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  groupList: {
    gap: spacing.sm,
  },
  liveCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  liveName: {
    fontWeight: fontWeight.semibold,
    color: colors.text,
    fontSize: fontSize.base,
  },
  liveNick: {
    color: colors.textMuted,
    fontWeight: fontWeight.regular,
  },
  liveSci: {
    marginTop: 2,
    fontSize: fontSize.xs,
    fontStyle: "italic",
    color: colors.textFaint,
  },
  secondaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  secondaryText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
  },
  pressed: {
    opacity: 0.7,
  },
});
