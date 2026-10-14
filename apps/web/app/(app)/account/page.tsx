import type { Metadata } from "next";
import {
  User,
  Mail,
  Crown,
  CheckCircle2,
  Clock,
  AlertCircle,
  LogOut,
  ShieldCheck,
  Database,
} from "lucide-react";
import {
  Card,
  SectionLabel,
  Badge,
  Button,
} from "@/components/ui";
import {
  getSessionUser,
  getSessionEntitlements,
  isDemoMode,
} from "@/lib/data";
import { TIERS, type Entitlements } from "@reef/shared";
import { BillingPanel } from "./billing-panel";
import { DeleteAccount } from "./delete-account";

export const metadata: Metadata = { title: "Account & Billing" };

/** Human label + tone for a subscription-derived status. */
function statusMeta(ent: Entitlements): {
  label: string;
  tone: "healthy" | "caution" | "neutral";
  icon: typeof CheckCircle2;
} {
  if (ent.tier === "free") {
    return { label: "Free plan", tone: "neutral", icon: CheckCircle2 };
  }
  if (ent.active) {
    return { label: "Active", tone: "healthy", icon: CheckCircle2 };
  }
  return { label: "Inactive", tone: "caution", icon: AlertCircle };
}

/** A readable cap value (Infinity → "Unlimited"). */
function capLabel(n: number): string {
  return Number.isFinite(n) ? String(n) : "Unlimited";
}

function initials(name: string, email: string): string {
  const source = name.trim() || email;
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "R";
  const second = parts[1]?.[0] ?? "";
  return (first + second).toUpperCase();
}

export default async function AccountPage() {
  const [user, entitlements] = await Promise.all([
    getSessionUser(),
    getSessionEntitlements(),
  ]);

  const demo = isDemoMode();
  const tier = TIERS[entitlements.tier];
  const status = statusMeta(entitlements);
  const StatusIcon = status.icon;

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <SectionLabel>Account</SectionLabel>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-abyss-50">
          Account &amp; billing
        </h1>
        <p className="text-abyss-200/70">
          Manage your plan, profile, and subscription — all in one place.
        </p>
      </header>

      {demo && (
        <div
          role="note"
          className="flex items-start gap-2.5 rounded-xl border border-lagoon-400/20 bg-lagoon-500/[0.07] px-3.5 py-2.5 text-sm leading-relaxed text-abyss-100/85"
        >
          <Database className="mt-0.5 h-4 w-4 shrink-0 text-lagoon-300" aria-hidden />
          <p>
            You&apos;re exploring in demo mode with a sample{" "}
            <span className="font-medium text-abyss-50">{tier.name}</span> plan.
            Connect Supabase and Stripe to manage a real subscription.
          </p>
        </div>
      )}

      {/* Profile + current plan summary */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profile */}
        <Card>
          <SectionLabel>Profile</SectionLabel>
          <div className="mt-3 flex items-center gap-4">
            <span
              aria-hidden
              className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-lagoon-400 to-abyss-500 font-display text-lg font-semibold text-abyss-950 shadow-glow"
            >
              {initials(user.full_name, user.email)}
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-display text-lg font-semibold text-abyss-50">
                <User className="h-4 w-4 text-lagoon-300" aria-hidden />
                {user.full_name || "Reefer"}
              </p>
              <p className="mt-0.5 flex items-center gap-2 truncate text-sm text-abyss-200/70">
                <Mail className="h-4 w-4 shrink-0 text-lagoon-300" aria-hidden />
                <span className="truncate">{user.email || "No email on file"}</span>
              </p>
            </div>
          </div>

          <hr className="my-5 border-white/5" />

          <form action="/auth/signout" method="post">
            <Button variant="secondary" type="submit" className="w-full sm:w-auto">
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </form>
        </Card>

        {/* Current plan */}
        <Card>
          <SectionLabel>Current plan</SectionLabel>
          <div className="mt-3 flex items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 font-display text-2xl font-semibold text-abyss-50">
                <Crown className="h-5 w-5 text-lagoon-300" aria-hidden />
                {tier.name}
              </p>
              <p className="mt-1 text-sm text-abyss-200/70">{tier.tagline}</p>
            </div>
            <Badge tone={status.tone}>
              <StatusIcon className="h-3.5 w-3.5" /> {status.label}
            </Badge>
          </div>

          <dl className="mt-5 grid grid-cols-3 gap-3 text-center">
            <PlanStat label="Tanks" value={capLabel(entitlements.maxTanks)} />
            <PlanStat
              label="AI chats / mo"
              value={capLabel(entitlements.aiChatsPerMonth)}
            />
            <PlanStat
              label="Diagnoses / mo"
              value={capLabel(entitlements.photoDiagnosesPerMonth)}
            />
          </dl>

          {entitlements.tier !== "premium" && (
            <p className="mt-4 flex items-center gap-1.5 text-xs text-abyss-200/60">
              <Clock className="h-3.5 w-3.5 text-lagoon-300" aria-hidden />
              Choose a plan below to unlock more capability.
            </p>
          )}
        </Card>
      </div>

      {/* Plans + billing actions (client island) */}
      <section aria-labelledby="plans-heading" className="space-y-5">
        <div>
          <h2
            id="plans-heading"
            className="font-display text-xl font-semibold text-abyss-50"
          >
            Plans
          </h2>
          <p className="mt-0.5 text-sm text-abyss-200/70">
            Upgrade, switch, or manage your subscription. Paid plans start with a
            7-day free trial.
          </p>
        </div>

        <BillingPanel currentTier={entitlements.tier} />
      </section>

      {/* Trust footer */}
      <Card className="!bg-white/[0.02]">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-lagoon-500/15 text-lagoon-300">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <p className="font-medium text-abyss-50">
              Your payments are protected
            </p>
            <p className="mt-1 text-sm text-abyss-200/70">
              Checkout and billing run entirely on Stripe&apos;s PCI-compliant
              infrastructure. Card details never touch Reef Doctor&apos;s servers,
              and you can change or cancel your plan any time from the billing
              portal.
            </p>
          </div>
        </div>
      </Card>

      {/* Danger zone — permanent, in-app account deletion (App Store 5.1.1(v)) */}
      <DeleteAccount demo={demo} />
    </div>
  );
}

function PlanStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] px-2 py-3">
      <dt className="text-[0.7rem] font-medium uppercase tracking-wide text-abyss-200/55">
        {label}
      </dt>
      <dd className="mt-1 font-display text-lg font-semibold text-abyss-50">
        {value}
      </dd>
    </div>
  );
}
