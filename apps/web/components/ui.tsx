import * as React from "react";
import Link from "next/link";
import {
  Fish,
  Info,
  AlertTriangle,
  ShieldAlert,
  Activity,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  confidenceLabel,
  MEDICAL_DISCLAIMER,
  type SourceCitation,
} from "@reef/shared";

/* ─────────────────────────── Brand ─────────────────────────── */
export function Logo({
  className,
  withWordmark = true,
}: {
  className?: string;
  withWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-lagoon-400 to-abyss-500 shadow-glow">
        <Fish className="h-5 w-5 text-abyss-950" strokeWidth={2.4} />
      </span>
      {withWordmark && (
        <span className="font-display text-lg font-semibold tracking-tight text-abyss-50">
          Reef Doctor
        </span>
      )}
    </span>
  );
}

/* ─────────────────────────── Card / layout ─────────────────────────── */
export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("reef-card", className)} {...props}>
      {children}
    </div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-lagoon-300">
      {children}
    </p>
  );
}

/* ─────────────────────────── Buttons ─────────────────────────── */
type ButtonProps = {
  variant?: "primary" | "secondary";
  className?: string;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  variant = "primary",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        variant === "primary" ? "reef-btn-primary" : "reef-btn-secondary",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "primary",
  className,
  children,
}: {
  href: string;
  variant?: "primary" | "secondary";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        variant === "primary" ? "reef-btn-primary" : "reef-btn-secondary",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/* ─────────────────────────── Badges ─────────────────────────── */
export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "healthy" | "caution" | "danger" | "brand";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-white/10 text-abyss-100 ring-white/15",
    healthy: "bg-lagoon-500/15 text-lagoon-200 ring-lagoon-400/30",
    caution: "bg-amber-500/15 text-amber-200 ring-amber-400/30",
    danger: "bg-coral-500/15 text-coral-200 ring-coral-400/30",
    brand: "bg-abyss-400/15 text-abyss-100 ring-abyss-300/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Confidence indicator for diagnoses (0..1) — a trust signal . */
export function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, confidence)) * 100);
  const tone = pct >= 80 ? "healthy" : pct >= 55 ? "caution" : "danger";
  return (
    <span className="inline-flex items-center gap-2">
      <Badge tone={tone}>{confidenceLabel(confidence)} · {pct}%</Badge>
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10" aria-hidden>
        <span
          className={cn(
            "block h-full rounded-full",
            tone === "healthy" && "bg-lagoon-400",
            tone === "caution" && "bg-amber-400",
            tone === "danger" && "bg-coral-400",
          )}
          style={{ width: `${pct}%` }}
        />
      </span>
    </span>
  );
}

const URGENCY: Record<
  string,
  { tone: "healthy" | "caution" | "danger"; icon: LucideIcon; label: string }
> = {
  routine: { tone: "healthy", icon: Activity, label: "Routine" },
  monitor: { tone: "caution", icon: Activity, label: "Monitor" },
  urgent: { tone: "danger", icon: AlertTriangle, label: "Urgent" },
  emergency: { tone: "danger", icon: ShieldAlert, label: "Emergency" },
};

export function UrgencyBadge({ urgency }: { urgency: string }) {
  const u = URGENCY[urgency] ?? URGENCY.routine!;
  const Icon = u.icon;
  return (
    <Badge tone={u.tone}>
      <Icon className="h-3.5 w-3.5" /> {u.label}
    </Badge>
  );
}

/* ─────────────────── Trust signals: disclaimer + sources ─────────────────── */
export function DisclaimerBanner({
  text = MEDICAL_DISCLAIMER,
  className,
}: {
  text?: string;
  className?: string;
}) {
  return (
    <div
      role="note"
      className={cn(
        "flex items-start gap-2.5 rounded-xl border border-lagoon-400/20 bg-lagoon-500/[0.07] px-3.5 py-2.5 text-xs leading-relaxed text-abyss-100/80",
        className,
      )}
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-lagoon-300" />
      <p>{text}</p>
    </div>
  );
}

export function SourceList({ sources }: { sources: SourceCitation[] }) {
  if (!sources?.length) return null;
  return (
    <div className="mt-3">
      <SectionLabel>Sources</SectionLabel>
      <ul className="flex flex-wrap gap-1.5">
        {sources.map((s, i) => (
          <li key={`${s.ref}-${i}`}>
            <Badge tone="brand">{s.title}</Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─────────────────────────── States ─────────────────────────── */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-lagoon-300",
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  );
}

export function EmptyState({
  icon: Icon = Fish,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-14 text-center">
      <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-white/5 text-lagoon-300">
        <Icon className="h-7 w-7" />
      </span>
      <h3 className="font-display text-lg font-semibold text-abyss-50">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-abyss-200/70">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "neutral" | "healthy" | "caution" | "danger";
}) {
  const valueTone =
    tone === "healthy"
      ? "text-lagoon-300"
      : tone === "caution"
        ? "text-amber-300"
        : tone === "danger"
          ? "text-coral-300"
          : "text-abyss-50";
  return (
    <div className="reef-card !p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-abyss-200/60">
        {label}
      </p>
      <p className={cn("mt-1 font-display text-2xl font-semibold", valueTone)}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-abyss-200/60">{sub}</p>}
    </div>
  );
}
