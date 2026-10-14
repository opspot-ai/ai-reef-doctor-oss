"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageCircle,
  Camera,
  FlaskConical,
  Bell,
  FileText,
  Wrench,
  Settings,
  Menu,
  X,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { Logo } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { Tank } from "@reef/shared";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/doctor", label: "Reef Doctor", icon: MessageCircle },
  { href: "/diagnose", label: "Photo Diagnosis", icon: Camera },
  { href: "/parameters", label: "Parameters", icon: FlaskConical },
  { href: "/reminders", label: "Reminders", icon: Bell },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/tools", label: "Tools", icon: Wrench },
];

export interface ShellUser {
  email: string;
  full_name: string;
}

export function AppShell({
  user,
  tanks,
  demo,
  children,
}: {
  user: ShellUser;
  tanks: Tank[];
  demo: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [active, setActive] = React.useState<string | undefined>(tanks[0]?.id);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    const saved = window.localStorage.getItem("active_tank");
    if (saved && tanks.some((t) => t.id === saved)) setActive(saved);
  }, [tanks]);

  function selectTank(id: string) {
    setActive(id);
    window.localStorage.setItem("active_tank", id);
    document.cookie = `active_tank=${id}; path=/; max-age=31536000; samesite=lax`;
  }

  const withTank = (href: string) =>
    active ? `${href}?tank=${active}` : href;

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const activeRoute = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={withTank(href)}
            onClick={onNavigate}
            aria-current={activeRoute ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              activeRoute
                ? "bg-lagoon-500/15 text-lagoon-100 ring-1 ring-inset ring-lagoon-400/25"
                : "text-abyss-100/70 hover:bg-white/5 hover:text-abyss-50",
            )}
          >
            <Icon className="h-[18px] w-[18px]" />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  const Sidebar = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="flex h-full flex-col gap-6 p-5">
      <Link href="/dashboard" onClick={onNavigate}>
        <Logo />
      </Link>
      {tanks.length > 0 && (
        <label className="block">
          <span className="sr-only">Active tank</span>
          <div className="relative">
            <select
              value={active}
              onChange={(e) => selectTank(e.target.value)}
              className="reef-input appearance-none pr-9 text-sm"
            >
              {tanks.map((t) => (
                <option key={t.id} value={t.id} className="bg-abyss-900">
                  {t.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-abyss-200/60" />
          </div>
        </label>
      )}
      <div className="flex-1">
        <NavLinks onNavigate={onNavigate} />
      </div>
      <div className="border-t border-white/10 pt-4">
        <Link
          href={withTank("/account")}
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-abyss-100/70 transition hover:bg-white/5 hover:text-abyss-50"
        >
          <Settings className="h-[18px] w-[18px]" /> Account &amp; Billing
        </Link>
        <div className="mt-3 flex items-center justify-between gap-2 px-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-abyss-50">
              {user.full_name || "Reefer"}
            </p>
            <p className="truncate text-xs text-abyss-200/50">{user.email}</p>
          </div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              aria-label="Sign out"
              className="rounded-lg p-2 text-abyss-200/60 transition hover:bg-white/5 hover:text-coral-300"
            >
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-white/10 bg-abyss-950/40 backdrop-blur lg:block">
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-72 border-r border-white/10 bg-abyss-950">
            <button
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-2 text-abyss-200/70 hover:bg-white/5"
            >
              <X className="h-5 w-5" />
            </button>
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/10 bg-abyss-950/60 px-4 py-3 backdrop-blur lg:hidden">
          <button
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-abyss-100 hover:bg-white/5"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Logo withWordmark />
        </header>

        {demo && (
          <div className="border-b border-amber-400/20 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-100/90">
            <strong className="font-semibold">Demo mode</strong> — showing sample
            data. Add Supabase credentials to use your own tanks.
          </div>
        )}

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
