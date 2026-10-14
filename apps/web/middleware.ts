import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { publicEnv, features } from "@/lib/env";

/**
 * Refreshes the Supabase auth session on every request and guards the authed
 * app area. If Supabase isn't configured yet (no owner creds), it's a no-op so
 * the marketing site still renders in dev.
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  if (!features.supabase) return response;

  const supabase = createServerClient(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Gate the authed app area.
  const path = request.nextUrl.pathname;
  const isAppArea = path.startsWith("/dashboard") ||
    path.startsWith("/tanks") ||
    path.startsWith("/doctor") ||
    path.startsWith("/diagnose") ||
    path.startsWith("/parameters") ||
    path.startsWith("/reminders") ||
    path.startsWith("/reports") ||
    path.startsWith("/account");

  if (isAppArea && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
