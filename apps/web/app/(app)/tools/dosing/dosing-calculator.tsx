"use client";

import * as React from "react";
import {
  FlaskConical,
  Beaker,
  Magnet,
  ShieldAlert,
  AlertTriangle,
  Calculator,
  CalendarDays,
  Droplet,
  type LucideIcon,
} from "lucide-react";
import {
  Card,
  SectionLabel,
  Button,
  Badge,
  DisclaimerBanner,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  doseAlk,
  doseCalcium,
  doseMagnesium,
  copperDose,
  COPPER_RANGES,
  TARGET_RANGES,
  DOSE_WARNING,
  type DoseResult,
  type TankType,
} from "@reef/shared";

/* ─────────────────────────── parameter catalog ─────────────────────────── */

type ParamId = "alkalinity" | "calcium" | "magnesium" | "copper";

interface ParamDef {
  id: ParamId;
  label: string;
  unit: string;
  icon: LucideIcon;
  hint: string;
  /** Sensible reef target used to prefill the target field. */
  defaultTarget: number;
  /** Reasonable starting current value for the field. */
  defaultCurrent: number;
  /** Step for the number inputs. */
  step: number;
  /** Whether this is a treatment (copper) — gets extra emphasis. */
  treatment?: boolean;
}

const PARAMS: ParamDef[] = [
  {
    id: "alkalinity",
    label: "Alkalinity",
    unit: "dKH",
    icon: FlaskConical,
    hint: "Carbonate buffer (2-part)",
    defaultTarget: 8.5,
    defaultCurrent: 7,
    step: 0.1,
  },
  {
    id: "calcium",
    label: "Calcium",
    unit: "ppm",
    icon: Beaker,
    hint: "Ca (2-part)",
    defaultTarget: 425,
    defaultCurrent: 380,
    step: 5,
  },
  {
    id: "magnesium",
    label: "Magnesium",
    unit: "ppm",
    icon: Magnet,
    hint: "Mg supplement",
    defaultTarget: 1350,
    defaultCurrent: 1250,
    step: 10,
  },
  {
    id: "copper",
    label: "Copper",
    unit: "ppm",
    icon: ShieldAlert,
    hint: "Quarantine treatment",
    defaultTarget: 0.2,
    defaultCurrent: 0,
    step: 0.01,
    treatment: true,
  },
];

type CopperType = "ionic" | "chelated";

/* ─────────────────────────── helpers ─────────────────────────── */

/** Parse a number input that may be empty; returns NaN for blank/invalid. */
function num(v: string): number {
  if (v.trim() === "") return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function paramTargetHint(tankType: TankType | undefined): string | null {
  if (!tankType) return null;
  const alk = TARGET_RANGES[tankType]?.alkalinity_dkh;
  if (!alk) return null;
  return `${tankType.toUpperCase()} alkalinity target ≈ ${alk.min}–${alk.max} dKH`;
}

/* ─────────────────────────── component ─────────────────────────── */

export function DosingCalculator({
  defaultVolume,
  tankType,
  tankName,
}: {
  defaultVolume?: number;
  tankType?: TankType;
  tankName?: string;
}) {
  const [paramId, setParamId] = React.useState<ParamId>("alkalinity");
  const param = PARAMS.find((p) => p.id === paramId)!;

  const [volume, setVolume] = React.useState<string>(
    defaultVolume ? String(defaultVolume) : "",
  );
  const [current, setCurrent] = React.useState<string>(
    String(param.defaultCurrent),
  );
  const [target, setTarget] = React.useState<string>(
    String(param.defaultTarget),
  );
  const [copperType, setCopperType] = React.useState<CopperType>("ionic");
  /** Copper product strength (ppm rise per mL per L). Defaults left blank so the
   * user enters their product's value; treated as a required field for copper. */
  const [copperStrength, setCopperStrength] = React.useState<string>("");

  const [result, setResult] = React.useState<DoseResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const volumeId = React.useId();
  const currentId = React.useId();
  const targetId = React.useId();
  const strengthId = React.useId();
  const resultRef = React.useRef<HTMLDivElement>(null);

  // When the parameter changes, reset the per-parameter fields to sane defaults
  // and clear any stale result so we never show a copper dose under "alkalinity".
  function selectParam(p: ParamDef) {
    setParamId(p.id);
    setCurrent(String(p.defaultCurrent));
    setTarget(String(p.defaultTarget));
    setResult(null);
    setError(null);
  }

  function compute() {
    setError(null);
    setResult(null);

    const v = num(volume);
    const c = num(current);
    const t = num(target);

    if (!Number.isFinite(v) || v <= 0) {
      setError("Enter a tank volume in litres greater than zero.");
      return;
    }
    if (!Number.isFinite(c) || c < 0) {
      setError("Enter a valid current value.");
      return;
    }
    if (!Number.isFinite(t) || t < 0) {
      setError("Enter a valid target value.");
      return;
    }

    let res: DoseResult;
    if (paramId === "alkalinity") {
      res = doseAlk({ volumeLiters: v, currentDkh: c, targetDkh: t });
    } else if (paramId === "calcium") {
      res = doseCalcium({ volumeLiters: v, currentPpm: c, targetPpm: t });
    } else if (paramId === "magnesium") {
      res = doseMagnesium({ volumeLiters: v, currentPpm: c, targetPpm: t });
    } else {
      const strength = num(copperStrength);
      if (!Number.isFinite(strength) || strength <= 0) {
        setError(
          "Enter your copper product's strength (ppm rise per mL per L) from its label — copper is dosed too precisely to estimate.",
        );
        return;
      }
      res = copperDose({
        volumeLiters: v,
        currentPpm: c,
        targetPpm: t,
        type: copperType,
        productPpmPerMlPerL: strength,
      });
    }

    setResult(res);
    requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  const alkHint = paramTargetHint(tankType);
  const copperRange = COPPER_RANGES[copperType];

  return (
    <div className="space-y-6">
      <Card className="space-y-6">
        {/* Parameter selector */}
        <div>
          <SectionLabel>What are you dosing?</SectionLabel>
          <div
            role="radiogroup"
            aria-label="Parameter to dose"
            className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4"
          >
            {PARAMS.map((p) => {
              const Icon = p.icon;
              const selected = paramId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => selectParam(p)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-xl border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-lagoon-400 focus-visible:ring-offset-2 focus-visible:ring-offset-abyss-950",
                    selected
                      ? p.treatment
                        ? "border-coral-400/50 bg-coral-500/15 ring-1 ring-inset ring-coral-400/30"
                        : "border-lagoon-400/40 bg-lagoon-500/15 ring-1 ring-inset ring-lagoon-400/30"
                      : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex items-center gap-2 font-medium",
                      selected
                        ? p.treatment
                          ? "text-coral-100"
                          : "text-lagoon-100"
                        : "text-abyss-50",
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {p.label}
                  </span>
                  <span className="text-xs text-abyss-200/60">{p.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Copper warning banner — shown up front before any numbers */}
        {param.treatment && (
          <div
            role="note"
            className="flex items-start gap-2.5 rounded-xl border border-coral-400/40 bg-coral-500/10 px-4 py-3 text-sm text-coral-100/90"
          >
            <ShieldAlert
              className="mt-0.5 h-5 w-5 shrink-0 text-coral-300"
              aria-hidden
            />
            <p>
              <strong className="font-semibold text-coral-100">
                Copper is a quarantine-only treatment.
              </strong>{" "}
              Never use it in a display or reef tank — it kills inverts and
              corals. Ramp up slowly over 3–5 days and test daily with a quality
              copper kit.
            </p>
          </div>
        )}

        {/* Inputs */}
        <fieldset className="grid gap-4 sm:grid-cols-3">
          <legend className="sr-only">Dosing inputs</legend>

          <Field
            id={volumeId}
            label="Tank volume"
            suffix="L"
            value={volume}
            onChange={setVolume}
            step={1}
            min={0}
            placeholder="e.g. 200"
            help={
              defaultVolume
                ? `Prefilled from ${tankName ?? "your tank"}`
                : "Net water volume"
            }
          />
          <Field
            id={currentId}
            label="Current"
            suffix={param.unit}
            value={current}
            onChange={setCurrent}
            step={param.step}
            min={0}
            placeholder="Measured now"
          />
          <Field
            id={targetId}
            label="Target"
            suffix={param.unit}
            value={target}
            onChange={setTarget}
            step={param.step}
            min={0}
            placeholder="Goal"
            help={
              paramId === "alkalinity" && alkHint
                ? alkHint
                : param.treatment
                  ? `Therapeutic ${copperType}: ${copperRange.min}–${copperRange.max} ppm`
                  : undefined
            }
          />
        </fieldset>

        {/* Copper-specific controls */}
        {param.treatment && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <SectionLabel>Copper product type</SectionLabel>
              <div
                role="radiogroup"
                aria-label="Copper product type"
                className="grid grid-cols-2 gap-2.5"
              >
                {(["ionic", "chelated"] as CopperType[]).map((ct) => {
                  const selected = copperType === ct;
                  const r = COPPER_RANGES[ct];
                  return (
                    <button
                      key={ct}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setCopperType(ct)}
                      className={cn(
                        "rounded-xl border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-lagoon-400 focus-visible:ring-offset-2 focus-visible:ring-offset-abyss-950",
                        selected
                          ? "border-coral-400/50 bg-coral-500/15 ring-1 ring-inset ring-coral-400/30"
                          : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]",
                      )}
                    >
                      <span
                        className={cn(
                          "block font-medium capitalize",
                          selected ? "text-coral-100" : "text-abyss-50",
                        )}
                      >
                        {ct}
                      </span>
                      <span className="text-xs text-abyss-200/60">
                        {ct === "ionic"
                          ? "e.g. Cupramine"
                          : "e.g. Copper Power"}{" "}
                        · {r.min}–{r.max} ppm
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <Field
              id={strengthId}
              label="Product strength"
              suffix="ppm / mL / L"
              value={copperStrength}
              onChange={setCopperStrength}
              step={0.001}
              min={0}
              placeholder="From product label"
              help="How much copper 1 mL adds to 1 L (required)"
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-coral-400/30 bg-coral-500/10 px-3.5 py-2.5 text-sm text-coral-100"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-coral-300" />
            {error}
          </p>
        )}

        {/* Submit */}
        <div>
          <Button type="button" onClick={compute}>
            <Calculator className="h-4 w-4" aria-hidden /> Calculate dose
          </Button>
        </div>
      </Card>

      {/* Result (aria-live for the computed dose) */}
      <div ref={resultRef} aria-live="polite">
        {result && (
          <ResultView
            result={result}
            unit={param.unit}
            treatment={Boolean(param.treatment)}
          />
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── result ─────────────────────────── */

function ResultView({
  result,
  unit,
  treatment,
}: {
  result: DoseResult;
  unit: string;
  treatment: boolean;
}) {
  const [shown, setShown] = React.useState(false);
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const noDose = result.recommendedMl <= 0;

  // Separate the canonical dose warning (always rendered prominently) from any
  // additional clamp/safety notes for clearer hierarchy.
  const extraWarnings = result.warnings.filter((w) => w !== DOSE_WARNING);

  return (
    <Card
      className={cn(
        "space-y-6 transition-all duration-500 ease-out motion-reduce:transition-none",
        shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <SectionLabel>Recommended dose</SectionLabel>
        {result.clamped && (
          <div className="ml-auto">
            <Badge tone="caution">
              <ShieldAlert className="h-3.5 w-3.5" /> Safety-clamped
            </Badge>
          </div>
        )}
      </div>

      {/* Headline figure */}
      {noDose ? (
        <div className="rounded-2xl border border-lagoon-400/25 bg-lagoon-500/10 px-5 py-6">
          <p className="flex items-center gap-2 font-display text-2xl font-semibold text-lagoon-100">
            <Droplet className="h-6 w-6 text-lagoon-300" aria-hidden />
            No dose needed
          </p>
          <p className="mt-2 text-sm leading-relaxed text-abyss-100/85">
            {result.note}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-5 text-center">
            <p className="font-display text-4xl font-semibold tabular-nums text-abyss-50">
              {result.recommendedMl}
              <span className="ml-1 text-lg font-medium text-abyss-200/60">
                mL
              </span>
            </p>
            <p className="mt-1 text-xs uppercase tracking-wide text-abyss-200/55">
              total {treatment ? "to dose" : "to add"}
            </p>
          </div>
          <div className="space-y-3">
            {result.clamped && result.perDayMl !== undefined && (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3">
                <CalendarDays
                  className="mt-0.5 h-5 w-5 shrink-0 text-amber-300"
                  aria-hidden
                />
                <p className="text-sm text-amber-100/90">
                  Spread over{" "}
                  <strong className="font-semibold">
                    {result.days} days
                  </strong>{" "}
                  at about{" "}
                  <strong className="font-semibold tabular-nums">
                    {result.perDayMl} mL/day
                  </strong>{" "}
                  to stay within a safe daily change rate. Re-test before each
                  daily dose.
                </p>
              </div>
            )}
            <p className="text-sm leading-relaxed text-abyss-100/85">
              {result.note}
            </p>
          </div>
        </div>
      )}

      {/* Always-present dose warning, prominent coral box */}
      <div
        role="note"
        className="rounded-xl border border-coral-400/30 bg-coral-500/10 px-4 py-3"
      >
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-coral-200">
          <AlertTriangle className="h-4 w-4" aria-hidden /> Before you dose
        </p>
        <p className="mt-2 text-sm leading-relaxed text-coral-100/90">
          {DOSE_WARNING}
        </p>
        {extraWarnings.length > 0 && (
          <ul className="mt-3 space-y-1.5 border-t border-coral-400/20 pt-3 text-sm text-coral-100/90">
            {extraWarnings.map((w, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className="text-coral-300">
                  •
                </span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Canonical medical/educational disclaimer */}
      <DisclaimerBanner />
    </Card>
  );
}

/* ─────────────────────────── field ─────────────────────────── */

function Field({
  id,
  label,
  suffix,
  value,
  onChange,
  step,
  min,
  placeholder,
  help,
}: {
  id: string;
  label: string;
  suffix?: string;
  value: string;
  onChange: (v: string) => void;
  step?: number;
  min?: number;
  placeholder?: string;
  help?: string;
}) {
  const helpId = `${id}-help`;
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-lagoon-300"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={value}
          step={step}
          min={min}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={help ? helpId : undefined}
          className={cn("reef-input tabular-nums", suffix && "pr-14")}
        />
        {suffix && (
          <span
            aria-hidden
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-abyss-200/55"
          >
            {suffix}
          </span>
        )}
      </div>
      {help && (
        <p id={helpId} className="mt-1.5 text-xs text-abyss-200/55">
          {help}
        </p>
      )}
    </div>
  );
}
