import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { features } from "@/lib/env";

/**
 * OAuth / email-confirmation callback. Supabase redirects here with a `?code`
 * which we exchange for a session (cookies are set by the server client), then
 * we forward the user to `next` (defaults to /dashboard).
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");
  const next =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/dashboard";

  if (!features.supabase) {
    return NextResponse.redirect(`${origin}/login`);
  }

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Missing/invalid code → back to login with a hint.
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
