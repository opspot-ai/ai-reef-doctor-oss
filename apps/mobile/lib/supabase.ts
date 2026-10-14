import "react-native-url-polyfill/auto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { publicEnv, features } from "@/lib/env";

/**
 * Supabase client for the mobile app (anon key ONLY — never the service role).
 *
 * Session persistence uses AsyncStorage (large session blob); short, sensitive
 * fragments could be moved to SecureStore later, but Supabase JS needs a single
 * sync-friendly key/value store and AsyncStorage is the supported RN choice.
 * autoRefreshToken keeps the access token fresh; detectSessionInUrl is off
 * because there is no browser URL on native (OAuth returns via deep link).
 *
 * When Supabase isn't configured we still return a client pointed at harmless
 * placeholder values so imports never throw — callers gate real use on
 * `isDemoMode()` / `features.supabase` and fall back to the demo dataset.
 */
function makeClient(): SupabaseClient {
  const url = features.supabase
    ? publicEnv.supabaseUrl
    : "https://example.invalid";
  const key = features.supabase ? publicEnv.supabaseAnonKey : "demo-anon-key";
  return createClient(url, key, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

export const supabase: SupabaseClient = makeClient();

/** The current Supabase access token, or null when signed out / in demo mode. */
export async function getAccessToken(): Promise<string | null> {
  if (!features.supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
