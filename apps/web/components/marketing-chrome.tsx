"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Logo, LinkButton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { MEDICAL_DISCLAIMER } from "@reef/shared";

/**
 * Shared public marketing chrome: a sticky translucent top nav and a footer
 * with links, the educational disclaimer, and copyright. Used by the landing,
 * pricing, and about pages (all public, NOT under the (app) shell).
 */

const NAV_LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
];

export function MarketingNav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile menu whenever the route changes.
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-colors duration-300",
        scrolled
          ? "border-b border-white/10 bg-abyss-950/70 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <nav
        aria-label="Primary"
        className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8"
      >
        <Link
          href="/"
          className="rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-lagoon-400 focus-visible:ring-offset-2 focus-visible:ring-offset-abyss-950"
          aria-label="Reef Doctor home"
        >
          <Logo />
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => {
            const active =
              link.href === "/pricing"
                ? pathname === "/pricing"
                : link.href === "/about"
                  ? pathname === "/about"
                  : false;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-lagoon-400",
                  active
                    ? "text-abyss-50"
                    : "text-abyss-100/70 hover:text-abyss-50",
                )}
                aria-current={active ? "page" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/login"
            className="rounded-lg px-3 py-2 text-sm font-semibold text-abyss-100/80 transition hover:text-abyss-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-lagoon-400"
          >
            Sign in
          </Link>
          <LinkButton href="/signup" className="!px-4 !py-2">
            Get started
          </LinkButton>
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-abyss-50 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-lagoon-400 md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div
          id="mobile-menu"
          className="border-t border-white/10 bg-abyss-950/95 px-5 pb-6 pt-2 backdrop-blur-xl md:hidden"
        >
          <ul className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="block rounded-lg px-3 py-2.5 text-base font-medium text-abyss-100/80 transition hover:bg-white/5 hover:text-abyss-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-lagoon-400"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-col gap-2">
            <LinkButton href="/login" variant="secondary" className="w-full">
              Sign in
            </LinkButton>
            <LinkButton href="/signup" className="w-full">
              Get started
            </LinkButton>
          </div>
        </div>
      )}
    </header>
  );
}

const FOOTER_GROUPS: { heading: string; links: { href: string; label: string }[] }[] =
  [
    {
      heading: "Product",
      links: [
        { href: "/#features", label: "Features" },
        { href: "/pricing", label: "Pricing" },
        { href: "/#how-it-works", label: "How it works" },
        { href: "/#safety", label: "AI safety" },
      ],
    },
    {
      heading: "Company",
      links: [
        { href: "/about", label: "About" },
        { href: "/login", label: "Sign in" },
        { href: "/signup", label: "Get started" },
      ],
    },
  ];

export function MarketingFooter() {
  return (
    <footer className="mt-24 border-t border-white/10 bg-abyss-950/40">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr]">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed text-abyss-200/70">
              An AI veterinarian for your saltwater reef tank — diagnosis from
              chat &amp; photos, parameter intelligence, and careful, grounded
              guidance.
            </p>
          </div>

          {FOOTER_GROUPS.map((group) => (
            <div key={group.heading}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lagoon-300">
                {group.heading}
              </p>
              <ul className="mt-4 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-abyss-100/70 transition hover:text-abyss-50 focus:outline-none focus-visible:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-xl border border-lagoon-400/20 bg-lagoon-500/[0.06] px-4 py-3 text-xs leading-relaxed text-abyss-100/70">
          <span className="font-semibold text-lagoon-200">
            Educational use only.
          </span>{" "}
          {MEDICAL_DISCLAIMER}
        </div>

        <div className="mt-8 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 text-xs text-abyss-200/50 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} Reef Doctor. All rights reserved.</p>
          <p className="text-abyss-200/40">
            Built for reefkeepers, grounded in curated marine science.
          </p>
        </div>
      </div>
    </footer>
  );
}
