import type { Config } from "tailwindcss";

/**
 * AI Reef Doctor design tokens .
 * Premium, aquatic: deep ocean blues/teals, coral accents, generous whitespace.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
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
        // Semantic status for health/diagnosis surfaces
        healthy: "#21b8a5",
        caution: "#f5a623",
        danger: "#e8350f",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
      boxShadow: {
        reef: "0 10px 40px -12px rgba(10, 42, 65, 0.35)",
        glow: "0 0 0 1px rgba(33, 184, 165, 0.25), 0 8px 30px -8px rgba(15, 156, 139, 0.4)",
      },
      backgroundImage: {
        "ocean-depth":
          "radial-gradient(1200px 600px at 50% -10%, rgba(33,184,165,0.18), transparent), linear-gradient(180deg, #0a2a41 0%, #061a2a 100%)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      animation: {
        shimmer: "shimmer 2.2s linear infinite",
        float: "float 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
