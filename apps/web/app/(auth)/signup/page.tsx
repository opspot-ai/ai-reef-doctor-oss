import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { features } from "@/lib/env";
import { OAuthButtons } from "@/app/(auth)/oauth-buttons";
import { SignupForm } from "@/app/(auth)/signup/signup-form";

export const metadata: Metadata = {
  title: "Create your account",
  description: "Create your AI Reef Doctor account.",
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const nextRaw = firstParam(params.next);
  const next =
    nextRaw && nextRaw.startsWith("/") && !nextRaw.startsWith("//")
      ? nextRaw
      : undefined;

  return (
    <div className="grid gap-6">
      <div className="grid gap-1.5 text-center">
        <h1 className="font-display text-2xl font-bold tracking-tight text-abyss-50">
          Create your account
        </h1>
        <p className="text-sm text-abyss-200/80">
          Start tracking your tank and get reef-expert guidance.
        </p>
      </div>

      {!features.supabase ? (
        <div
          role="status"
          className="rounded-xl border border-lagoon-400/25 bg-lagoon-500/10 px-4 py-3 text-sm text-lagoon-100"
        >
          Sign-up isn&apos;t switched on yet. The owner needs to add Supabase
          credentials before accounts work. You can still explore the rest of
          the app in the meantime.
        </div>
      ) : (
        <>
          <OAuthButtons next={next} />

          <div className="flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-white/10" />
            <span className="text-xs uppercase tracking-widest text-abyss-300/60">
              or
            </span>
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <SignupForm next={next} />
        </>
      )}

      <div className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <ShieldCheck
          className="mt-0.5 h-4 w-4 shrink-0 text-lagoon-300"
          aria-hidden="true"
        />
        <p className="text-xs leading-relaxed text-abyss-200/80">
          AI Reef Doctor offers educational guidance to help you care for your
          tank. It is not a substitute for a qualified aquatic veterinarian. For
          serious or worsening health issues, consult a professional.
        </p>
      </div>

      <p className="text-center text-sm text-abyss-200/80">
        Already have an account?{" "}
        <Link
          href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
          className="font-semibold text-lagoon-300 hover:text-lagoon-200 focus:outline-none focus-visible:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
