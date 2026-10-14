import * as React from "react";
import { Camera, Fish, Leaf, Sparkles, History } from "lucide-react";
import {
  getActiveTank,
  listDiagnoses,
  isDemoMode,
} from "@/lib/data";
import {
  Card,
  SectionLabel,
  DisclaimerBanner,
  UrgencyBadge,
  EmptyState,
  Badge,
} from "@/components/ui";
import { DiagnosePanel } from "./diagnose-panel";

export const metadata = {
  title: "Photo Diagnosis · Reef Doctor",
  description:
    "AI-assisted visual triage for fish disease, coral health, and algae or pests.",
};

const KIND_META: Record<
  string,
  { label: string; icon: typeof Fish }
> = {
  fish: { label: "Fish disease", icon: Fish },
  coral: { label: "Coral health", icon: Sparkles },
  algae: { label: "Algae & pests", icon: Leaf },
  params: { label: "Parameters", icon: Sparkles },
  symptom: { label: "Symptom", icon: Fish },
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default async function DiagnosePage({
  searchParams,
}: {
  searchParams: Promise<{ tank?: string }>;
}) {
  const { tank: tankParam } = await searchParams;
  const tank = await getActiveTank(tankParam);
  const demo = isDemoMode();
  const recent = await listDiagnoses(tank?.id);

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="space-y-3">
        <SectionLabel>Photo Diagnosis</SectionLabel>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-abyss-50 sm:text-4xl">
            Visual triage for your reef
          </h1>
          {tank && (
            <Badge tone="brand">
              <Camera className="h-3.5 w-3.5" /> {tank.name}
            </Badge>
          )}
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-abyss-200/75">
          Upload a clear photo and our reef-trained model will rank likely
          conditions with confidence, evidence, and next steps. Results are only
          as good as the image — sharp focus, even lighting, and a close,
          steady shot make a real difference.
        </p>
        <DisclaimerBanner />
        <p className="text-xs leading-relaxed text-abyss-200/55">
          Photo diagnosis depends on image quality. Blurry, dim, or distant
          photos lower confidence and may miss subtle signs. When in doubt,
          consult an aquatic veterinarian or experienced reefer.
        </p>
      </header>

      {/* Main grid: panel + recent */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <DiagnosePanel tankId={tank?.id} demo={demo} />

        {/* Recent diagnoses */}
        <aside className="space-y-4" aria-label="Recent diagnoses">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-lagoon-300" aria-hidden />
            <h2 className="font-display text-lg font-semibold text-abyss-50">
              Recent
            </h2>
          </div>

          {recent.length === 0 ? (
            <EmptyState
              icon={Camera}
              title="No diagnoses yet"
              description="Your past photo diagnoses for this tank will appear here."
            />
          ) : (
            <ul className="space-y-3">
              {recent.map((d) => {
                const meta = KIND_META[d.kind] ?? KIND_META.fish!;
                const Icon = meta.icon;
                return (
                  <li key={d.id}>
                    <Card className="!p-4">
                      <div className="flex items-start justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-abyss-200/60">
                          <Icon className="h-3.5 w-3.5 text-lagoon-300" />
                          {meta.label}
                        </span>
                        <UrgencyBadge urgency={d.urgency} />
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-abyss-100/85">
                        {d.summary}
                      </p>
                      <p className="mt-2 text-xs text-abyss-200/50">
                        {formatDate(d.created_at)}
                      </p>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
