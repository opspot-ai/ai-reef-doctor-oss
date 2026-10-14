/**
 * AI Reef Doctor design tokens for React Native .
 * Mirrors apps/web/tailwind.config.ts — the abyss / lagoon / coral palette plus
 * spacing, radii, type scale — as a plain JS theme object usable in RN styles.
 * Dark, premium, aquatic: deep ocean blues/teals with coral accents.
 */

export const palette = {
  // Deep ocean — primary brand surface
  abyss: {
    50: "#eef6fb",
    100: "#d4e9f4",
    200: "#a9d2e8",
    300: "#73b3d6",
    400: "#3d8dbd",
    500: "#1f6e9e",
    600: "#155680",
    700: "#114568",
    800: "#0d3450",
    900: "#0a2a41",
    950: "#061a2a",
  },
  // Reef teal — secondary / healthy
  lagoon: {
    50: "#e6fbf7",
    100: "#c2f4ea",
    200: "#8be8d8",
    300: "#4fd4c0",
    400: "#21b8a5",
    500: "#0f9c8b",
    600: "#0a7d71",
    700: "#0b645c",
    800: "#0c504a",
    900: "#0c423e",
    950: "#042a28",
  },
  // Coral — accent / call-to-action / warm highlight
  coral: {
    50: "#fff1ed",
    100: "#ffe0d6",
    200: "#ffc1ad",
    300: "#ff9878",
    400: "#ff6a42",
    500: "#fb4d24",
    600: "#e8350f",
    700: "#c0270d",
    800: "#992313",
    900: "#7c2114",
    950: "#430c06",
  },
  amber: {
    200: "#fde68a",
    300: "#fcd34d",
    400: "#fbbf24",
    500: "#f59e0b",
  },
  // Semantic status for health/diagnosis surfaces
  healthy: "#21b8a5",
  caution: "#f5a623",
  danger: "#e8350f",
  white: "#ffffff",
  black: "#000000",
} as const;

/**
 * Semantic colors used across the app's RN components. Derived from the palette
 * so screen code references intent (e.g. `colors.text`) not raw hex.
 */
export const colors = {
  // Surfaces (dark ocean depth)
  background: palette.abyss[950],
  backgroundAlt: palette.abyss[900],
  card: "rgba(255,255,255,0.04)",
  cardBorder: "rgba(255,255,255,0.08)",
  cardElevated: "rgba(255,255,255,0.06)",
  overlay: "rgba(6,26,42,0.6)",

  // Text
  text: palette.abyss[50],
  textMuted: "rgba(169,210,232,0.7)", // ~abyss-200/70
  textFaint: "rgba(169,210,232,0.5)",
  textOnAccent: palette.abyss[950],

  // Brand
  brand: palette.lagoon[400],
  brandSoft: palette.lagoon[300],
  brandDeep: palette.abyss[500],
  accent: palette.coral[500],

  // Status
  healthy: palette.lagoon[400],
  healthyText: palette.lagoon[200],
  caution: palette.amber[400],
  cautionText: palette.amber[200],
  danger: palette.coral[400],
  dangerText: palette.coral[200],

  // Borders / hairlines
  border: "rgba(255,255,255,0.08)",
  borderSubtle: "rgba(255,255,255,0.05)",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 14, // ~0.875rem (web xl)
  xl: 20, // ~1.25rem (web 2xl)
  "2xl": 28, // ~1.75rem (web 3xl)
  full: 9999,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
} as const;

export const fontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

/** A single theme object screens/components can import. */
export const theme = {
  palette,
  colors,
  spacing,
  radii,
  fontSize,
  fontWeight,
} as const;

export type Theme = typeof theme;
export default theme;
