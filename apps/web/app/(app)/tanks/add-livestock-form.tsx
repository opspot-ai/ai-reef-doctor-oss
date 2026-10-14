"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Check, AlertTriangle, Info, Fish, Flower2, Shell } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import { addLivestock } from "@/lib/data/actions";

const KINDS: { value: "fish" | "coral" | "invert"; label: string; icon: typeof Fish }[] = [
  { value: "fish", label: "Fish", icon: Fish },
  { value: "coral", label: "Coral", icon: Flower2 },
  { value: "invert", label: "Invertebrate", icon: Shell },
];

type Note =
  | { kind: "demo"; text: string }
  | { kind: "error"; text: string }
  | { kind: "success"; text: string }
  | null;

/**
 * Accessible "Add livestock" form for a single tank. Demo results show a
 * friendly note; success resets, closes and refreshes.
 */
export function AddLivestockForm({ tankId }: { tankId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [kind, setKind] = React.useState<"fish" | "coral" | "invert">("fish");
  const [pending, setPending] = React.useState(false);
  const [note, setNote] = React.useState<Note>(null);
  const [nameError, setNameError] = React.useState<string | undefined>();
  const firstFieldRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) firstFieldRef.current?.focus();
  }, [open]);

  function reset() {
    setNameError(undefined);
    setNote(null);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    reset();
    const form = e.currentTarget;
    const data = new FormData(form);
    const commonName = String(data.get("common_name") ?? "").trim();
    const scientificName = String(data.get("scientific_name") ?? "").trim();
    const nickname = String(data.get("nickname") ?? "").trim();
    const addedAt = String(data.get("added_at") ?? "").trim();
    const notes = String(data.get("notes") ?? "").trim();

    if (!commonName) {
      setNameError("A common name is required.");
      return;
    }

    setPending(true);
    const res = await addLivestock({
      tank_id: tankId,
      kind,
      common_name: commonName,
      ...(scientificName ? { scientific_name: scientificName } : {}),
      ...(nickname ? { nickname } : {}),
      ...(addedAt ? { added_at: addedAt } : {}),
      ...(notes ? { notes } : {}),
    });
    setPending(false);

    if (res.ok) {
      form.reset();
      setKind("fish");
      setOpen(false);
      setNote({ kind: "success", text: "Added to your inventory." });
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
        <Button variant="secondary" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Add livestock
        </Button>
        {note?.kind === "success" && (
          <p className="mt-2 text-sm text-lagoon-300" role="status">
            {note.text}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="reef-card transition duration-300">
      <div className="mb-5 flex items-start justify-between gap-4">
        <h3 className="font-display text-lg font-semibold text-abyss-50">
          Add livestock
        </h3>
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
        {/* Kind — accessible radio group rendered as segmented control */}
        <fieldset className="sm:col-span-2">
          <legend className="mb-1.5 text-sm font-medium text-abyss-100">Kind</legend>
          <div role="radiogroup" aria-label="Livestock kind" className="flex flex-wrap gap-2">
            {KINDS.map(({ value, label, icon: Icon }) => {
              const selected = kind === value;
              return (
                <label
                  key={value}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition focus-within:ring-2 focus-within:ring-lagoon-400",
                    selected
                      ? "border-lagoon-400/40 bg-lagoon-500/15 text-lagoon-100"
                      : "border-white/10 bg-white/5 text-abyss-100/70 hover:bg-white/10",
                  )}
                >
                  <input
                    type="radio"
                    name="kind"
                    value={value}
                    checked={selected}
                    onChange={() => setKind(value)}
                    className="sr-only"
                  />
                  <Icon className="h-4 w-4" aria-hidden />
                  {label}
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="sm:col-span-2">
          <label htmlFor="ls-common" className="mb-1.5 block text-sm font-medium text-abyss-100">
            Common name
          </label>
          <input
            ref={firstFieldRef}
            id="ls-common"
            name="common_name"
            type="text"
            required
            placeholder="e.g. Ocellaris Clownfish"
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? "ls-common-error" : undefined}
            className="reef-input"
          />
          {nameError && (
            <p id="ls-common-error" className="mt-1.5 text-xs text-coral-300">
              {nameError}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="ls-scientific" className="mb-1.5 block text-sm font-medium text-abyss-100">
            Scientific name <span className="font-normal text-abyss-200/50">(optional)</span>
          </label>
          <input
            id="ls-scientific"
            name="scientific_name"
            type="text"
            placeholder="e.g. Amphiprion ocellaris"
            className="reef-input italic"
          />
        </div>

        <div>
          <label htmlFor="ls-nickname" className="mb-1.5 block text-sm font-medium text-abyss-100">
            Nickname <span className="font-normal text-abyss-200/50">(optional)</span>
          </label>
          <input
            id="ls-nickname"
            name="nickname"
            type="text"
            placeholder="e.g. Nemo"
            className="reef-input"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="ls-added" className="mb-1.5 block text-sm font-medium text-abyss-100">
            Added on <span className="font-normal text-abyss-200/50">(optional)</span>
          </label>
          <input
            id="ls-added"
            name="added_at"
            type="date"
            max="2100-12-31"
            className="reef-input [color-scheme:dark]"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="ls-notes" className="mb-1.5 block text-sm font-medium text-abyss-100">
            Notes <span className="font-normal text-abyss-200/50">(optional)</span>
          </label>
          <textarea
            id="ls-notes"
            name="notes"
            rows={2}
            maxLength={2000}
            placeholder="Behaviour, host, acclimation notes…"
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
                <Check className="h-4 w-4" /> Add
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
