import * as React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { colors, spacing, radii, fontSize, fontWeight } from "@/theme/tokens";
import { Glass } from "@/components/glass";
import { Sym } from "@/components/ui";
import type { SymbolViewProps } from "expo-symbols";

/** Starter prompts shown on the empty state — each paired with an SF Symbol. */
const STARTERS: readonly { symbol: SymbolViewProps["name"]; label: string; prompt: string }[] = [
  {
    symbol: "drop.fill",
    label: "Nitrates climbing",
    prompt: "My nitrates are climbing — what should I do?",
  },
  {
    symbol: "arrow.triangle.2.circlepath",
    label: "Water changes",
    prompt: "How often should I do water changes?",
  },
  {
    symbol: "fish.fill",
    label: "Fish behavior",
    prompt: "Is my clownfish acting normally?",
  },
  {
    symbol: "flask.fill",
    label: "Dial in alkalinity",
    prompt: "Help me dial in alkalinity for my SPS tank",
  },
];

/** Friendly starter prompts (kept exported for any external reference). */
export const STARTER_PROMPTS: readonly string[] = STARTERS.map((s) => s.prompt);

/**
 * The empty conversation surface: a big Stethoscope Sym in a glass disc, a short
 * tank-aware status chip, and a grid of tappable glass starter chips that seed
 * the first message. Visual-first — no paragraphs.
 */
export function ChatEmpty({
  activeTankName,
  onPick,
  disabled,
}: {
  activeTankName: string | null;
  onPick: (prompt: string) => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.wrap}>
      <Glass
        variant="regular"
        fallbackColor={colors.cardElevated}
        style={styles.hero}
      >
        <Sym name="stethoscope" size={48} color={colors.brandSoft} />
      </Glass>

      <Text style={styles.heading}>Reef Doctor</Text>

      <View style={styles.statusChip}>
        <Sym
          name={activeTankName ? "checkmark.seal.fill" : "plus.circle"}
          size={14}
          color={activeTankName ? colors.brandSoft : colors.textMuted}
        />
        <Text style={styles.statusText} numberOfLines={1}>
          {activeTankName ?? "Add a tank for tailored answers"}
        </Text>
      </View>

      <View style={styles.chips}>
        {STARTERS.map((s) => (
          <Pressable
            key={s.prompt}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onPick(s.prompt);
            }}
            disabled={disabled}
            style={({ pressed }) => [
              styles.chipWrap,
              pressed && styles.chipPressed,
              disabled && styles.chipDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Ask: ${s.prompt}`}
          >
            <Glass
              variant="regular"
              fallbackColor={colors.cardElevated}
              style={styles.chip}
            >
              <Sym name={s.symbol} size={20} color={colors.brandSoft} />
              <Text style={styles.chipText} numberOfLines={2}>
                {s.label}
              </Text>
            </Glass>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xl,
  },
  hero: {
    width: 96,
    height: 96,
    borderRadius: radii["2xl"],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
    overflow: "hidden",
  },
  heading: {
    fontSize: fontSize["2xl"],
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    maxWidth: "90%",
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  statusText: {
    flexShrink: 1,
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.md,
    maxWidth: 380,
  },
  chipWrap: {
    width: "46%",
    minWidth: 150,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    overflow: "hidden",
  },
  chipPressed: {
    opacity: 0.7,
  },
  chipDisabled: {
    opacity: 0.5,
  },
  chipText: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
});
