import type { Metadata } from "next";
import Link from "next/link";
import { features } from "@/lib/env";
import { OAuthButtons } from "@/app/(auth)/oauth-buttons";
import { LoginForm } from "@/app/(auth)/login/login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to AI Reef Doctor.",
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; error?: string | string[] }>;
}) {
  const params = await searchParams;
  const nextRaw = firstParam(params.next);
  const next =
    nextRaw && nextRaw.startsWith("/") && !nextRaw.startsWith("//")
      ? nextRaw
      : undefined;
  const hadError = firstParam(params.error) === "auth";

  return (
    <div className="grid gap-6">
      <div className="grid gap-1.5 text-center">
        <h1 className="font-display text-2xl font-bold tracking-tight text-abyss-50">
          Welcome back
        </h1>
        <p className="text-sm text-abyss-200/80">
          Sign in to check on your reef.
        </p>
      </div>

      {!features.supabase ? (
        <div
          role="status"
          className="rounded-xl border border-lagoon-400/25 bg-lagoon-500/10 px-4 py-3 text-sm text-lagoon-100"
        >
          Sign-in isn&apos;t switched on yet. The owner needs to add Supabase
          credentials before accounts work. You can still explore the rest of
          the app in the meantime.
        </div>
      ) : (
        <>
          {hadError ? (
            <p
              role="alert"
              className="rounded-xl border border-coral-500/30 bg-coral-500/10 px-4 py-2.5 text-sm text-coral-200"
            >
              That sign-in link didn&apos;t work. Please try again.
            </p>
          ) : null}

          <OAuthButtons next={next} />

          <div className="flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-white/10" />
            <span className="text-xs uppercase tracking-widest text-abyss-300/60">
              or
            </span>
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <LoginForm next={next} />
        </>
      )}

      <p className="text-center text-sm text-abyss-200/80">
        New to AI Reef Doctor?{" "}
        <Link
          href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
          className="font-semibold text-lagoon-300 hover:text-lagoon-200 focus:outline-none focus-visible:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
