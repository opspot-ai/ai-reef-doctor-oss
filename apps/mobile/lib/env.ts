/**
 * Central client env access for the mobile app. Only EXPO_PUBLIC_* values are
 * readable on-device (anything else would never be injected into the bundle).
 * Missing values degrade gracefully → DEMO MODE, mirroring apps/web/lib/env.ts.
 *
 * NEVER read a server secret (anthropic / stripe / service-role) here — those
 * stay on the web API and are reached only via an authenticated bearer token.
 */

export const publicEnv = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000",
} as const;

export const features = {
  get supabase(): boolean {
    return publicEnv.supabaseUrl.length > 0 && publicEnv.supabaseAnonKey.length > 0;
  },
  get api(): boolean {
    return publicEnv.apiBaseUrl.length > 0;
  },
} as const;

/**
 * Demo mode = no Supabase creds configured. The app serves a demo dataset so it
 * is fully browsable without owner-supplied keys; a banner makes this clear.
 */
export function isDemoMode(): boolean {
  return !features.supabase;
}
