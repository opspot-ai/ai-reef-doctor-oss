"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { Provider } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { features, publicEnv } from "@/lib/env";

/** Shape every form action returns so the client form can render errors. */
export interface AuthActionState {
  error?: string;
}

const NOT_CONFIGURED =
  "Sign-in isn't available yet — the owner needs to add Supabase credentials.";

/** Only allow same-origin relative redirects to avoid open-redirect abuse. */
function safeNext(next: FormDataEntryValue | null): string {
  const value = typeof next === "string" ? next : "";
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return "/dashboard";
}

const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

const signUpSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your full name.").max(120),
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

const OAUTH_PROVIDERS = ["google", "apple"] as const;
type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

function isOAuthProvider(value: string): value is OAuthProvider {
  return (OAUTH_PROVIDERS as readonly string[]).includes(value);
}

export async function signInWithPassword(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!features.supabase) return { error: NOT_CONFIGURED };

  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details." };
  }

  const next = safeNext(formData.get("next"));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    return { error: "We couldn't sign you in. Check your email and password." };
  }

  redirect(next);
}

export async function signUpWithPassword(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!features.supabase) return { error: NOT_CONFIGURED };

  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details." };
  }

  const next = safeNext(formData.get("next"));
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${publicEnv.siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) {
    return { error: "We couldn't create your account. Please try again." };
  }

  // When email confirmation is required, no session is returned yet.
  if (!data.session) {
    return {
      error:
        "Check your inbox to confirm your email, then sign in to get started.",
    };
  }

  redirect(next);
}

export async function signInWithOAuth(
  provider: string,
  next = "/dashboard",
): Promise<AuthActionState> {
  if (!features.supabase) return { error: NOT_CONFIGURED };
  if (!isOAuthProvider(provider)) return { error: "Unsupported sign-in method." };

  const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider as Provider,
    options: {
      redirectTo: `${publicEnv.siteUrl}/auth/callback?next=${encodeURIComponent(safe)}`,
    },
  });
  if (error || !data.url) {
    return { error: "We couldn't start sign-in. Please try again." };
  }

  redirect(data.url);
}

export async function signOut(): Promise<void> {
  if (features.supabase) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}
