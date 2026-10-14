import * as React from "react";
import { View, AccessibilityInfo, type ViewProps } from "react-native";
import {
  GlassView,
  GlassContainer,
  isLiquidGlassAvailable,
} from "expo-glass-effect";
import { colors } from "@/theme/tokens";

/**
 * Single source of truth for Liquid Glass (iOS 26). Glass renders ONLY when the
 * OS supports it AND the user hasn't enabled Reduce Transparency; otherwise we
 * fall back to a designed opaque surface (Apple HIG accessibility requirement).
 * Per HIG, glass belongs on the NAVIGATION layer (floating bars, CTAs, sheets) —
 * keep content cards opaque.
 */
export function useGlassEnabled(): boolean {
  const [reduceTransparency, setReduceTransparency] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceTransparencyEnabled?.()
      .then((v) => mounted && setReduceTransparency(!!v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.(
      "reduceTransparencyChanged",
      (v: boolean) => setReduceTransparency(!!v),
    );
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  return isLiquidGlassAvailable() && !reduceTransparency;
}

export type GlassProps = ViewProps & {
  /** 'regular' (adaptive, use for anything with text) or 'clear' (over imagery + scrim). */
  variant?: "regular" | "clear";
  /** Reacts to touch with a fluid highlight (use for tappable glass). */
  interactive?: boolean;
  tintColor?: string;
  /** Opaque fallback fill when glass is unavailable / Reduce Transparency. */
  fallbackColor?: string;
  fallbackBorder?: boolean;
};

/**
 * A glass surface that degrades to an opaque card. Never nest <Glass> in <Glass>
 * (glass-on-glass is disallowed) — group siblings in <GlassGroup> instead.
 */
export function Glass({
  variant = "regular",
  interactive,
  tintColor,
  fallbackColor,
  fallbackBorder = true,
  style,
  children,
  ...rest
}: GlassProps) {
  const glass = useGlassEnabled();

  if (glass) {
    return (
      <GlassView
        glassEffectStyle={variant}
        isInteractive={interactive}
        tintColor={tintColor}
        style={style}
        {...rest}
      >
        {children}
      </GlassView>
    );
  }

  return (
    <View
      style={[
        {
          backgroundColor: fallbackColor ?? colors.cardElevated,
          borderWidth: fallbackBorder ? 1 : 0,
          borderColor: colors.cardBorder,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

/** Groups adjacent glass surfaces so they blend into one shape (no glass-on-glass). */
export function GlassGroup({
  spacing = 8,
  children,
  style,
}: {
  spacing?: number;
  children: React.ReactNode;
  style?: ViewProps["style"];
}) {
  const glass = useGlassEnabled();
  if (glass) {
    return (
      <GlassContainer spacing={spacing} style={style}>
        {children}
      </GlassContainer>
    );
  }
  return <View style={style}>{children}</View>;
}
