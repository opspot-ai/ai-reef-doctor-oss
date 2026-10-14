import * as React from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { isDemoMode } from "@/lib/env";
import { DEMO_USER } from "@/lib/data";

/**
 * Auth context for the mobile app. Wraps Supabase auth and exposes a small,
 * stable surface the screen fan-out builds on. In demo mode (no Supabase creds)
 * there is a synthetic "demo" user so the whole app is browsable; sign-in /
 * sign-up there are no-ops that succeed with a friendly demo notice.
 *
 * Per mobile purchase policy there is NO in-app subscribe and NO external-purchase CTA — this
 * layer only authenticates and reads entitlements (see lib/data).
 */

export interface SessionUser {
  id: string;
  email: string;
  full_name: string;
}

export interface AuthContextValue {
  /** True until the initial session has been resolved. */
  loading: boolean;
  /** The raw Supabase session (null when signed out / in demo mode). */
  session: Session | null;
  /** Normalized current user, or null when signed out. */
  user: SessionUser | null;
  /** True when no Supabase creds are configured (demo dataset is served). */
  isDemo: boolean;
  /** True when there is an authenticated user OR demo mode is active. */
  isAuthenticated: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithPassword: (
    email: string,
    password: string,
    fullName?: string,
  ) => Promise<{ error?: string }>;
  signInWithOAuth: (provider: "google" | "apple") => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

function toSessionUser(user: User): SessionUser {
  return {
    id: user.id,
    email: user.email ?? "",
    full_name: (user.user_metadata?.full_name as string | undefined) ?? "",
  };
}

const DEMO_NOTICE =
  "Demo mode is on (no backend configured). Sign-in is simulated — you're browsing the demo reef.";

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const demo = isDemoMode();
  const [loading, setLoading] = React.useState(true);
  const [session, setSession] = React.useState<Session | null>(null);

  React.useEffect(() => {
    if (demo) {
      setLoading(false);
      return;
    }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [demo]);

  const value = React.useMemo<AuthContextValue>(() => {
    const demoUser: SessionUser = {
      id: DEMO_USER.id,
      email: DEMO_USER.email,
      full_name: DEMO_USER.full_name,
    };
    const user: SessionUser | null = demo
      ? demoUser
      : session?.user
        ? toSessionUser(session.user)
        : null;

    return {
      loading,
      session,
      user,
      isDemo: demo,
      isAuthenticated: demo || user != null,

      async signInWithPassword(email, password) {
        if (demo) return { error: DEMO_NOTICE };
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return error ? { error: error.message } : {};
      },

      async signUpWithPassword(email, password, fullName) {
        if (demo) return { error: DEMO_NOTICE };
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: fullName ? { data: { full_name: fullName } } : undefined,
        });
        return error ? { error: error.message } : {};
      },

      async signInWithOAuth(provider) {
        if (demo) return { error: DEMO_NOTICE };
        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo: "reefdoctor://auth/callback" },
        });
        return error ? { error: error.message } : {};
      },

      async signOut() {
        if (demo) return;
        await supabase.auth.signOut();
      },
    };
  }, [demo, loading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an <AuthProvider>");
  return ctx;
}
