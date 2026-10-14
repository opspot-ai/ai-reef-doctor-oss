/**
 * Central env access. SERVER-ONLY secrets live in `serverEnv` — never import
 * `serverEnv` from a client component (it would leak into the bundle).
 * Missing values degrade gracefully (see `features`) so the app runs in dev
 * without owner-supplied keys; routes return clean 503s instead of crashing.
 */
export const serverEnv = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  // Apple "Sign in with Apple" token-revoke creds (owner deliverables). When
  // any are missing, account deletion still works — the revoke step is skipped.
  appleSignIn: {
    clientId: process.env.APPLE_SIGN_IN_CLIENT_ID ?? "",
    teamId: process.env.APPLE_SIGN_IN_TEAM_ID ?? "",
    keyId: process.env.APPLE_SIGN_IN_KEY_ID ?? "",
    privateKey: process.env.APPLE_SIGN_IN_PRIVATE_KEY ?? "",
  },
};

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
};

export const features = {
  get ai() {
    return serverEnv.anthropicApiKey.length > 0;
  },
  get stripe() {
    return serverEnv.stripeSecretKey.length > 0;
  },
  get supabase() {
    return publicEnv.supabaseUrl.length > 0 && publicEnv.supabaseAnonKey.length > 0;
  },
  get email() {
    return serverEnv.resendApiKey.length > 0;
  },
};
