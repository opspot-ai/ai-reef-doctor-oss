"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { logParameters } from "@/lib/data/actions";
import type { ParamKey, ParameterReading } from "@reef/shared";
import { Card, SectionLabel, Button, Spinner } from "@/components/ui";

/**
 * Log a new water-parameter reading. Every measure is optional (you log what you
 * tested). Demo-aware: in demo mode the action returns { demo:true } and we show
 * a friendly inline note instead of a hard error.
 */

interface Field {
  key: ParamKey | "measured_at";
  label: string;
  unit?: string;
  step?: string;
  placeholder?: string;
}

const FIELDS: Field[] = [
  { key: "alkalinity_dkh", label: "Alkalinity", unit: "dKH", step: "0.1", placeholder: "8.5" },
  { key: "calcium_ppm", label: "Calcium", unit: "ppm", step: "1", placeholder: "425" },
  { key: "magnesium_ppm", label: "Magnesium", unit: "ppm", step: "1", placeholder: "1350" },
  { key: "salinity_sg", label: "Salinity", unit: "SG", step: "0.0001", placeholder: "1.0255" },
  { key: "temp_c", label: "Temperature", unit: "°C", step: "0.1", placeholder: "25.5" },
  { key: "ph", label: "pH", step: "0.01", placeholder: "8.2" },
  { key: "ammonia_ppm", label: "Ammonia", unit: "ppm", step: "0.01", placeholder: "0" },
  { key: "nitrite_ppm", label: "Nitrite", unit: "ppm", step: "0.01", placeholder: "0" },
  { key: "nitrate_ppm", label: "Nitrate", unit: "ppm", step: "0.1", placeholder: "5" },
  { key: "phosphate_ppm", label: "Phosphate", unit: "ppm", step: "0.001", placeholder: "0.05" },
  { key: "orp_mv", label: "ORP", unit: "mV", step: "1", placeholder: "375" },
];

const INT_KEYS = new Set<string>(["calcium_ppm", "magnesium_ppm", "orp_mv"]);

type Feedback =
  | { kind: "success"; message: string }
  | { kind: "demo"; message: string }
  | { kind: "error"; message: string }
  | null;

function defaultLocalDateTime(): string {
  // datetime-local wants `YYYY-MM-DDTHH:mm` in local time.
  const now = new Date();
  const off = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - off).toISOString().slice(0, 16);
}

export function LogParametersForm({ tankId }: { tankId: string }) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [pending, setPending] = React.useState(false);
  const [feedback, setFeedback] = React.useState<Feedback>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);
    const form = e.currentTarget;
    const data = new FormData(form);

    const reading: ParameterReading = { source: "manual" };
    let anyValue = false;

    for (const field of FIELDS) {
      const raw = String(data.get(field.key) ?? "").trim();
      if (raw === "") continue;
      const num = Number(raw);
      if (Number.isNaN(num)) continue;
      reading[field.key as ParamKey] = INT_KEYS.has(field.key)
        ? Math.round(num)
        : num;
      anyValue = true;
    }

    if (!anyValue) {
      setFeedback({
        kind: "error",
        message: "Enter at least one reading before saving.",
      });
      return;
    }

    const measuredAt = String(data.get("measured_at") ?? "").trim();
    if (measuredAt) reading.measured_at = new Date(measuredAt).toISOString();

    setPending(true);
    try {
      const res = await logParameters(tankId, reading);
      if (res.ok) {
        setFeedback({ kind: "success", message: "Reading saved." });
        form.reset();
        router.refresh();
      } else if (res.demo) {
        setFeedback({
          kind: "demo",
          message: "Demo mode — connect Supabase to save your readings.",
        });
      } else {
        setFeedback({ kind: "error", message: res.error });
      }
    } catch {
      setFeedback({
        kind: "error",
        message: "Something went wrong saving your reading. Please try again.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <SectionLabel>Log a reading</SectionLabel>
      <p className="mb-4 text-sm text-abyss-200/70">
        Record what you tested today. Every field is optional — just fill in the
        ones you measured.
      </p>

      <form ref={formRef} onSubmit={onSubmit} noValidate>
        <div className="mb-4">
          <label
            htmlFor="measured_at"
            className="mb-1.5 block text-xs font-medium text-abyss-100/80"
          >
            Measured at
          </label>
          <input
            id="measured_at"
            name="measured_at"
            type="datetime-local"
            defaultValue={defaultLocalDateTime()}
            className="reef-input"
          />
        </div>

        <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <legend className="sr-only">Water parameters</legend>
          {FIELDS.map((f) => {
            const id = `param-${f.key}`;
            return (
              <div key={f.key}>
                <label
                  htmlFor={id}
                  className="mb-1.5 block text-xs font-medium text-abyss-100/80"
                >
                  {f.label}
                  {f.unit ? (
                    <span className="text-abyss-200/50"> ({f.unit})</span>
                  ) : null}
                </label>
                <input
                  id={id}
                  name={f.key}
                  type="number"
                  inputMode="decimal"
                  step={f.step}
                  min="0"
                  placeholder={f.placeholder}
                  className="reef-input px-3 py-2 text-sm"
                />
              </div>
            );
          })}
        </fieldset>

        <div className="mt-5 flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? (
              <>
                <Spinner /> Saving…
              </>
            ) : (
              "Save reading"
            )}
          </Button>
          <span aria-live="polite" className="text-sm">
            {feedback?.kind === "success" && (
              <span className="inline-flex items-center gap-1.5 text-lagoon-300">
                <CheckCircle2 className="h-4 w-4" /> {feedback.message}
              </span>
            )}
            {feedback?.kind === "demo" && (
              <span className="inline-flex items-center gap-1.5 text-amber-300">
                <Info className="h-4 w-4" /> {feedback.message}
              </span>
            )}
            {feedback?.kind === "error" && (
              <span className="inline-flex items-center gap-1.5 text-coral-300">
                <AlertTriangle className="h-4 w-4" /> {feedback.message}
              </span>
            )}
          </span>
        </div>
      </form>
    </Card>
  );
}
