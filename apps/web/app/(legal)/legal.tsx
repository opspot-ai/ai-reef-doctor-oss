import type { ReactNode } from "react";
import { MarketingNav, MarketingFooter } from "@/components/marketing-chrome";

/**
 * Shared chrome + typography for legal pages (Privacy, Terms).
 * NOTE: these are good-faith TEMPLATES — have counsel review before launch .
 */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <MarketingNav />
      <main id="main" className="mx-auto max-w-3xl px-5 pb-24 pt-28 sm:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lagoon-300">
          Legal
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-abyss-50">
          {title}
        </h1>
        <p className="mt-2 text-sm text-abyss-200/60">Last updated: {updated}</p>
        <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-100/90">
          Template for review — confirm with legal counsel before launch.
        </div>
        <div className="legal-prose mt-8 space-y-6 text-abyss-100/85">
          {children}
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}

export function Section({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-semibold text-abyss-50">
        {heading}
      </h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-abyss-100/80">
        {children}
      </div>
    </section>
  );
}
