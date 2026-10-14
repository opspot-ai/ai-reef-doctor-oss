"use client";

import { useActionState } from "react";
import { signInWithPassword, type AuthActionState } from "@/app/auth/actions";

const initialState: AuthActionState = {};

/** Email + password sign-in form. `next` is forwarded to the server action. */
export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(
    signInWithPassword,
    initialState,
  );

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />

      {state.error ? (
        <p
          role="alert"
          className="rounded-xl border border-coral-500/30 bg-coral-500/10 px-4 py-2.5 text-sm text-coral-200"
        >
          {state.error}
        </p>
      ) : null}

      <div className="grid gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-abyss-100">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          className="reef-input"
        />
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-abyss-100">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="Your password"
          className="reef-input"
        />
      </div>

      <button type="submit" disabled={pending} className="reef-btn-primary w-full">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
