/**
 * Shared Vero auth types. Safe to import from server or client.
 */

/** The refresh-token triple returned by `/veritas/token` and `/veritas/refresh`. */
export interface VeroRefresh {
  /** Secret ULID — one use per token (rotated on every refresh). */
  tok: string;
  /** Refresh-token expiry (unix seconds). */
  exp: number;
  /** Device id — echoed back verbatim on refresh. */
  did: string;
}

/** Full response body of `/veritas/token` and `/veritas/refresh`. */
export interface VeroTokenResponse {
  /** Access token (JWT). Short-lived — read its `exp` claim. */
  jwt: string;
  refresh: VeroRefresh;
  /** Optional global settings blob. */
  settings?: unknown;
}

/** Claims carried by a Vero access JWT (RS256). */
export interface VeroJwtClaims {
  /** User identity (UUID). The integration guide guarantees this claim. */
  uid: string;
  /** Username; may be an empty string (e.g. passkey-only accounts). */
  username?: string;
  /** Gateway origin that issued the token. */
  origin?: string;
  /** Session id (ULID). */
  sid?: string;
  /** How this session authenticated, e.g. "passkey". */
  loginMethod?: string;
  primaryLoginMethod?: string;
  /** Unix seconds of the last strong (re)authentication. */
  lastStrongAuthAt?: number;
  /** Issuer, e.g. "vero-gateway". */
  iss?: string;
  /** Audience, e.g. "vero-clients". */
  aud?: string;
  /** Issued-at (unix seconds). */
  iat?: number;
  /** Access-token expiry (unix seconds). */
  exp?: number;
  /** Not currently emitted by Vero; surfaced opportunistically if added later. */
  email?: string;
  [claim: string]: unknown;
}

/**
 * Resolved identity for the app. Derived from the Vero JWT / refresh cookie —
 * `uid` is always present; `username`/`email` only when Vero provides them.
 */
export interface VeroSession {
  uid: string;
  username?: string;
  email?: string;
}
