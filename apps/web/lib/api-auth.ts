import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";

export interface RequestContext {
  user: User | null;
  /** Supabase client scoped to the caller (RLS applies) — cookie- or token-based. */
  supabase: SupabaseClient;
}

/**
 * Resolve the caller for an API route, supporting BOTH:
 *  - web clients: Supabase session cookies (Next route handler), and
 *  - mobile clients: `Authorization: Bearer <supabase access token>`.
 * The returned client is RLS-scoped to that user for safe reads/writes.
 */
export async function getRequestContext(req: Request): Promise<RequestContext> {
  const authHeader =
    req.headers.get("authorization") ?? req.headers.get("Authorization");

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    const supabase = createClient(
      publicEnv.supabaseUrl,
      publicEnv.supabaseAnonKey,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    const { data } = await supabase.auth.getUser(token);
    return { user: data.user ?? null, supabase };
  }

  // Cookie-based (web). Mirror createSupabaseServerClient but inline so this
  // module has no circular dependency on the server helper.
  const cookieStore = await cookies();
  const supabase = createServerClient(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(toSet) {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            /* Server Component context — ignore. */
          }
        },
      },
    },
  );
  const { data } = await supabase.auth.getUser();
  return { user: data.user ?? null, supabase };
}
