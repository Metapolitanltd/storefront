/**
 * Vero hosted-login (BFF) configuration.
 *
 * This module is intentionally free of secrets and Node-only APIs so it is safe
 * to import from either the server or the client. It only reads `NEXT_PUBLIC_*`
 * env vars and exposes URL builders + cookie names shared across the flow.
 *
 * The sensitive pieces (session secret, JWKS verification, token exchange) live
 * in the `server-only` sibling modules: `session.ts`, `jwks.ts`, `client.ts`.
 */

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

/** Vero gateway base URL, e.g. https://gateway-dev.veroapi.com */
export const VERO_BASE_URL = trimTrailingSlash(
  process.env.NEXT_PUBLIC_VERO_BASE_URL ?? "",
);

/** Public site origin used to build the absolute callback URL. */
export const SITE_URL = trimTrailingSlash(
  process.env.NEXT_PUBLIC_SITE_URL ?? "",
);

/**
 * Callback path registered with Vero. This is a global (non-locale) API route,
 * e.g. `/api/auth/vero/callback`. Locale context is carried through the
 * `returnTo` cookie, not the URL.
 */
export const VERO_AUTH_CB_PATH =
  process.env.NEXT_PUBLIC_VERO_AUTH_CB ?? "/api/auth/vero/callback";

/** Global login-initiation route. Pass a `?returnTo=` locale-aware path. */
export const VERO_LOGIN_PATH = "/api/auth/vero/login";

// --- Gateway endpoints (see docs/vero-auth-integration.md) ---

/** Hosted login page URL for a given callback. */
export function buildHostedLoginUrl(callbackUrl: string): string {
  return `${VERO_BASE_URL}/auth?redirect=${encodeURIComponent(callbackUrl)}`;
}

/** Server-side code → JWT exchange endpoint. */
export const VERO_TOKEN_URL = `${VERO_BASE_URL}/veritas/token`;

/** Server-side access-token refresh endpoint. */
export const VERO_REFRESH_URL = `${VERO_BASE_URL}/veritas/refresh`;

/** Public JWKS endpoint for RS256 signature verification. */
export const VERO_JWKS_URL = `${VERO_BASE_URL}/veritas/jwks`;

/** Absolute callback URL, e.g. https://localhost:3001/api/auth/vero/callback */
export function buildCallbackUrl(): string {
  return `${SITE_URL}${VERO_AUTH_CB_PATH}`;
}

// --- Cookie names ---

/**
 * The Vero access JWT. Identity (`uid`) is read from its claims; this is the
 * "am I logged in" signal. Cookie lifetime tracks the JWT's own `exp`.
 */
export const VERO_ACCESS_COOKIE = "vero_access";
/**
 * Encrypted Vero refresh triple (`{ uid, did, tok, exp }`). Outlives the access
 * token; used server-side to mint a fresh access JWT (with rotation) on expiry.
 */
export const VERO_REFRESH_COOKIE = "vero_refresh";
/** Short-lived post-login return path. */
export const VERO_RETURN_TO_COOKIE = "vero_return_to";

// --- Cookie / token lifetimes (seconds) ---

// Cookie lifetimes are derived from the token/refresh `exp` claims; these are
// only fallbacks used when an `exp` is absent.
export const ACCESS_FALLBACK_MAX_AGE = 60 * 5; // 5 min
export const REFRESH_FALLBACK_MAX_AGE = 60 * 60 * 24 * 30; // ~30 days
export const RETURN_TO_MAX_AGE = 60 * 10; // 10 minutes

/** Refresh the access JWT this many seconds before its `exp`. */
export const ACCESS_REFRESH_SKEW = 30;

/** True once the required public config is present. */
export function isVeroConfigured(): boolean {
  return VERO_BASE_URL.length > 0 && SITE_URL.length > 0;
}
