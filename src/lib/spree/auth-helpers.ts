import type { RequestOptions } from "@spree/sdk";
import { peekVeroAccessToken, withVeroAuth } from "@/lib/vero/session";

/**
 * The current user's bearer token for Spree SDK calls — now the Vero access JWT.
 *
 * Read-only (no rotation), so it is safe in server components. Returns undefined
 * for guests. This is the same seam the Spree access token used to flow through;
 * only the source changed — Vero owns identity and token rotation now.
 */
export async function getAccessToken(): Promise<string | undefined> {
  return peekVeroAccessToken();
}

/**
 * Execute an authenticated Spree SDK call with the Vero JWT injected as the
 * bearer token, rotating the Vero token on a 401 and retrying once.
 *
 * Mirrors the old Spree `withAuthRefresh` signature — callers still receive
 * `RequestOptions` (`{ token }`) — but the token, and its refresh/rotation, come
 * from the Vero session via `withVeroAuth`. `withVeroAuth`'s default 401 check
 * (`error.status === 401`) already matches `SpreeError`. Must run in a
 * mutable-cookie context (server action or route handler) since a rotation
 * writes cookies.
 */
export async function withAuthRefresh<T>(
  fn: (options: RequestOptions) => Promise<T>,
): Promise<T> {
  return withVeroAuth((token) => fn({ token }));
}
