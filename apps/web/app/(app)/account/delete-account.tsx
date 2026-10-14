"use client";

import * as React from "react";
import {
  Trash2,
  AlertTriangle,
  Loader2,
  Info,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";

/**
 * Permanent, in-app account deletion (Apple App Store Guideline 5.1.1(v)).
 *
 * A two-step destructive flow: the primary button reveals an explicit confirm
 * step (no native confirm()), which POSTs to /api/account/delete and then hands
 * off to /auth/signout (the server clears the session and redirects). In demo
 * mode the action is disabled with a clear explanation — never a crash.
 */
export function DeleteAccount({ demo }: { demo: boolean }) {
  const [confirming, setConfirming] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const signoutForm = React.useRef<HTMLFormElement>(null);

  async function remove() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;

      if (res.ok && data?.ok) {
        // Session is gone server-side; POST to /auth/signout to clear cookies
        // and redirect to the marketing home (the route is POST-only).
        signoutForm.current?.submit();
        return;
      }

      setError(
        data?.error ??
          "We couldn't delete your account just now. Please try again in a moment.",
      );
    } catch {
      setError("Network error reaching the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      aria-labelledby="danger-heading"
      className="rounded-2xl border border-coral-400/20 bg-coral-500/[0.04] p-5 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-coral-500/15 text-coral-300">
          <ShieldAlert className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id="danger-heading"
            className="font-display text-lg font-semibold text-abyss-50"
          >
            Delete account
          </h2>
          <p className="mt-1 text-sm text-abyss-200/70">
            Permanently delete your account and all associated data — tanks,
            livestock, parameters, diagnoses, and chat history. This action
            cannot be undone.
          </p>

          <p className="mt-3 flex items-start gap-2 text-xs text-abyss-200/60">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lagoon-300" aria-hidden />
            An active subscription must be cancelled separately from the billing
            section above before deleting.
          </p>

          {demo ? (
            <p
              role="note"
              className="mt-4 flex items-start gap-2.5 rounded-xl border border-lagoon-400/20 bg-lagoon-500/[0.07] px-3.5 py-2.5 text-sm leading-relaxed text-abyss-100/85"
            >
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-lagoon-300" aria-hidden />
              Account management isn&apos;t available in demo mode. Connect a real
              account to permanently delete it.
            </p>
          ) : !confirming ? (
            <div className="mt-4">
              <Button
                variant="secondary"
                className="border-coral-400/30 !text-coral-200 hover:!bg-coral-500/10"
                onClick={() => setConfirming(true)}
              >
                <Trash2 className="h-4 w-4" /> Delete account
              </Button>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <p className="flex items-start gap-2 text-sm font-medium text-coral-100">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-coral-300" />
                This permanently deletes your account and all data. This cannot be
                undone.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="primary"
                  className="!bg-coral-500 hover:!bg-coral-600"
                  onClick={() => void remove()}
                  disabled={pending}
                  aria-busy={pending}
                >
                  {pending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Deleting…
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" /> Yes, delete my account
                    </>
                  )}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setConfirming(false)}
                  disabled={pending}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <div aria-live="polite" className={cn("mt-3", !error && "min-h-0")}>
            {error && (
              <p
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-coral-400/25 bg-coral-500/[0.08] px-3.5 py-2.5 text-sm leading-relaxed text-coral-100"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-coral-300" />
                {error}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Hidden form: the signout route is POST-only; submit it after deletion. */}
      <form ref={signoutForm} action="/auth/signout" method="post" className="hidden" />
    </section>
  );
}
