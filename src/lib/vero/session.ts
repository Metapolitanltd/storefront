import "server-only";

import { createHash } from "node:crypto";
import { decodeJwt, EncryptJWT, jwtDecrypt } from "jose";
import { cookies } from "next/headers";
import { cache } from "react";
import { refreshVeroTokens, VeroAuthError } from "./client";
import {
  ACCESS_FALLBACK_MAX_AGE,
  ACCESS_REFRESH_SKEW,
  REFRESH_FALLBACK_MAX_AGE,
  VERO_ACCESS_COOKIE,
  VERO_REFRESH_COOKIE,
  VERO_RETURN_TO_COOKIE,
} from "./config";
import type {
  VeroJwtClaims,
  VeroRefresh,
  VeroSession,
  VeroTokenResponse,
} from "./types";

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

// --- Encryption key (refresh cookie is encrypted at rest) ---

let cachedKey: Uint8Array | null = null;

/**
 * 32-byte key derived from `VERO_SESSION_SECRET`, used to encrypt/decrypt the
 * refresh cookie (A256GCM). Fails loudly if the secret is unset so
 * misconfiguration surfaces immediately in every environment.
 */
function sessionKey(): Uint8Array {
  if (cachedKey) return cachedKey;
  const secret = process.env.VERO_SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "VERO_SESSION_SECRET is not set — required to encrypt the refresh token",
    );
  }
  cachedKey = new Uint8Array(createHash("sha256").update(secret).digest());
  return cachedKey;
}

function baseCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/** Seconds until a JWT's `exp`, or `fallback` when absent/already elapsed. */
function ttlFromJwt(jwt: string, fallback: number): number {
  try {
    const { exp } = decodeJwt(jwt);
    if (exp) {
      const ttl = exp - nowSeconds();
      if (ttl > 0) return ttl;
    }
  } catch {
    // Undecodable — fall back.
  }
  return fallback;
}

/** Best-effort identity claims (uid is required elsewhere; the rest optional). */
function identityFromJwt(jwt: string): { username?: string; email?: string } {
  try {
    const c = decodeJwt(jwt);
    return {
      username:
        typeof c.username === "string" && c.username ? c.username : undefined,
      email: typeof c.email === "string" && c.email ? c.email : undefined,
    };
  } catch {
    return {};
  }
}

// --- Token persistence (access + refresh) ---

/**
 * Persist the access JWT and the rotated refresh cookie. Cookie lifetimes track
 * the tokens' own `exp` so a cookie disappears exactly when its token dies. The
 * refresh cookie also carries the identity (uid/email/name) so we can resolve
 * "who is logged in" WITHOUT a network refresh once the short-lived access JWT
 * has expired. Must be called from a route handler or server action.
 */
async function persistTokens(
  uid: string,
  tokens: VeroTokenResponse,
): Promise<void> {
  const cookieStore = await cookies();
  const identity = identityFromJwt(tokens.jwt);

  const accessMaxAge = ttlFromJwt(tokens.jwt, ACCESS_FALLBACK_MAX_AGE);
  cookieStore.set(
    VERO_ACCESS_COOKIE,
    tokens.jwt,
    baseCookieOptions(accessMaxAge),
  );

  const refreshTtl = tokens.refresh.exp - nowSeconds();
  const refreshMaxAge = refreshTtl > 0 ? refreshTtl : REFRESH_FALLBACK_MAX_AGE;
  const jwe = await new EncryptJWT({
    uid,
    username: identity.username,
    email: identity.email,
    did: tokens.refresh.did,
    tok: tokens.refresh.tok,
    rexp: tokens.refresh.exp,
  })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${refreshMaxAge}s`)
    .encrypt(sessionKey());
  cookieStore.set(VERO_REFRESH_COOKIE, jwe, baseCookieOptions(refreshMaxAge));
}

interface StoredRefresh {
  uid: string;
  username?: string;
  email?: string;
  refresh: VeroRefresh;
}

/** Decrypt the refresh cookie: identity + the refresh triple. Null if absent. */
async function getStoredRefresh(): Promise<StoredRefresh | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(VERO_REFRESH_COOKIE)?.value;
  if (!raw) return null;

  try {
    const { payload } = await jwtDecrypt(raw, sessionKey());
    if (
      typeof payload.uid !== "string" ||
      typeof payload.did !== "string" ||
      typeof payload.tok !== "string"
    ) {
      return null;
    }
    return {
      uid: payload.uid,
      username:
        typeof payload.username === "string" ? payload.username : undefined,
      email: typeof payload.email === "string" ? payload.email : undefined,
      refresh: {
        did: payload.did,
        tok: payload.tok,
        exp: typeof payload.rexp === "number" ? payload.rexp : 0,
      },
    };
  } catch {
    return null;
  }
}

// --- Public session lifecycle ---

/**
 * Establish a session after a successful code exchange. Must be called from a
 * route handler or server action (writes cookies).
 */
export async function establishVeroSession(
  claims: VeroJwtClaims,
  tokens: VeroTokenResponse,
): Promise<void> {
  await persistTokens(claims.uid, tokens);
}

/** Clear every auth cookie. Must run in a mutable-cookie context. */
export async function clearVeroSession(): Promise<void> {
  const cookieStore = await cookies();
  const expire = { maxAge: -1, path: "/" };
  cookieStore.set(VERO_ACCESS_COOKIE, "", expire);
  cookieStore.set(VERO_REFRESH_COOKIE, "", expire);
}

/**
 * Resolve the current identity WITHOUT any network call. Prefers the cached
 * access JWT (freshest claims); falls back to the identity stored in the
 * refresh cookie once the access JWT has expired. Returns null only when both
 * cookies are gone (the refresh cookie's lifetime tracks the refresh `exp`, so
 * a truly expired session naturally reads as logged-out).
 *
 * This does NOT rotate tokens — rotation is reserved for actual API calls (see
 * `getVeroAccessToken` / `withVeroAuth`) — so ordinary page loads never churn
 * the refresh token. Safe to call from server components (read-only).
 */
export const readVeroSession = cache(async (): Promise<VeroSession | null> => {
  const cookieStore = await cookies();
  const access = cookieStore.get(VERO_ACCESS_COOKIE)?.value;

  if (access) {
    try {
      const claims = decodeJwt(access) as VeroJwtClaims;

      if (typeof claims.uid === "string") {
        return { uid: claims.uid, ...identityFromJwt(access) };
      }
    } catch {
      // Undecodable access cookie — fall back to the refresh cookie.
    }
  }

  const stored = await getStoredRefresh();
  if (!stored) return null;
  return { uid: stored.uid, username: stored.username, email: stored.email };
});

// --- Access-token acquisition (for authenticated Vero API calls) ---

/** Rotate the refresh token → new access JWT, persist, return it (or null). */
async function rotate(): Promise<string | null> {
  const stored = await getStoredRefresh();
  if (!stored) return null;

  try {
    const rotated = await refreshVeroTokens({
      uid: stored.uid,
      refresh: stored.refresh,
    });
    await persistTokens(stored.uid, rotated);
    return rotated.jwt;
  } catch (error) {
    if (error instanceof VeroAuthError) {
      // Refresh token invalid/expired/reused — the session is dead.
      await clearVeroSession();
      return null;
    }
    throw error;
  }
}

/**
 * Return a currently-valid Vero access JWT: the cached one if still fresh,
 * otherwise a freshly rotated one. Returns null when there is no session or the
 * refresh token is dead (session is then cleared).
 *
 * The refresh network call is de-duplicated per `(uid, did)` (see client.ts), so
 * simultaneous expiry-triggered refreshes collapse into one rotation. Must be
 * called from a mutable-cookie context (it may rotate + persist tokens).
 */
export async function getVeroAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const cached = cookieStore.get(VERO_ACCESS_COOKIE)?.value;

  if (cached) {
    try {
      const { exp } = decodeJwt(cached);
      if (exp && exp - nowSeconds() > ACCESS_REFRESH_SKEW) {
        return cached;
      }
    } catch {
      // Undecodable cached token — fall through to rotation.
    }
  }

  return rotate();
}

/**
 * The raw access JWT from the cookie, or undefined. Does NOT rotate or touch the
 * network, so it is safe to call from server components (read-only). Best-effort:
 * the token may be near/at expiry — use `getVeroAccessToken` / `withVeroAuth`
 * when you need a guaranteed-valid token for an authenticated API call.
 *
 * This is the seam the Spree SDK bearer token flows through now (see
 * `src/lib/spree/auth-helpers.ts` `getAccessToken`).
 */
export async function peekVeroAccessToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(VERO_ACCESS_COOKIE)?.value;
}

/**
 * Run an authenticated Vero API call with automatic token rotation.
 *
 * Proactively supplies a valid access token; if the API still rejects it as
 * unauthorized (`isUnauthorized`, default = a 401 `status`), it forces one
 * rotation and retries once. A second rejection clears the session and rethrows.
 * This is the integration seam for the future Vero-authenticated SDK — mirrors
 * the legacy Spree `withAuthRefresh`. Must run in a mutable-cookie context.
 */
export async function withVeroAuth<T>(
  fn: (accessToken: string) => Promise<T>,
  isUnauthorized: (error: unknown) => boolean = (error) =>
    (error as { status?: number })?.status === 401,
): Promise<T> {
  const token = await getVeroAccessToken();
  if (!token) {
    throw new VeroAuthError("Not authenticated", 401);
  }

  try {
    return await fn(token);
  } catch (error) {
    if (!isUnauthorized(error)) throw error;

    // Token was rejected despite looking fresh — force a single rotation + retry.
    const rotated = await rotate();
    if (rotated) return await fn(rotated);

    await clearVeroSession();
    throw error;
  }
}

// --- Return-to handling (open-redirect safe) ---

/** True only for same-site absolute paths like `/us/en/checkout` (not `//evil`). */
export function isSafeReturnTo(
  value: string | null | undefined,
): value is string {
  return (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/\\")
  );
}

/** Read + clear the post-login return path. Returns null if unset/unsafe. */
export async function consumeReturnTo(): Promise<string | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(VERO_RETURN_TO_COOKIE)?.value;
  if (value) {
    cookieStore.set(VERO_RETURN_TO_COOKIE, "", { maxAge: -1, path: "/" });
  }
  return isSafeReturnTo(value) ? value : null;
}
