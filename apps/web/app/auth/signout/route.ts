import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { features } from "@/lib/env";

/**
 * Sign the user out (POST so it can't be triggered by a stray GET / prefetch),
 * clearing the Supabase session cookies, then send them to the marketing home.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const { origin } = new URL(request.url);
  if (features.supabase) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(`${origin}/`, { status: 303 });
}
