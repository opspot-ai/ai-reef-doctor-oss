import * as React from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  type ViewStyle,
  type TextStyle,
  type StyleProp,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  confidenceLabel,
  MEDICAL_DISCLAIMER,
  type SourceCitation,
} from "@reef/shared";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import * as Haptics from "expo-haptics";
import { colors, spacing, radii, fontSize, fontWeight } from "@/theme/tokens";
import { Glass } from "@/components/glass";
import {
  FishIcon,
  InfoIcon,
  ActivityIcon,
  AlertTriangleIcon,
  ShieldAlertIcon,
  type IconProps,
} from "@/components/icons";

/* ─────────────────────────── SF Symbol ─────────────────────────── */
/** Native SF Symbol (glanceable, Dynamic-Type aware). Prefer over text + custom icons. */
export function Sym({
  name,
  size = 22,
  color = colors.brandSoft,
  type = "hierarchical",
  weight = "semibold",
  style,
}: {
  name: SymbolViewProps["name"];
  size?: number;
  color?: string;
  type?: SymbolViewProps["type"];
  weight?: SymbolViewProps["weight"];
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <SymbolView
      name={name}
      size={size}
      tintColor={color}
      type={type}
      weight={weight}
      resizeMode="scaleAspectFit"
      style={[{ width: size, height: size }, style]}
    />
  );
}

/* ─────────────────────────── shared tones ─────────────────────────── */

export type Tone = "neutral" | "healthy" | "caution" | "danger" | "brand";

const TONE_BG: Record<Tone, string> = {
  neutral: "rgba(255,255,255,0.10)",
  healthy: "rgba(15,156,139,0.15)",
  caution: "rgba(245,158,11,0.15)",
  danger: "rgba(251,77,36,0.15)",
  brand: "rgba(61,141,189,0.15)",
};
const TONE_TEXT: Record<Tone, string> = {
  neutral: colors.text,
  healthy: colors.healthyText,
  caution: colors.cautionText,
  danger: colors.dangerText,
  brand: colors.text,
};
const TONE_BORDER: Record<Tone, string> = {
  neutral: "rgba(255,255,255,0.15)",
  healthy: "rgba(33,184,165,0.30)",
  caution: "rgba(251,191,36,0.30)",
  danger: "rgba(255,106,66,0.30)",
  brand: "rgba(115,179,214,0.30)",
};

/* ─────────────────────────── Screen ─────────────────────────── */

/**
 * Root screen wrapper: safe area + dark ocean background + scrollable content
 * with consistent padding. Pass `scroll={false}` for screens that own scroll.
 */
export function Screen({
  children,
  scroll = true,
  contentStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const inner = (
    <View style={[styles.screenContent, contentStyle]}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

/* ─────────────────────────── Card / labels ─────────────────────────── */

/** Content surface rendered as Liquid Glass (regular variant for legibility),
 * with an opaque fallback when glass is unavailable / Reduce Transparency. */
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Glass variant="regular" style={[styles.cardGlass, style]}>
      {children}
    </Glass>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export function Title({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

export function Subtitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.subtitle}>{children}</Text>;
}

/* ─────────────────────────── Button ─────────────────────────── */

export function Button({
  children,
  onPress,
  variant = "primary",
  disabled,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btnBase,
        variant === "primary" ? styles.btnPrimary : styles.btnSecondary,
        pressed && styles.btnPressed,
        disabled && styles.btnDisabled,
        style,
      ]}
      accessibilityRole="button"
    >
      {typeof children === "string" ? (
        <Text
          style={[
            styles.btnText,
            variant === "primary"
              ? styles.btnTextPrimary
              : styles.btnTextSecondary,
          ]}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

/* ─────────────────────────── Badge ─────────────────────────── */

export function Badge({
  children,
  tone = "neutral",
  style,
}: {
  children: React.ReactNode;
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: TONE_BG[tone], borderColor: TONE_BORDER[tone] },
        style,
      ]}
    >
      {typeof children === "string" ? (
        <Text style={[styles.badgeText, { color: TONE_TEXT[tone] }]}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

/** Confidence indicator for diagnoses (0..1) — a trust signal . */
export function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, confidence)) * 100);
  const tone: Tone = pct >= 80 ? "healthy" : pct >= 55 ? "caution" : "danger";
  const barColor =
    tone === "healthy"
      ? colors.healthy
      : tone === "caution"
        ? colors.caution
        : colors.danger;
  return (
    <View style={styles.confidenceRow}>
      <Badge tone={tone}>{`${confidenceLabel(confidence)} · ${pct}%`}</Badge>
      <View style={styles.confidenceTrack}>
        <View
          style={[
            styles.confidenceFill,
            { width: `${pct}%`, backgroundColor: barColor },
          ]}
        />
      </View>
    </View>
  );
}

const URGENCY: Record<
  string,
  { tone: Tone; Icon: (p: IconProps) => React.ReactElement; label: string }
> = {
  routine: { tone: "healthy", Icon: ActivityIcon, label: "Routine" },
  monitor: { tone: "caution", Icon: ActivityIcon, label: "Monitor" },
  urgent: { tone: "danger", Icon: AlertTriangleIcon, label: "Urgent" },
  emergency: { tone: "danger", Icon: ShieldAlertIcon, label: "Emergency" },
};

export function UrgencyBadge({ urgency }: { urgency: string }) {
  const u = URGENCY[urgency] ?? URGENCY.routine!;
  const Icon = u.Icon;
  return (
    <Badge tone={u.tone}>
      <View style={styles.iconBadgeRow}>
        <Icon size={13} color={TONE_TEXT[u.tone]} />
        <Text style={[styles.badgeText, { color: TONE_TEXT[u.tone] }]}>
          {u.label}
        </Text>
      </View>
    </Badge>
  );
}

/* ─────────────────── Trust signals: disclaimer + sources ─────────────────── */

export function DisclaimerBanner({
  text = MEDICAL_DISCLAIMER,
  style,
}: {
  text?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      accessibilityRole="summary"
      style={[styles.disclaimer, style]}
    >
      <InfoIcon size={16} color={colors.brandSoft} />
      <Text style={styles.disclaimerText}>{text}</Text>
    </View>
  );
}

export function SourceList({ sources }: { sources: SourceCitation[] }) {
  if (!sources?.length) return null;
  return (
    <View style={{ marginTop: spacing.md }}>
      <SectionLabel>Sources</SectionLabel>
      <View style={styles.sourceWrap}>
        {sources.map((s, i) => (
          <Badge key={`${s.ref}-${i}`} tone="brand">
            {s.title}
          </Badge>
        ))}
      </View>
    </View>
  );
}

/* ─────────────────────────── States ─────────────────────────── */

export function Spinner({ color = colors.brandSoft }: { color?: string }) {
  return <ActivityIndicator color={color} />;
}

export function EmptyState({
  Icon = FishIcon,
  title,
  description,
  action,
}: {
  Icon?: (p: IconProps) => React.ReactElement;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon size={28} color={colors.brandSoft} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {description ? (
        <Text style={styles.emptyDescription}>{description}</Text>
      ) : null}
      {action ? <View style={{ marginTop: spacing.lg }}>{action}</View> : null}
    </View>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = "neutral",
  style,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "neutral" | "healthy" | "caution" | "danger";
  style?: StyleProp<ViewStyle>;
}) {
  const valueColor =
    tone === "healthy"
      ? colors.brandSoft
      : tone === "caution"
        ? colors.cautionText
        : tone === "danger"
          ? colors.dangerText
          : colors.text;
  return (
    <Glass variant="regular" style={[styles.statGlass, style]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color: valueColor }]}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </Glass>
  );
}

/* ─────────────────────────── Glass CTA ─────────────────────────── */
/** Prominent, tappable Liquid Glass action (the one focal action per surface).
 * Pairs an SF Symbol with a short label; fires a haptic on press. */
export function GlassCTA({
  label,
  symbol,
  onPress,
  tone = "brand",
  disabled,
  style,
}: {
  label: string;
  symbol?: SymbolViewProps["name"];
  onPress?: () => void;
  tone?: "brand" | "accent" | "neutral";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const tint =
    tone === "accent"
      ? colors.accent
      : tone === "neutral"
        ? undefined
        : colors.brand;
  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        onPress?.();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[disabled && styles.btnDisabled, style]}
    >
      <Glass
        variant="regular"
        interactive
        tintColor={tint}
        fallbackColor={tint ?? colors.cardElevated}
        style={styles.glassCta}
      >
        {symbol ? <Sym name={symbol} size={20} color={colors.textOnAccent} /> : null}
        <Text style={styles.glassCtaText}>{label}</Text>
      </Glass>
    </Pressable>
  );
}

/* ─────────────────────────── styles ─────────────────────────── */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenContent: {
    gap: spacing.xl,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing["3xl"],
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.xl,
    padding: spacing.lg,
  },
  cardGlass: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    overflow: "hidden",
  },
  statGlass: {
    borderRadius: radii.lg,
    padding: spacing.md,
    overflow: "hidden",
  },
  glassCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.full,
    minHeight: 52,
    overflow: "hidden",
  },
  glassCtaText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textOnAccent,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.brandSoft,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: fontSize["2xl"],
    fontWeight: fontWeight.bold,
    color: colors.text,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: fontSize.base,
    color: colors.textMuted,
    lineHeight: 22,
  },
  btnBase: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.full,
    minHeight: 48,
  },
  btnPrimary: {
    backgroundColor: colors.brand,
  },
  btnSecondary: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardBorder,
  },
  btnPressed: {
    opacity: 0.85,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  btnTextPrimary: {
    color: colors.textOnAccent,
  },
  btnTextSecondary: {
    color: colors.text,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  iconBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  confidenceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  confidenceTrack: {
    width: 64,
    height: 6,
    borderRadius: radii.full,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  confidenceFill: {
    height: "100%",
    borderRadius: radii.full,
  },
  disclaimer: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(33,184,165,0.20)",
    backgroundColor: "rgba(15,156,139,0.07)",
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  disclaimerText: {
    flex: 1,
    fontSize: fontSize.xs,
    lineHeight: 18,
    color: "rgba(212,233,244,0.8)",
  },
  sourceWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.10)",
    borderStyle: "dashed",
    backgroundColor: "rgba(255,255,255,0.02)",
    borderRadius: radii.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing["3xl"],
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radii.xl,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    textAlign: "center",
  },
  emptyDescription: {
    marginTop: spacing.xs,
    maxWidth: 320,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  stat: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: fontWeight.medium,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.textFaint,
  },
  statValue: {
    marginTop: 2,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  statSub: {
    marginTop: 2,
    fontSize: 11,
    color: colors.textFaint,
  },
});
