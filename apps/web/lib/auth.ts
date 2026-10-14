import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/supabase/server";

/**
 * Server helper for protected pages: returns the authenticated user or
 * redirects to /login (preserving where the caller wanted to go via ?next=).
 *
 * Usage in a Server Component / page:
 *   const user = await requireUser();
 */
export async function requireUser(next?: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    const target = next ? `/login?next=${encodeURIComponent(next)}` : "/login";
    redirect(target);
  }
  return user;
}

/**
 * Server helper for pages that adapt to auth state but don't require it.
 * Returns the user or null (never redirects).
 */
export async function getOptionalUser(): Promise<User | null> {
  return getCurrentUser();
}
