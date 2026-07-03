/**
 * Vero hosted-login (BFF) configuration.
 *
 * Values are read LAZILY (functions, not module-eval constants) from RUNTIME env
 * The sensitive pieces (session secret, JWKS verification, token exchange) live
 * in the `server-only` sibling modules: `session.ts`, `jwks.ts`, `client.ts`.
 */

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

/** Vero gateway base URL, e.g. https://gateway-dev.veroapi.com (server-only). */
function baseUrl(): string {
  return trimTrailingSlash(process.env.NEXT_PUBLIC_VERO_BASE_URL ?? "");
}

/**
 * Canonical site origin, if configured — else empty so callers fall back to the
 * incoming request's origin. Accepts a runtime `SITE_URL` or a build-time
 * `NEXT_PUBLIC_SITE_URL`.
 */
export function getSiteUrl(): string {
  return trimTrailingSlash(
    process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "",
  );
}

/**
 * Callback path registered with Vero. Global (non-locale) API route, e.g.
 * `/api/auth/vero/callback`. Locale is carried through the `returnTo` cookie.
 */
export function veroAuthCbPath(): string {
  return process.env.NEXT_PUBLIC_VERO_AUTH_CB ?? "/api/auth/vero/callback";
}

/** Global login-initiation route. Pass a `?returnTo=` locale-aware path. */
export const VERO_LOGIN_PATH = "/api/auth/vero/login";

// --- Gateway endpoints (see docs/vero-auth-integration.md) ---

/** Server-side code → JWT exchange endpoint. */
export function veroTokenUrl(): string {
  return `${baseUrl()}/veritas/token`;
}

/** Server-side access-token refresh endpoint. */
export function veroRefreshUrl(): string {
  return `${baseUrl()}/veritas/refresh`;
}

/** Public JWKS endpoint for RS256 signature verification. */
export function veroJwksUrl(): string {
  return `${baseUrl()}/veritas/jwks`;
}

/** Hosted login page URL for a given callback. */
export function buildHostedLoginUrl(callbackUrl: string): string {
  return `${baseUrl()}/auth?redirect=${encodeURIComponent(callbackUrl)}`;
}

/**
 * Absolute callback URL. `origin` is the public site origin — the login route
 * passes `getSiteUrl()` when set, otherwise the incoming request's origin.
 */
export function buildCallbackUrl(origin: string): string {
  return `${trimTrailingSlash(origin)}${veroAuthCbPath()}`;
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

/** True once the required gateway base URL is configured. */
export function isVeroConfigured(): boolean {
  return baseUrl().length > 0;
}
