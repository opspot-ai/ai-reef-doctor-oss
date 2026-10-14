"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Check, AlertTriangle, Info, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import { createTank, deleteTank } from "@/lib/data/actions";

const TANK_TYPES: { value: string; label: string }[] = [
  { value: "mixed", label: "Mixed reef" },
  { value: "sps", label: "SPS dominant" },
  { value: "lps", label: "LPS dominant" },
  { value: "soft", label: "Soft coral" },
  { value: "fowlr", label: "Fish-only (FOWLR)" },
  { value: "nano", label: "Nano" },
];

type Note =
  | { kind: "demo"; text: string }
  | { kind: "error"; text: string }
  | { kind: "success"; text: string }
  | null;

/**
 * Accessible "Add tank" form. Opens inline (disclosure pattern) so it stays on
 * the tanks index. On a demo-mode result it shows a friendly note rather than a
 * hard error; on success it resets, closes, and refreshes the route.
 */
export function NewTankForm() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [note, setNote] = React.useState<Note>(null);
  const [errors, setErrors] = React.useState<{ name?: string; volume?: string }>({});
  const firstFieldRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) firstFieldRef.current?.focus();
  }, [open]);

  function reset() {
    setErrors({});
    setNote(null);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    reset();
    const form = e.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const type = String(data.get("type") ?? "mixed");
    const volumeRaw = String(data.get("volume_liters") ?? "").trim();
    const startedAt = String(data.get("started_at") ?? "").trim();
    const notes = String(data.get("notes") ?? "").trim();

    const nextErrors: { name?: string; volume?: string } = {};
    if (!name) nextErrors.name = "Give your tank a name.";
    const volume = Number(volumeRaw);
    if (!volumeRaw || Number.isNaN(volume) || volume <= 0) {
      nextErrors.volume = "Enter a volume greater than zero.";
    }
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setPending(true);
    const res = await createTank({
      name,
      type,
      volume_liters: volume,
      ...(startedAt ? { started_at: startedAt } : {}),
      ...(notes ? { notes } : {}),
    });
    setPending(false);

    if (res.ok) {
      form.reset();
      setOpen(false);
      setNote({ kind: "success", text: "Tank added." });
      router.refresh();
      return;
    }
    if (res.demo) {
      setNote({ kind: "demo", text: res.error });
      return;
    }
    setNote({ kind: "error", text: res.error });
  }

  if (!open) {
    return (
      <div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Add tank
        </Button>
        {note?.kind === "success" && (
          <p className="mt-3 text-sm text-lagoon-300" role="status">
            {note.text}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="reef-card transition duration-300">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-abyss-50">
            New tank
          </h2>
          <p className="mt-1 text-sm text-abyss-200/70">
            Add a system to track its parameters, livestock and history.
          </p>
        </div>
        <button
          type="button"
          aria-label="Cancel"
          onClick={() => {
            setOpen(false);
            reset();
          }}
          className="rounded-lg p-2 text-abyss-200/60 transition hover:bg-white/5 hover:text-abyss-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-lagoon-400"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="tank-name" className="mb-1.5 block text-sm font-medium text-abyss-100">
            Tank name
          </label>
          <input
            ref={firstFieldRef}
            id="tank-name"
            name="name"
            type="text"
            required
            maxLength={120}
            placeholder="e.g. Coral Garden"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? "tank-name-error" : undefined}
            className="reef-input"
          />
          {errors.name && (
            <p id="tank-name-error" className="mt-1.5 text-xs text-coral-300">
              {errors.name}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="tank-type" className="mb-1.5 block text-sm font-medium text-abyss-100">
            Tank type
          </label>
          <select id="tank-type" name="type" defaultValue="mixed" className="reef-input appearance-none">
            {TANK_TYPES.map((t) => (
              <option key={t.value} value={t.value} className="bg-abyss-900">
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="tank-volume" className="mb-1.5 block text-sm font-medium text-abyss-100">
            Volume (liters)
          </label>
          <input
            id="tank-volume"
            name="volume_liters"
            type="number"
            inputMode="decimal"
            min={1}
            step="any"
            required
            placeholder="e.g. 284"
            aria-invalid={errors.volume ? true : undefined}
            aria-describedby={errors.volume ? "tank-volume-error" : undefined}
            className="reef-input"
          />
          {errors.volume && (
            <p id="tank-volume-error" className="mt-1.5 text-xs text-coral-300">
              {errors.volume}
            </p>
          )}
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="tank-started" className="mb-1.5 block text-sm font-medium text-abyss-100">
            Started on <span className="font-normal text-abyss-200/50">(optional)</span>
          </label>
          <input
            id="tank-started"
            name="started_at"
            type="date"
            max="2100-12-31"
            className="reef-input [color-scheme:dark]"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="tank-notes" className="mb-1.5 block text-sm font-medium text-abyss-100">
            Notes <span className="font-normal text-abyss-200/50">(optional)</span>
          </label>
          <textarea
            id="tank-notes"
            name="notes"
            rows={2}
            maxLength={2000}
            placeholder="Equipment, livestock goals, anything worth remembering."
            className="reef-input resize-none"
          />
        </div>

        {note && note.kind !== "success" && (
          <div
            role={note.kind === "error" ? "alert" : "status"}
            aria-live="polite"
            className={cn(
              "sm:col-span-2 flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-sm",
              note.kind === "demo"
                ? "border border-amber-400/25 bg-amber-500/10 text-amber-100/90"
                : "border border-coral-400/25 bg-coral-500/10 text-coral-100/90",
            )}
          >
            {note.kind === "demo" ? (
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-coral-300" />
            )}
            <span>
              {note.kind === "demo" ? (
                <>
                  <strong className="font-semibold">Demo mode</strong> — connect
                  Supabase to save. {note.text}
                </>
              ) : (
                note.text
              )}
            </span>
          </div>
        )}

        <div className="sm:col-span-2 flex items-center gap-3 pt-1">
          <Button type="submit" disabled={pending}>
            {pending ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Saving…
              </>
            ) : (
              <>
                <Check className="h-4 w-4" /> Create tank
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setOpen(false);
              reset();
            }}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

/**
 * Danger-zone delete control. Requires an explicit two-step confirmation before
 * calling deleteTank. On success it routes back to the tanks index; on a demo
 * result it surfaces the friendly note inline.
 */
export function DeleteTankButton({
  tankId,
  tankName,
}: {
  tankId: string;
  tankName: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [note, setNote] = React.useState<Note>(null);

  async function onDelete() {
    setNote(null);
    setPending(true);
    const res = await deleteTank(tankId);
    setPending(false);
    if (res.ok) {
      router.push("/tanks");
      router.refresh();
      return;
    }
    setConfirming(false);
    if (res.demo) {
      setNote({ kind: "demo", text: res.error });
      return;
    }
    setNote({ kind: "error", text: res.error });
  }

  return (
    <div>
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="reef-btn border border-coral-400/30 bg-coral-500/10 text-coral-200 hover:bg-coral-500/20"
        >
          <Trash2 className="h-4 w-4" /> Delete tank
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-abyss-100">
            Permanently delete{" "}
            <span className="font-semibold text-abyss-50">{tankName}</span> and all
            of its livestock, parameters and history? This can&apos;t be undone.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onDelete}
              disabled={pending}
              className="reef-btn bg-coral-500 text-white hover:bg-coral-600 disabled:opacity-50"
            >
              {pending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" /> Yes, delete permanently
                </>
              )}
            </button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              Keep tank
            </Button>
          </div>
        </div>
      )}

      {note && (
        <div
          role={note.kind === "error" ? "alert" : "status"}
          aria-live="polite"
          className={cn(
            "mt-3 flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-sm",
            note.kind === "demo"
              ? "border border-amber-400/25 bg-amber-500/10 text-amber-100/90"
              : "border border-coral-400/25 bg-coral-500/10 text-coral-100/90",
          )}
        >
          {note.kind === "demo" ? (
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-coral-300" />
          )}
          <span>
            {note.kind === "demo" ? (
              <>
                <strong className="font-semibold">Demo mode</strong> — connect
                Supabase to delete. {note.text}
              </>
            ) : (
              note.text
            )}
          </span>
        </div>
      )}
    </div>
  );
}
