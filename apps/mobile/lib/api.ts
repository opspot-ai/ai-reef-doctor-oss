import { createApiClient, type ApiClient } from "@reef/shared";
import { publicEnv } from "@/lib/env";
import { getAccessToken } from "@/lib/supabase";

/**
 * The typed API client for the web app's server routes (AI + commerce), shared
 * with the web via @reef/shared. `baseUrl` is the web origin; `getToken`
 * supplies the Supabase access token so every call is authenticated. All AI
 * secrets stay server-side — this client only ever sends a user bearer token.
 *
 * Re-exports ApiError / ApiClient types so screens import everything from here.
 */
export const api: ApiClient = createApiClient({
  baseUrl: publicEnv.apiBaseUrl,
  getToken: getAccessToken,
});

export { ApiError } from "@reef/shared";
export type { ApiClient } from "@reef/shared";
