/**
 * POST /api/account/delete — permanent, in-app account deletion (Apple App Store
 * Guideline 5.1.1(v)). Deletes the signed-in user's auth record, which CASCADES
 * every owner-scoped row (tanks, livestock, parameters, diagnoses, chats, …) via
 * the `on delete cascade` FKs to `auth.users` (see supabase/migrations/0001_init.sql).
 *
 * Storage is NOT cascaded by `deleteUser`, so we best-effort remove the user's
 * objects under the private `tank-photos` bucket (prefix = user.id) first.
 *
 * "Sign in with Apple" callers must also have their token revoked (Apple's own
 * requirement). That is gated on owner-supplied creds (APPLE_SIGN_IN_*) and is
 * strictly best-effort — a revoke failure never blocks the deletion.
 *
 * In demo mode (no Supabase configured) there is nothing to delete, so we return
 * a friendly `{ ok: true, demo: true }` instead of crashing.
 */
import { createSign } from "node:crypto";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getRequestContext } from "@/lib/api-auth";
import { ApiErrors, jsonOk } from "@/lib/http";
import { features, serverEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const TANK_PHOTOS_BUCKET = "tank-photos";

export async function POST(req: Request) {
  try {
    const { user } = await getRequestContext(req);
    if (!user) return ApiErrors.unauthorized();

    // Demo mode: no backend, nothing to delete. Never crash.
    if (!features.supabase) {
      return jsonOk({ ok: true, demo: true });
    }

    const admin = createSupabaseAdminClient();

    // 1. Best-effort: remove the user's storage objects (deleteUser does NOT
    //    cascade Storage). Owner-scoped under the `tank-photos` bucket.
    await deleteUserStorage(admin, user.id);

    // 2. Best-effort: revoke the Sign in with Apple token (Apple requirement).
    //    Skipped silently when creds are absent or the user isn't an Apple user.
    await revokeAppleIfNeeded(user);

    // 3. Delete the auth user — CASCADES all owner-scoped rows.
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      return ApiErrors.serverError("Could not delete your account. Please try again.");
    }

    return jsonOk({ ok: true });
  } catch {
    return ApiErrors.serverError("Could not delete your account. Please try again.");
  }
}

/**
 * Best-effort recursive removal of every object under `tank-photos/<userId>/…`.
 * Swallows all errors — a storage cleanup failure must not block the deletion of
 * the auth record (the bucket is private and the row that referenced it is gone).
 */
async function deleteUserStorage(
  admin: SupabaseClient,
  userId: string,
): Promise<void> {
  try {
    const paths = await listStoragePaths(admin, userId);
    if (paths.length > 0) {
      await admin.storage.from(TANK_PHOTOS_BUCKET).remove(paths);
    }
  } catch {
    // Best-effort cleanup; never throw from the storage path.
  }
}

/** Collect every object path under the user's prefix (one level of nesting). */
async function listStoragePaths(
  admin: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const bucket = admin.storage.from(TANK_PHOTOS_BUCKET);
  const out: string[] = [];

  const { data: top } = await bucket.list(userId, { limit: 1000 });
  for (const entry of top ?? []) {
    // Supabase marks "folders" by a null `id`; recurse one level into them.
    if (entry.id === null) {
      const sub = `${userId}/${entry.name}`;
      const { data: nested } = await bucket.list(sub, { limit: 1000 });
      for (const child of nested ?? []) {
        if (child.id !== null) out.push(`${sub}/${child.name}`);
      }
    } else {
      out.push(`${userId}/${entry.name}`);
    }
  }
  return out;
}

/**
 * Revoke the user's "Sign in with Apple" token, best-effort.
 *
 * Gated on:
 *  - the user actually signing in with Apple (app_metadata / identities), and
 *  - all four owner-supplied creds being present.
 * When creds are absent we SKIP silently (TODO: owner adds APPLE_SIGN_IN_* env).
 * A failure here never propagates — the account is still deleted.
 */
async function revokeAppleIfNeeded(user: User): Promise<void> {
  try {
    if (!isAppleUser(user)) return;

    const { clientId, teamId, keyId, privateKey } = serverEnv.appleSignIn;
    // TODO(owner): supply APPLE_SIGN_IN_CLIENT_ID / _TEAM_ID / _KEY_ID /
    // _PRIVATE_KEY to enable Apple token revocation on account deletion.
    if (!clientId || !teamId || !keyId || !privateKey) return;

    // The Apple refresh/access token captured at sign-in, if Supabase stored it.
    const token = appleProviderToken(user);
    if (!token) return;

    const clientSecret = makeAppleClientSecret({
      clientId,
      teamId,
      keyId,
      privateKey,
    });

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      token,
      token_type_hint: "refresh_token",
    });

    await fetch("https://appleid.apple.com/auth/revoke", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch {
    // Best-effort: never block deletion on a revoke failure.
  }
}

/** True when the user authenticated via "Sign in with Apple". */
function isAppleUser(user: User): boolean {
  const meta = user.app_metadata;
  if (meta.provider === "apple") return true;
  if (Array.isArray(meta.providers) && meta.providers.includes("apple")) {
    return true;
  }
  return (user.identities ?? []).some((i) => i.provider === "apple");
}

/** The Apple OAuth token Supabase may have persisted on the identity, if any. */
function appleProviderToken(user: User): string | null {
  for (const identity of user.identities ?? []) {
    if (identity.provider !== "apple") continue;
    const data = identity.identity_data as
      | { provider_refresh_token?: unknown; provider_token?: unknown }
      | undefined;
    const refresh = data?.provider_refresh_token;
    if (typeof refresh === "string" && refresh.length > 0) return refresh;
    const access = data?.provider_token;
    if (typeof access === "string" && access.length > 0) return access;
  }
  return null;
}

/**
 * Build the ES256-signed client secret JWT Apple requires for /auth/revoke.
 * Uses Node's built-in crypto (route runs on the Node runtime) so no extra
 * dependency is introduced. `privateKey` is the contents of the .p8 key file.
 */
function makeAppleClientSecret(opts: {
  clientId: string;
  teamId: string;
  keyId: string;
  privateKey: string;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: opts.keyId, typ: "JWT" };
  const payload = {
    iss: opts.teamId,
    iat: now,
    exp: now + 300, // 5 minutes — Apple caps client secrets well under this.
    aud: "https://appleid.apple.com",
    sub: opts.clientId,
  };

  const encode = (obj: unknown): string =>
    base64url(Buffer.from(JSON.stringify(obj)));
  const signingInput = `${encode(header)}.${encode(payload)}`;

  // ES256 = ECDSA over P-256 with SHA-256; Apple expects JOSE (raw r||s) format.
  const signer = createSign("SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign({
    key: opts.privateKey,
    dsaEncoding: "ieee-p1363",
  });

  return `${signingInput}.${base64url(signature)}`;
}

/** URL-safe base64 without padding (JWT/JOSE encoding). */
function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
