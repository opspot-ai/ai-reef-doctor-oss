"use client";

import { useTransition } from "react";
import { signInWithOAuth } from "@/app/auth/actions";

const PROVIDERS = [
  { id: "google", label: "Continue with Google" },
  { id: "apple", label: "Continue with Apple" },
] as const;

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35 24 35c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.6 20-21 0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 5.1 29.6 3 24 3 16 3 9.1 7.6 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 45c5.2 0 9.9-2 13.5-5.2l-6.2-5.3C29.2 35.9 26.7 37 24 37c-5.3 0-9.7-2.6-11.3-7l-6.5 5C9 40.3 15.9 45 24 45z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.2 5.3C39.9 36.4 44 31 44 24c0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="currentColor">
      <path d="M16.36 1.43c.04 1.07-.36 2.12-1.07 2.9-.74.83-1.94 1.47-3.05 1.38-.13-1.04.41-2.13 1.06-2.82.74-.81 2.02-1.4 3.06-1.46zM20.5 17.2c-.55 1.27-.82 1.84-1.53 2.96-.99 1.57-2.39 3.53-4.12 3.54-1.54.02-1.94-1-4.03-.99-2.09.01-2.53 1.01-4.07.99-1.73-.02-3.06-1.78-4.05-3.35C-.06 16.04-.36 10.9 1.4 8.13c1.13-1.77 2.92-2.81 4.6-2.81 1.71 0 2.79 1 4.2 1 1.37 0 2.2-1 4.18-1 1.5 0 3.08.81 4.21 2.22-3.7 2.03-3.1 7.3.91 8.66z" />
    </svg>
  );
}

/** OAuth sign-in buttons; pass `next` to preserve the post-login redirect. */
export function OAuthButtons({ next }: { next?: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-3">
      {PROVIDERS.map((p) => (
        <button
          key={p.id}
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await signInWithOAuth(p.id, next ?? "/dashboard");
            })
          }
          className="reef-btn-secondary w-full"
        >
          {p.id === "google" ? <GoogleMark /> : <AppleMark />}
          {p.label}
        </button>
      ))}
    </div>
  );
}
