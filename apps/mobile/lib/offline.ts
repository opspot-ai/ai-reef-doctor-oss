import * as React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ParameterRow, Tank } from "@reef/shared";
import { isDemoMode, features, publicEnv } from "@/lib/env";
import { getAccessToken } from "@/lib/supabase";

/**
 * Offline logbook helper.
 *
 * Two jobs:
 *  1. Read cache — `cacheReads`/`getCached` persist the last-seen tanks + params
 *     to AsyncStorage so the logbook is viewable when the device is offline (or
 *     a fetch fails). Screens call `getCached` as a fallback before showing an
 *     error/empty state.
 *  2. Write queue — `queueParamLog` stores a parameter reading locally and
 *     `flushQueue` best-effort POSTs the backlog to the backend when online.
 *
 * Everything is failure-tolerant: AsyncStorage errors, missing creds, demo
 * mode, and network failures all degrade gracefully and NEVER throw. In demo
 * mode (no backend) writes are a no-op that simply clears the local queue so the
 * UI can pretend the log "saved" without a server to receive it.
 *
 * Dependency-light by design: there is no NetInfo dependency installed, so
 * connectivity is detected best-effort with a tiny fetch probe (`useOnline`),
 * and `flushQueue` is also safe to invoke manually (e.g. a "Sync now" button).
 */

/* ─────────────────────────── keys ─────────────────────────── */

const PREFIX = "reefdoctor.cache.v1.";
const QUEUE_KEY = "reefdoctor.queue.v1.paramLogs";

/** Well-known cache keys callers can pass to `cacheReads`/`getCached`. */
export const CACHE_KEYS = {
  tanks: "tanks",
  /** Per-tank parameter history. Build with `paramsKey(tankId)`. */
  params: (tankId: string) => `params.${tankId}`,
} as const;

export function paramsKey(tankId: string): string {
  return CACHE_KEYS.params(tankId);
}

/* ─────────────────────────── read cache ─────────────────────────── */

interface CacheEnvelope<T> {
  cachedAt: string;
  data: T;
}

/**
 * Persist a read result under `key` for offline viewing. Best-effort: a storage
 * failure is swallowed (the cache is an optimization, never load-bearing).
 */
export async function cacheReads<T>(key: string, data: T): Promise<void> {
  try {
    const envelope: CacheEnvelope<T> = {
      cachedAt: new Date().toISOString(),
      data,
    };
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(envelope));
  } catch {
    // Caching is non-critical — ignore storage errors.
  }
}

/** Read a cached value (or null when absent / unreadable). */
export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    return parsed?.data ?? null;
  } catch {
    return null;
  }
}

/** When a cached value was last written, or null. Useful for "as of" labels. */
export async function getCachedAt(key: string): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<unknown>;
    return parsed?.cachedAt ?? null;
  } catch {
    return null;
  }
}

/** Convenience wrappers for the two cached read shapes the logbook needs. */
export const cacheTanks = (tanks: Tank[]) => cacheReads(CACHE_KEYS.tanks, tanks);
export const getCachedTanks = () => getCached<Tank[]>(CACHE_KEYS.tanks);
export const cacheParams = (tankId: string, rows: ParameterRow[]) =>
  cacheReads(paramsKey(tankId), rows);
export const getCachedParams = (tankId: string) =>
  getCached<ParameterRow[]>(paramsKey(tankId));

/* ─────────────────────────── write queue ─────────────────────────── */

/** A parameter reading payload — the loggable subset of a ParameterRow. */
export type QueuedReading = Partial<
  Omit<ParameterRow, "id" | "tank_id" | "user_id" | "created_at">
> & { measured_at?: string };

export interface QueuedParamLog {
  /** Local id so a log can be de-duped / removed individually. */
  localId: string;
  tankId: string;
  reading: QueuedReading;
  queuedAt: string;
}

export interface FlushResult {
  flushed: number;
  remaining: number;
  /** True when nothing was attempted because there's no backend (demo). */
  skipped: boolean;
}

async function readQueue(): Promise<QueuedParamLog[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueuedParamLog[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: QueuedParamLog[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    // If we can't persist the queue there's nothing more we can do safely.
  }
}

function makeLocalId(): string {
  return `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Queue a parameter reading for later upload. Returns the stored entry. Safe to
 * call offline — it only writes to AsyncStorage; nothing is sent here.
 */
export async function queueParamLog(
  tankId: string,
  reading: QueuedReading,
): Promise<QueuedParamLog> {
  const entry: QueuedParamLog = {
    localId: makeLocalId(),
    tankId,
    reading: { measured_at: new Date().toISOString(), ...reading },
    queuedAt: new Date().toISOString(),
  };
  const queue = await readQueue();
  queue.push(entry);
  await writeQueue(queue);
  return entry;
}

/** How many logs are waiting to upload. */
export async function pendingCount(): Promise<number> {
  return (await readQueue()).length;
}

/** Clear the queue without sending (e.g. user discards local edits). */
export async function clearQueue(): Promise<void> {
  await writeQueue([]);
}

/**
 * Best-effort upload of all queued logs.
 *
 * - Demo / no backend → clears the queue and reports `skipped` (the UI treats
 *   the log as "saved" locally; there is no server to receive it).
 * - Online → POSTs each entry to `/api/parameters` with the user's bearer
 *   token; successfully-sent entries are removed, failures stay queued for a
 *   later retry. Never throws.
 */
export async function flushQueue(): Promise<FlushResult> {
  const queue = await readQueue();
  if (queue.length === 0) {
    return { flushed: 0, remaining: 0, skipped: false };
  }

  // No backend to send to: demo mode or unconfigured API/Supabase. Clear so the
  // local log doesn't grow unbounded; treat as a successful local save.
  if (isDemoMode() || !features.supabase || !features.api) {
    await clearQueue();
    return { flushed: 0, remaining: 0, skipped: true };
  }

  const token = await getAccessToken().catch(() => null);
  if (!token) {
    // Signed out / token unavailable — leave the queue intact for next time.
    return { flushed: 0, remaining: queue.length, skipped: true };
  }

  const remaining: QueuedParamLog[] = [];
  let flushed = 0;

  for (const entry of queue) {
    const ok = await postParamLog(entry, token);
    if (ok) flushed += 1;
    else remaining.push(entry);
  }

  await writeQueue(remaining);
  return { flushed, remaining: remaining.length, skipped: false };
}

async function postParamLog(
  entry: QueuedParamLog,
  token: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${publicEnv.apiBaseUrl}/api/parameters`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ tank_id: entry.tankId, ...entry.reading }),
    });
    // 2xx = accepted. Anything else stays queued for a retry (except a 4xx that
    // isn't auth, which would never succeed — but to stay simple and safe we
    // only treat clear successes as "done").
    return res.ok;
  } catch {
    return false; // network error → keep queued
  }
}

/* ─────────────────────────── connectivity ─────────────────────────── */

/**
 * Lightweight connectivity check. There's no NetInfo dependency installed, so
 * this does a tiny best-effort probe against the API origin. In demo mode there
 * is no backend to reach, so we optimistically report "online" (reads come from
 * the bundled demo dataset regardless).
 */
export async function checkOnline(timeoutMs = 4000): Promise<boolean> {
  if (isDemoMode() || !features.api) return true;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // `no-store` + HEAD-ish GET to the health route; any HTTP response (even an
    // error status) proves the network is reachable.
    await fetch(`${publicEnv.apiBaseUrl}/api/health`, {
      method: "GET",
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Hook exposing a best-effort online flag plus a manual `refresh`. Without
 * NetInfo this can't observe live changes, so callers can re-probe on demand
 * (e.g. when a screen mounts or a "Sync now" button is pressed). Defaults to
 * `true` so the UI is never falsely blocked.
 */
export function useOnline(): { online: boolean; refresh: () => Promise<void> } {
  const [online, setOnline] = React.useState(true);

  const refresh = React.useCallback(async () => {
    const next = await checkOnline();
    setOnline(next);
  }, []);

  React.useEffect(() => {
    let active = true;
    void checkOnline().then((next) => {
      if (active) setOnline(next);
    });
    return () => {
      active = false;
    };
  }, []);

  return { online, refresh };
}
