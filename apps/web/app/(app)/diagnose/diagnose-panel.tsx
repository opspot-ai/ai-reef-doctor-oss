"use client";

import * as React from "react";
import {
  Fish,
  Sparkles,
  Leaf,
  Upload,
  X,
  AlertTriangle,
  Stethoscope,
  ListChecks,
  Search,
  type LucideIcon,
} from "lucide-react";
import {
  Card,
  SectionLabel,
  Button,
  Badge,
  ConfidenceBadge,
  UrgencyBadge,
  DisclaimerBanner,
  SourceList,
  Spinner,
  EmptyState,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import type { DiagnosisResult } from "@reef/shared";

/* ─────────────────────────── Constants ─────────────────────────── */

type DiagKind = "fish" | "coral" | "algae";

const KINDS: {
  id: DiagKind;
  label: string;
  hint: string;
  icon: LucideIcon;
}[] = [
  {
    id: "fish",
    label: "Fish disease",
    hint: "Spots, lesions, fins, behavior",
    icon: Fish,
  },
  {
    id: "coral",
    label: "Coral health",
    hint: "Bleaching, recession, pests",
    icon: Sparkles,
  },
  {
    id: "algae",
    label: "Algae & pests",
    hint: "Nuisance algae, hitchhikers",
    icon: Leaf,
  },
];

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"] as const;
type MediaType = (typeof ACCEPTED)[number];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const SEVERITY_TONE: Record<
  string,
  "healthy" | "caution" | "danger"
> = {
  low: "healthy",
  moderate: "caution",
  high: "danger",
  critical: "danger",
};

/* ─────────────────────────── Helpers ─────────────────────────── */

interface PickedImage {
  /** Base64 payload without the `data:...;base64,` prefix. */
  base64: string;
  mediaType: MediaType;
  /** Full data URL for previewing. */
  dataUrl: string;
  fileName: string;
}

function readImage(file: File): Promise<PickedImage> {
  return new Promise((resolve, reject) => {
    if (!ACCEPTED.includes(file.type as MediaType)) {
      reject(new Error("Please use a JPEG, PNG, or WebP image."));
      return;
    }
    if (file.size > MAX_BYTES) {
      reject(new Error("That image is over 10 MB — try a smaller photo."));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      const comma = dataUrl.indexOf(",");
      if (comma < 0) {
        reject(new Error("Couldn't read that file."));
        return;
      }
      resolve({
        base64: dataUrl.slice(comma + 1),
        mediaType: file.type as MediaType,
        dataUrl,
        fileName: file.name,
      });
    };
    reader.readAsDataURL(file);
  });
}

/* ─────────────────────────── Component ─────────────────────────── */

type Status = "idle" | "loading" | "done" | "error";

export function DiagnosePanel({
  tankId,
  demo,
}: {
  tankId?: string;
  demo: boolean;
}) {
  const [kind, setKind] = React.useState<DiagKind>("fish");
  const [image, setImage] = React.useState<PickedImage | null>(null);
  const [note, setNote] = React.useState("");
  const [status, setStatus] = React.useState<Status>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [demoNote, setDemoNote] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<DiagnosisResult | null>(null);
  const [dragging, setDragging] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const resultRef = React.useRef<HTMLDivElement>(null);
  const noteId = React.useId();
  const dropId = React.useId();

  async function handleFiles(files: FileList | null) {
    setError(null);
    const file = files?.[0];
    if (!file) return;
    try {
      const picked = await readImage(file);
      setImage(picked);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file.");
    }
  }

  function clearImage() {
    setImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function diagnose() {
    if (!image) {
      setError("Add a photo to diagnose.");
      return;
    }
    setStatus("loading");
    setError(null);
    setDemoNote(null);
    setResult(null);

    try {
      const res = await fetch("/api/ai/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tankId,
          kind,
          imageBase64: image.base64,
          imageMediaType: image.mediaType,
          note: note.trim() || undefined,
        }),
      });

      if (!res.ok) {
        // Demo mode (no Supabase session) returns 401 — surface a friendly note
        // rather than a hard error.
        if (demo || res.status === 401) {
          setDemoNote(
            "Demo mode — connect Supabase and an AI key to run live photo diagnosis.",
          );
          setStatus("idle");
          return;
        }
        if (res.status === 402) {
          setError(
            "You've used your photo diagnosis allowance. Upgrade to keep diagnosing.",
          );
          setStatus("error");
          return;
        }
        setError(
          "We couldn't complete the diagnosis right now. Please try again in a moment.",
        );
        setStatus("error");
        return;
      }

      const data = (await res.json()) as DiagnosisResult;
      setResult(data);
      setStatus("done");
      // Move focus context to results for screen readers / keyboard users.
      requestAnimationFrame(() => {
        resultRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    } catch {
      setError(
        "Something went wrong reaching the diagnosis service. Check your connection and try again.",
      );
      setStatus("error");
    }
  }

  const loading = status === "loading";

  return (
    <div className="space-y-6">
      {/* ── Input card ── */}
      <Card>
        <fieldset disabled={loading} className="space-y-6">
          {/* Kind selector */}
          <div>
            <SectionLabel>What are you diagnosing?</SectionLabel>
            <div
              role="radiogroup"
              aria-label="Diagnosis type"
              className="grid gap-2.5 sm:grid-cols-3"
            >
              {KINDS.map((k) => {
                const Icon = k.icon;
                const selected = kind === k.id;
                return (
                  <button
                    key={k.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setKind(k.id)}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-xl border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-lagoon-400 focus-visible:ring-offset-2 focus-visible:ring-offset-abyss-950",
                      selected
                        ? "border-lagoon-400/40 bg-lagoon-500/15 ring-1 ring-inset ring-lagoon-400/30"
                        : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex items-center gap-2 font-medium",
                        selected ? "text-lagoon-100" : "text-abyss-50",
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                      {k.label}
                    </span>
                    <span className="text-xs text-abyss-200/60">{k.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Image picker */}
          <div>
            <label
              htmlFor={dropId}
              className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-lagoon-300"
            >
              Photo
            </label>

            {image ? (
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-abyss-900/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.dataUrl}
                  alt={`Selected ${
                    KINDS.find((k) => k.id === kind)?.label.toLowerCase() ??
                    "subject"
                  } photo for diagnosis: ${image.fileName}`}
                  className="max-h-80 w-full object-contain"
                />
                <button
                  type="button"
                  onClick={clearImage}
                  aria-label="Remove photo"
                  className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-lg bg-abyss-950/80 px-2.5 py-1.5 text-xs font-medium text-abyss-50 ring-1 ring-inset ring-white/15 backdrop-blur transition hover:bg-abyss-900"
                >
                  <X className="h-3.5 w-3.5" /> Remove
                </button>
              </div>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  void handleFiles(e.dataTransfer.files);
                }}
                className={cn(
                  "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition",
                  dragging
                    ? "border-lagoon-400/60 bg-lagoon-500/10"
                    : "border-white/15 bg-white/[0.02] hover:border-white/25",
                )}
              >
                <span className="mb-3 grid h-12 w-12 place-items-center rounded-xl bg-white/5 text-lagoon-300">
                  <Upload className="h-6 w-6" aria-hidden />
                </span>
                <p className="text-sm font-medium text-abyss-50">
                  Drag &amp; drop a photo here
                </p>
                <p className="mt-1 text-xs text-abyss-200/60">
                  or choose a file — JPEG, PNG, or WebP up to 10 MB
                </p>
                <label className="reef-btn-secondary mt-4 cursor-pointer">
                  <Upload className="h-4 w-4" aria-hidden />
                  Choose photo
                  <input
                    id={dropId}
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED.join(",")}
                    capture="environment"
                    onChange={(e) => void handleFiles(e.target.files)}
                    className="sr-only"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Note */}
          <div>
            <label
              htmlFor={noteId}
              className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-lagoon-300"
            >
              Note <span className="font-normal normal-case">(optional)</span>
            </label>
            <textarea
              id={noteId}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Anything you've noticed — onset, behavior, recent changes, affected livestock…"
              className="reef-input resize-y"
            />
          </div>

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

          {/* Submit */}
          <div className="flex items-center gap-3">
            <Button
              type="button"
              onClick={() => void diagnose()}
              disabled={loading || !image}
            >
              {loading ? (
                <>
                  <Spinner /> Diagnosing…
                </>
              ) : (
                <>
                  <Stethoscope className="h-4 w-4" aria-hidden /> Diagnose
                </>
              )}
            </Button>
            {!image && !loading && (
              <span className="text-xs text-abyss-200/55">
                Add a photo to begin.
              </span>
            )}
          </div>
        </fieldset>
      </Card>

      {/* ── Result region (aria-live for async) ── */}
      <div ref={resultRef} aria-live="polite" aria-busy={loading}>
        {loading && <LoadingResult />}
        {status === "done" && result && <ResultView result={result} />}
      </div>
    </div>
  );
}

/* ─────────────────────────── Loading skeleton ─────────────────────────── */

function LoadingResult() {
  return (
    <Card>
      <div className="flex items-center gap-3 text-sm text-abyss-100/80">
        <Spinner />
        <span>
          Reading the photo and cross-checking the reef knowledge base…
        </span>
      </div>
      <div className="mt-5 space-y-3" aria-hidden>
        <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
        <div className="h-4 w-full animate-pulse rounded bg-white/10" />
        <div className="h-24 w-full animate-pulse rounded-xl bg-white/[0.06]" />
        <div className="h-24 w-full animate-pulse rounded-xl bg-white/[0.06]" />
      </div>
    </Card>
  );
}

/* ─────────────────────────── Result view ─────────────────────────── */

function ResultView({ result }: { result: DiagnosisResult }) {
  const conditions = result.conditions ?? [];
  const hasConditions = conditions.length > 0;

  // Tasteful entrance: fade + lift in on mount via a CSS transition.
  const [shown, setShown] = React.useState(false);
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <Card
      className={cn(
        "space-y-6 transition-all duration-500 ease-out motion-reduce:transition-none",
        shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
      )}
    >
      {/* Header: urgency + summary */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <SectionLabel>Diagnosis</SectionLabel>
          <div className="ml-auto">
            <UrgencyBadge urgency={result.urgency} />
          </div>
        </div>
        <p className="text-base leading-relaxed text-abyss-50">
          {result.summary}
        </p>
      </div>

      {/* Dose warnings */}
      {result.doseWarnings && result.doseWarnings.length > 0 && (
        <div
          role="note"
          className="rounded-xl border border-coral-400/30 bg-coral-500/10 px-4 py-3"
        >
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-coral-200">
            <AlertTriangle className="h-4 w-4" aria-hidden /> Dosing cautions
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-coral-100/90">
            {result.doseWarnings.map((w, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className="text-coral-300">
                  •
                </span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Conditions */}
      {hasConditions ? (
        <div className="space-y-3">
          <h3 className="font-display text-lg font-semibold text-abyss-50">
            Likely conditions
          </h3>
          <ol className="space-y-3">
            {conditions.map((c, i) => (
              <li key={`${c.name}-${i}`}>
                <ConditionCard rank={i + 1} condition={c} />
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <EmptyState
          icon={Search}
          title="Couldn't confidently identify a condition"
          description="The model didn't find a clear match. Try a sharper, well-lit, close-up photo, add a descriptive note, or ask the Reef Doctor chat for help."
        />
      )}

      {/* Trust signals */}
      <SourceList sources={result.sources ?? []} />
      <DisclaimerBanner text={result.disclaimer} />
    </Card>
  );
}

function ConditionCard({
  rank,
  condition,
}: {
  rank: number;
  condition: DiagnosisResult["conditions"][number];
}) {
  const tone = SEVERITY_TONE[condition.severity] ?? "caution";
  const evidence = condition.evidence ?? [];
  const steps = condition.recommendedSteps ?? [];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-semibold text-abyss-100">
          {rank}
        </span>
        <h4 className="font-display text-base font-semibold text-abyss-50">
          {condition.name}
        </h4>
        <Badge tone={tone} className="capitalize">
          {condition.severity}
        </Badge>
        <div className="ml-auto">
          <ConfidenceBadge confidence={condition.confidence} />
        </div>
      </div>

      {evidence.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-abyss-200/55">
            Evidence
          </p>
          <ul className="mt-1.5 space-y-1 text-sm text-abyss-100/85">
            {evidence.map((e, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className="text-lagoon-300">
                  •
                </span>
                <span>{e}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {steps.length > 0 && (
        <div className="mt-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-abyss-200/55">
            <ListChecks className="h-3.5 w-3.5 text-lagoon-300" aria-hidden />
            Recommended steps
          </p>
          <ol className="mt-1.5 space-y-1 text-sm text-abyss-100/85">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span
                  aria-hidden
                  className="font-medium text-lagoon-300 tabular-nums"
                >
                  {i + 1}.
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
