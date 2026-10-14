"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CalendarPlus,
  Check,
  CheckCircle2,
  Trash2,
  Info,
  AlertTriangle,
} from "lucide-react";
import { Card, SectionLabel, Button, Spinner } from "@/components/ui";
import { cn } from "@/lib/cn";
import { createReminder, completeReminder, deleteReminder } from "@/lib/data/actions";

/* ─────────────────────────── Constants ─────────────────────────── */

const KINDS: { value: string; label: string }[] = [
  { value: "water-change", label: "Water change" },
  { value: "test", label: "Test parameters" },
  { value: "dose", label: "Dose" },
  { value: "maintenance", label: "Maintenance" },
  { value: "media-swap", label: "Media swap" },
];

const RECURRENCES: { value: string; label: string }[] = [
  { value: "none", label: "One-time" },
  { value: "daily", label: "Every day" },
  { value: "weekly", label: "Every week" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Every month" },
];

type Feedback =
  | { kind: "success"; message: string }
  | { kind: "demo"; message: string }
  | { kind: "error"; message: string }
  | null;

/** datetime-local wants `YYYY-MM-DDTHH:mm` in local time — default to tomorrow 9am. */
function defaultDueLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

/* ─────────────────────────── New reminder form ─────────────────────────── */

interface TankOption {
  id: string;
  name: string;
}

export function NewReminderForm({
  tanks,
  defaultTankId,
}: {
  tanks: TankOption[];
  defaultTankId?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [feedback, setFeedback] = React.useState<Feedback>(null);
  const [titleError, setTitleError] = React.useState<string | undefined>();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);
    setTitleError(undefined);

    const form = e.currentTarget;
    const data = new FormData(form);
    const title = String(data.get("title") ?? "").trim();
    const kind = String(data.get("kind") ?? "test");
    const recurrence = String(data.get("recurrence") ?? "none");
    const tankId = String(data.get("tank_id") ?? "");
    const dueRaw = String(data.get("due_at") ?? "").trim();

    if (!title) {
      setTitleError("Give the reminder a short title.");
      return;
    }
    if (!dueRaw) {
      setFeedback({ kind: "error", message: "Pick a due date and time." });
      return;
    }
    const dueIso = new Date(dueRaw).toISOString();

    setPending(true);
    try {
      const res = await createReminder({
        tank_id: tankId,
        title,
        kind,
        due_at: dueIso,
        recurrence,
      });
      if (res.ok) {
        setFeedback({ kind: "success", message: "Reminder scheduled." });
        form.reset();
        router.refresh();
      } else if (res.demo) {
        setFeedback({
          kind: "demo",
          message: "Demo mode — connect Supabase to save your reminders.",
        });
      } else {
        setFeedback({ kind: "error", message: res.error });
      }
    } catch {
      setFeedback({
        kind: "error",
        message: "Something went wrong scheduling that reminder. Please try again.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="lg:sticky lg:top-24">
      <SectionLabel>Schedule a reminder</SectionLabel>
      <p className="mb-4 text-sm text-abyss-200/70">
        Set up a one-time or recurring reef care task.
      </p>

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div>
          <label
            htmlFor="reminder-title"
            className="mb-1.5 block text-sm font-medium text-abyss-100"
          >
            Title
          </label>
          <input
            id="reminder-title"
            name="title"
            type="text"
            required
            maxLength={120}
            placeholder="e.g. Test alkalinity"
            aria-invalid={titleError ? true : undefined}
            aria-describedby={titleError ? "reminder-title-error" : undefined}
            className="reef-input"
          />
          {titleError && (
            <p id="reminder-title-error" className="mt-1.5 text-xs text-coral-300">
              {titleError}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="reminder-kind"
              className="mb-1.5 block text-sm font-medium text-abyss-100"
            >
              Kind
            </label>
            <select
              id="reminder-kind"
              name="kind"
              defaultValue="test"
              className="reef-input appearance-none"
            >
              {KINDS.map((k) => (
                <option key={k.value} value={k.value} className="bg-abyss-900">
                  {k.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="reminder-recurrence"
              className="mb-1.5 block text-sm font-medium text-abyss-100"
            >
              Repeat
            </label>
            <select
              id="reminder-recurrence"
              name="recurrence"
              defaultValue="weekly"
              className="reef-input appearance-none"
            >
              {RECURRENCES.map((r) => (
                <option key={r.value} value={r.value} className="bg-abyss-900">
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor="reminder-due"
            className="mb-1.5 block text-sm font-medium text-abyss-100"
          >
            Due at
          </label>
          <input
            id="reminder-due"
            name="due_at"
            type="datetime-local"
            required
            defaultValue={defaultDueLocal()}
            className="reef-input [color-scheme:dark]"
          />
        </div>

        {tanks.length > 1 && (
          <div>
            <label
              htmlFor="reminder-tank"
              className="mb-1.5 block text-sm font-medium text-abyss-100"
            >
              Tank
            </label>
            <select
              id="reminder-tank"
              name="tank_id"
              defaultValue={defaultTankId ?? tanks[0]?.id}
              className="reef-input appearance-none"
            >
              {tanks.map((t) => (
                <option key={t.id} value={t.id} className="bg-abyss-900">
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {tanks.length === 1 && (
          <input type="hidden" name="tank_id" value={tanks[0]?.id ?? ""} />
        )}

        <div className="flex flex-col gap-3 pt-1">
          <Button type="submit" disabled={pending}>
            {pending ? (
              <>
                <Spinner /> Scheduling…
              </>
            ) : (
              <>
                <CalendarPlus className="h-4 w-4" /> Add reminder
              </>
            )}
          </Button>

          <span aria-live="polite" className="min-h-[1.25rem] text-sm">
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

/* ─────────────────────────── Complete / delete actions ─────────────────────────── */

export function ReminderActions({
  id,
  title,
  className,
}: {
  id: string;
  title: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<"complete" | "delete" | null>(null);
  const [confirming, setConfirming] = React.useState(false);
  const [note, setNote] = React.useState<Feedback>(null);

  async function handle(
    action: "complete" | "delete",
    fn: () => Promise<{ ok: boolean; demo?: boolean; error?: string }>,
  ) {
    setNote(null);
    setBusy(action);
    try {
      const res = await fn();
      if (res.ok) {
        router.refresh();
        return;
      }
      setConfirming(false);
      if (res.demo) {
        setNote({
          kind: "demo",
          message:
            action === "complete"
              ? "Demo mode — connect Supabase to mark reminders done."
              : "Demo mode — connect Supabase to delete reminders.",
        });
      } else {
        setNote({
          kind: "error",
          message: res.error ?? "Something went wrong. Please try again.",
        });
      }
    } catch {
      setConfirming(false);
      setNote({ kind: "error", message: "Something went wrong. Please try again." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => handle("complete", () => completeReminder(id))}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-lg border border-lagoon-400/30 bg-lagoon-500/10 px-2.5 py-1.5 text-xs font-medium text-lagoon-200 transition hover:bg-lagoon-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-lagoon-400 disabled:opacity-50"
        >
          {busy === "complete" ? (
            <Spinner className="h-3.5 w-3.5" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          Mark done
        </button>

        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={busy !== null}
            aria-label={`Delete reminder: ${title}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs font-medium text-abyss-200/70 transition hover:border-coral-400/30 hover:bg-coral-500/10 hover:text-coral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-coral-400 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        ) : (
          <span className="inline-flex items-center gap-2 text-xs">
            <span className="text-abyss-200/70">Delete?</span>
            <button
              type="button"
              onClick={() => handle("delete", () => deleteReminder(id))}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg bg-coral-500 px-2.5 py-1.5 font-medium text-white transition hover:bg-coral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-coral-400 disabled:opacity-50"
            >
              {busy === "delete" ? (
                <Spinner className="h-3.5 w-3.5" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Yes, delete
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={busy !== null}
              className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 font-medium text-abyss-100 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-lagoon-400 disabled:opacity-50"
            >
              Keep
            </button>
          </span>
        )}
      </div>

      {note && (
        <p
          role={note.kind === "error" ? "alert" : "status"}
          aria-live="polite"
          className={cn(
            "mt-2 inline-flex items-center gap-1.5 text-xs",
            note.kind === "demo" ? "text-amber-300" : "text-coral-300",
          )}
        >
          {note.kind === "demo" ? (
            <Info className="h-3.5 w-3.5" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5" />
          )}
          {note.message}
        </p>
      )}
    </div>
  );
}
