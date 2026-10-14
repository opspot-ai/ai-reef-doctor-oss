import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the AI Reef Doctor web app.
 *
 * The web server is started with Supabase, Anthropic, and Stripe env vars
 * CLEARED. That forces:
 *   - Demo mode (no Supabase) → the authed app renders rich sample data and is
 *     reachable without login.
 *   - AI "not configured" (no Anthropic) → AI routes return a clean 503 and the
 *     UI shows graceful "unavailable" states.
 *   - Stripe "not configured" → checkout/portal degrade gracefully.
 * This makes every spec deterministic and fully offline-safe.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
  webServer: {
    command: "pnpm --filter @reef/web start -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      ANTHROPIC_API_KEY: "",
      STRIPE_SECRET_KEY: "",
    },
  },
});
