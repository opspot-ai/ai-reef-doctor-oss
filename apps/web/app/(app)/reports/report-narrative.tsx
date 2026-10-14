"use client";

import * as React from "react";
import {
  Sparkles,
  AlertTriangle,
  ListChecks,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import {
  Card,
  SectionLabel,
  Button,
  Badge,
  DisclaimerBanner,
  SourceList,
  Spinner,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import type { ParamAnalysis, ParameterReading } from "@reef/shared";

/**
 * Client piece for the weekly report: a "Generate AI narrative" button that
 * POSTs the tank's parameter history to /api/ai/analyze-params and renders the
 * returned ParamAnalysis (summary, findings, recommendations, sources,
 * disclaimer). The deterministic report rendered by the server is always there;
 * this is the optional, AI-authored layer with full error/fallback handling.
 */

type Status = "idle" | "loading" | "done" | "error";

const STATUS_TONE: Record<string, "healthy" | "caution" | "danger" | "neutral"> =
  {
    ok: "healthy",
    low: "caution",
    high: "caution",
    critical: "danger",
    unknown: "neutral",
  };

const STATUS_LABEL: Record<string, string> = {
  ok: "In range",
  low: "Low",
  high: "High",
  critical: "Critical",
  unknown: "—",
};

export function ReportNarrative({
  tankId,
  tankType,
  parameters,
  demo,
}: {
  tankId: string;
  tankType: string;
  /** Parameter history (oldest → newest) used as the model's evidence base. */
  parameters: ParameterReading[];
  demo: boolean;
}) {
  const [status, setStatus] = React.useState<Status>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [demoNote, setDemoNote] = React.useState<string | null>(null);
  const [analysis, setAnalysis] = React.useState<ParamAnalysis | null>(null);
  const resultRef = React.useRef<HTMLDivElement>(null);

  const hasData = parameters.length > 0;
  const loading = status === "loading";

  async function generate() {
    if (!hasData) {
      setError("Log at least one water test before generating a narrative.");
      setStatus("error");
      return;
    }
    setStatus("loading");
    setError(null);
    setDemoNote(null);
    setAnalysis(null);

    try {
      const res = await fetch("/api/ai/analyze-params", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tankId, tankType, parameters }),
      });

      if (!res.ok) {
        // Demo mode (no Supabase session) returns 401 — surface a friendly note
        // rather than a hard error so the deterministic report stays useful.
        if (demo || res.status === 401) {
          setDemoNote(
            "Demo mode — connect Supabase and an AI key to generate a written report.",
          );
          setStatus("idle");
          return;
        }
        if (res.status === 402) {
          setError(
            "AI reports are a Reef Keeper feature. Upgrade to generate written analysis.",
          );
          setStatus("error");
          return;
        }
        if (res.status === 503) {
          setError(
            "The AI service isn't configured right now. Your deterministic report above is still accurate.",
          );
          setStatus("error");
          return;
        }
        setError(
          "We couldn't generate the narrative just now. Please try again in a moment.",
        );
        setStatus("error");
        return;
      }

      const data = (await res.json()) as ParamAnalysis;
      setAnalysis(data);
      setStatus("done");
      requestAnimationFrame(() => {
        resultRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      });
    } catch {
      setError(
        "Something went wrong reaching the analysis service. Check your connection and try again.",
      );
      setStatus("error");
    }
  }

  return (
    <section aria-labelledby="ai-narrative-heading" className="space-y-4">
      <Card className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <SectionLabel>AI narrative</SectionLabel>
            <h2
              id="ai-narrative-heading"
              className="font-display text-xl font-semibold text-abyss-50"
            >
              Written health analysis
            </h2>
            <p className="mt-1 max-w-prose text-sm text-abyss-200/70">
              Generate an AI-authored read of your recent trends, grounded in the
              reef knowledge base. It complements — and never overrides — the
              deterministic summary above.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => void generate()}
            disabled={loading || !hasData}
            className="shrink-0"
          >
            {loading ? (
              <>
                <Spinner /> Analyzing…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" aria-hidden />
                {status === "done" ? "Regenerate" : "Generate AI narrative"}
              </>
            )}
          </Button>
        </div>

        {!hasData && (
          <p className="text-sm text-abyss-200/55">
            Log a water test to enable the written analysis.
          </p>
        )}

        {/* Inline messages */}
        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-coral-400/30 bg-coral-500/10 px-3.5 py-2.5 text-sm text-coral-100"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-coral-300" />
            {error}
          </p>
        )}
        {demoNote && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3.5 py-2.5 text-sm text-amber-100"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            {demoNote}
          </p>
        )}

        {/* Result region (aria-live for async) */}
        <div ref={resultRef} aria-live="polite" aria-busy={loading}>
          {loading && <NarrativeSkeleton />}
          {status === "done" && analysis && <AnalysisView analysis={analysis} />}
        </div>
      </Card>
    </section>
  );
}

/* ─────────────────────────── Loading skeleton ─────────────────────────── */

function NarrativeSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-sm text-abyss-100/80">
        <Spinner />
        <span>Reading your trends and cross-checking the knowledge base…</span>
      </div>
      <div className="space-y-3" aria-hidden>
        <div className="h-4 w-3/4 animate-pulse rounded bg-white/10" />
        <div className="h-4 w-full animate-pulse rounded bg-white/10" />
        <div className="h-20 w-full animate-pulse rounded-xl bg-white/[0.06]" />
        <div className="h-20 w-full animate-pulse rounded-xl bg-white/[0.06]" />
      </div>
    </div>
  );
}

/* ─────────────────────────── Analysis view ─────────────────────────── */

function AnalysisView({ analysis }: { analysis: ParamAnalysis }) {
  const findings = analysis.findings ?? [];
  const recommendations = analysis.recommendations ?? [];

  // Tasteful entrance: fade + lift on mount.
  const [shown, setShown] = React.useState(false);
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      className={cn(
        "space-y-6 transition-all duration-500 ease-out motion-reduce:transition-none",
        shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
      )}
    >
      <p className="text-base leading-relaxed text-abyss-50">
        {analysis.summary}
      </p>

      {findings.length > 0 && (
        <div className="space-y-2">
          <SectionLabel>Findings</SectionLabel>
          <ul className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/5">
            {findings.map((f, i) => (
              <li
                key={`${f.parameter}-${i}`}
                className="flex items-start justify-between gap-3 bg-white/[0.02] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium capitalize text-abyss-50">
                    {f.parameter}
                  </p>
                  <p className="mt-0.5 text-sm text-abyss-100/80">{f.message}</p>
                </div>
                <Badge
                  tone={STATUS_TONE[f.status] ?? "neutral"}
                  className="mt-0.5 shrink-0"
                >
                  {STATUS_LABEL[f.status] ?? f.status}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

      {recommendations.length > 0 && (
        <Recommendations
          title="AI recommendations"
          icon={ListChecks}
          items={recommendations}
        />
      )}

      <SourceList sources={analysis.sources ?? []} />
      <DisclaimerBanner text={analysis.disclaimer} />
    </div>
  );
}

/* ─────────────────────────── Recommendations list ─────────────────────────── */

export function Recommendations({
  title,
  icon: Icon = CheckCircle2,
  items,
}: {
  title: string;
  icon?: LucideIcon;
  items: string[];
}) {
  if (!items.length) return null;
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-abyss-200/55">
        <Icon className="h-3.5 w-3.5 text-lagoon-300" aria-hidden />
        {title}
      </p>
      <ol className="mt-2 space-y-2">
        {items.map((r, i) => (
          <li
            key={i}
            className="flex gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-sm text-abyss-100/90"
          >
            <span
              aria-hidden
              className="font-display font-semibold tabular-nums text-lagoon-300"
            >
              {i + 1}.
            </span>
            <span>{r}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
