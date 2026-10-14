import Link from "next/link";
import { Fish } from "lucide-react";

/**
 * Auth shell — a single centered card floating on the ocean background.
 * Used by /login and /signup.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-ocean-depth px-4 py-12">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-8 flex items-center justify-center gap-2.5 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-lagoon-400 focus-visible:ring-offset-2 focus-visible:ring-offset-abyss-950"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-coral-500/15 text-coral-300 ring-1 ring-coral-400/30">
            <Fish className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="font-display text-xl font-bold tracking-tight text-abyss-50">
            AI Reef Doctor
          </span>
        </Link>

        <div className="reef-card">{children}</div>

        <p className="mt-6 text-center text-xs text-abyss-300/70">
          Educational guidance for reef keepers — not a substitute for a
          qualified aquatic veterinarian.
        </p>
      </div>
    </main>
  );
}
