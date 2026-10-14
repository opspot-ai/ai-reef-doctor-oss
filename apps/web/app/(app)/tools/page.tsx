import * as React from "react";
import Link from "next/link";
import {
  Calculator,
  Stethoscope,
  Users,
  BookOpen,
  Droplets,
  Sprout,
  Lock,
  ArrowRight,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { getSessionEntitlements, getActiveTank } from "@/lib/data";
import { canUse, type Capability, type Entitlements } from "@reef/shared";
import {
  SectionLabel,
  Badge,
  DisclaimerBanner,
} from "@/components/ui";
import { Reveal } from "@/components/reveal";
import { cn } from "@/lib/cn";

export const metadata = {
  title: "Tools · Reef Doctor",
  description:
    "Deterministic reef-keeping tools: dosing calculator, symptom checker, compatibility, species encyclopedia, acclimation, and algae remediation.",
};

interface ToolDef {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Capability that gates this tool, if any. Undefined → always available. */
  capability?: Capability;
  /** Accent used for the icon tile. */
  accent: "lagoon" | "coral" | "abyss";
}

const TOOLS: ToolDef[] = [
  {
    href: "/tools/dosing",
    label: "Dosing calculator",
    description:
      "Compute supplement volumes for alkalinity, calcium, magnesium, and copper — with built-in safe-rate clamping.",
    icon: Calculator,
    capability: "dosingCalculators",
    accent: "coral",
  },
  {
    href: "/tools/symptom-checker",
    label: "Symptom checker",
    description:
      "Answer a few guided questions to get a ranked shortlist of likely conditions, grounded in our reef knowledge base.",
    icon: Stethoscope,
    capability: "symptomChecker",
    accent: "coral",
  },
  {
    href: "/tools/compatibility",
    label: "Compatibility checker",
    description:
      "Check temperament, stocking order, and tank-mate conflicts before you add new livestock.",
    icon: Users,
    accent: "lagoon",
  },
  {
    href: "/tools/encyclopedia",
    label: "Species encyclopedia",
    description:
      "Browse care notes, target parameters, and husbandry tips for fish, corals, and inverts.",
    icon: BookOpen,
    accent: "lagoon",
  },
  {
    href: "/tools/acclimation",
    label: "Acclimation guide",
    description:
      "Step-by-step drip and temperature acclimation so new arrivals settle in without shock.",
    icon: Droplets,
    accent: "lagoon",
  },
  {
    href: "/tools/algae",
    label: "Algae remediation",
    description:
      "Identify nuisance algae and pests, then follow a practical, reef-safe plan to beat them back.",
    icon: Sprout,
    accent: "lagoon",
  },
];

const ACCENT_TILE: Record<ToolDef["accent"], string> = {
  lagoon: "bg-lagoon-500/15 text-lagoon-200 ring-lagoon-400/25",
  coral: "bg-coral-500/15 text-coral-200 ring-coral-400/25",
  abyss: "bg-abyss-400/15 text-abyss-100 ring-abyss-300/25",
};

export default async function ToolsPage({
  searchParams,
}: {
  searchParams: Promise<{ tank?: string }>;
}) {
  const { tank: tankParam } = await searchParams;
  const [entitlements, tank] = await Promise.all([
    getSessionEntitlements(),
    getActiveTank(tankParam),
  ]);

  const withTank = (href: string) =>
    tank ? `${href}?tank=${tank.id}` : href;

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="space-y-3">
        <SectionLabel>Tools</SectionLabel>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-abyss-50 sm:text-4xl">
            Reef-keeping toolkit
          </h1>
          {tank && (
            <Badge tone="brand">
              <Wrench className="h-3.5 w-3.5" /> {tank.name}
            </Badge>
          )}
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-abyss-200/75">
          Practical, dependable calculators and reference guides. Each one runs
          on curated reef knowledge and clamped math — no guesswork, and no AI
          required to get an answer.
        </p>
      </header>

      {/* Tool grid */}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool, i) => (
          <ToolCard
            key={tool.href}
            tool={tool}
            href={withTank(tool.href)}
            entitlements={entitlements}
            index={i}
          />
        ))}
      </ul>

      <DisclaimerBanner text="These tools provide educational reef-keeping guidance, not veterinary advice. Dosing figures are estimates — always verify against your product's instructions before treating, and consult a professional for declining or valuable livestock." />
    </div>
  );
}

function ToolCard({
  tool,
  href,
  entitlements,
  index,
}: {
  tool: ToolDef;
  href: string;
  entitlements: Entitlements;
  index: number;
}) {
  const Icon = tool.icon;
  const locked = tool.capability
    ? !canUse(entitlements, tool.capability)
    : false;

  return (
    <Reveal as="li" delay={index * 60} className="h-full">
      <Link
        href={href}
        aria-label={
          locked
            ? `${tool.label} — upgrade required`
            : tool.label
        }
        className={cn(
          "group relative flex h-full flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-reef backdrop-blur transition",
          "hover:-translate-y-0.5 hover:border-lagoon-400/30 hover:bg-white/[0.06]",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-lagoon-400 focus-visible:ring-offset-2 focus-visible:ring-offset-abyss-950",
          "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <span
            className={cn(
              "grid h-11 w-11 place-items-center rounded-xl ring-1 ring-inset",
              ACCENT_TILE[tool.accent],
            )}
          >
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          {locked ? (
            <Badge tone="caution">
              <Lock className="h-3 w-3" aria-hidden /> Pro
            </Badge>
          ) : (
            <ArrowRight
              className="h-4 w-4 translate-x-0 text-abyss-200/40 transition group-hover:translate-x-1 group-hover:text-lagoon-300 motion-reduce:transition-none"
              aria-hidden
            />
          )}
        </div>
        <h2 className="font-display text-lg font-semibold text-abyss-50">
          {tool.label}
        </h2>
        <p className="text-sm leading-relaxed text-abyss-200/70">
          {tool.description}
        </p>
        {locked && (
          <p className="mt-auto pt-1 text-xs font-medium text-amber-200/80">
            Included with Reef Keeper — upgrade to unlock.
          </p>
        )}
      </Link>
    </Reveal>
  );
}
