import * as React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import {
  classifyReading,
  cycleStage,
  type Tank,
  type ParameterRow,
  type Livestock,
} from "@reef/shared";
import {
  Screen,
  Card,
  Title,
  Badge,
  GlassCTA,
  Sym,
  EmptyState,
  DisclaimerBanner,
  Spinner,
} from "@/components/ui";
import { WavesIcon } from "@/components/icons";
import { colors, spacing, radii, fontSize, fontWeight } from "@/theme/tokens";
import { useAuth } from "@/lib/auth";
import { listTanks, listLivestock, getLatestParameters } from "@/lib/data";
import { TANK_TYPE_LABEL } from "@/lib/format";
import type { SymbolViewProps } from "expo-symbols";

/**
 * Tank logbook — every system as a glass card: name, type symbol, big volume,
 * livestock-by-kind counts (fish / coral / invert symbols) and an at-a-glance
 * health dot from the latest reading. One focal action: Add tank.
 */

type HealthTone = "healthy" | "caution" | "danger" | "neutral";

interface TankCard {
  tank: Tank;
  counts: { total: number; fish: number; coral: number; invert: number };
  health: { tone: HealthTone; label: string };
}

const DOT_COLOR: Record<HealthTone, string> = {
  healthy: colors.healthy,
  caution: colors.caution,
  danger: colors.danger,
  neutral: "rgba(169,210,232,0.45)",
};

/** SF Symbol per tank type. */
const TYPE_SYMBOL: Record<Tank["type"], SymbolViewProps["name"]> = {
  fowlr: "fish.fill",
  soft: "leaf.fill",
  lps: "circle.hexagongrid.fill",
  sps: "laurel.leading",
  mixed: "drop.halffull",
  nano: "cube.fill",
};

function healthFromReading(
  tank: Tank,
  latest: ParameterRow | null,
): { tone: HealthTone; label: string } {
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

function countByKind(livestock: Livestock[]) {
  const alive = livestock.filter((l) => l.status === "alive");
  return {
    total: alive.length,
    fish: alive.filter((l) => l.kind === "fish").length,
    coral: alive.filter((l) => l.kind === "coral").length,
    invert: alive.filter((l) => l.kind === "invert").length,
  };
}

function volumeGallons(liters: number): number {
  return Math.round(liters / 3.785);
}

export default function TanksScreen() {
  const { isDemo } = useAuth();
  const router = useRouter();
  const [cards, setCards] = React.useState<TankCard[] | null>(null);

  const load = React.useCallback(() => {
    let active = true;
    (async () => {
      const tanks = await listTanks();
      const built = await Promise.all(
        tanks.map(async (tank) => {
          const [livestock, latest] = await Promise.all([
            listLivestock(tank.id),
            getLatestParameters(tank.id),
          ]);
          return {
            tank,
            counts: countByKind(livestock),
            health: healthFromReading(tank, latest),
          };
        }),
      );
      if (active) setCards(built);
    })();
    return () => {
      active = false;
    };
  }, []);

  useFocusEffect(load);

  if (!cards) {
    return (
      <Screen scroll={false} contentStyle={styles.center}>
        <Spinner />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.head}>
        <Title>Tanks</Title>
        {isDemo ? (
          <Badge tone="brand">
            <View style={styles.iconRow}>
              <Sym name="sparkles" size={12} color={colors.brandSoft} />
              <Text style={styles.demoText}>Demo</Text>
            </View>
          </Badge>
        ) : null}
      </View>

      {cards.length === 0 ? (
        <EmptyState
          Icon={WavesIcon}
          title="No tanks yet"
          description="Add your first system to start logging."
        />
      ) : (
        <View style={styles.list}>
          {cards.map(({ tank, counts, health }) => (
            <Pressable
              key={tank.id}
              onPress={() => router.push(`/tanks/${tank.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${tank.name}, ${TANK_TYPE_LABEL[tank.type]}, ${health.label}`}
              style={({ pressed }) => pressed && styles.cardPressed}
            >
              <Card>
                <View style={styles.cardHead}>
                  <View style={styles.typeIcon}>
                    <Sym
                      name={TYPE_SYMBOL[tank.type]}
                      size={22}
                      color={colors.brandSoft}
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.tankName} numberOfLines={1}>
                      {tank.name}
                    </Text>
                    <Text style={styles.tankType} numberOfLines={1}>
                      {TANK_TYPE_LABEL[tank.type]}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: DOT_COLOR[health.tone] },
                    ]}
                    accessibilityLabel={health.label}
                  />
                </View>

                <View style={styles.metricsRow}>
                  <View style={styles.volumeWrap}>
                    <Text style={styles.volumeNum}>
                      {Math.round(tank.volume_liters)}
                    </Text>
                    <Text style={styles.volumeUnit}>
                      L · {volumeGallons(tank.volume_liters)} gal
                    </Text>
                  </View>
                  <View style={styles.countsRow}>
                    <Count symbol="fish.fill" n={counts.fish} />
                    <Count symbol="leaf.fill" n={counts.coral} />
                    <Count symbol="ant.fill" n={counts.invert} />
                  </View>
                </View>
              </Card>
            </Pressable>
          ))}
        </View>
      )}

      <GlassCTA
        label="Add tank"
        symbol="plus"
        tone="brand"
        onPress={() => router.push("/tanks")}
      />

      <DisclaimerBanner />
    </Screen>
  );
}

function Count({
  symbol,
  n,
}: {
  symbol: SymbolViewProps["name"];
  n: number;
}) {
  return (
    <View style={styles.count}>
      <Sym name={symbol} size={15} color={colors.textMuted} />
      <Text style={styles.countNum}>{n}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
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
  list: {
    gap: spacing.md,
  },
  cardPressed: {
    opacity: 0.85,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  typeIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  tankName: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  tankType: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 1,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: radii.full,
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  volumeWrap: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 5,
  },
  volumeNum: {
    fontSize: fontSize["2xl"],
    fontWeight: fontWeight.bold,
    color: colors.text,
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.5,
  },
  volumeUnit: {
    fontSize: fontSize.xs,
    color: colors.textFaint,
    fontWeight: fontWeight.medium,
  },
  countsRow: {
    flexDirection: "row",
    gap: spacing.lg,
  },
  count: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  countNum: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
});
