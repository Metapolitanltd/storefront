import "server-only";

import { VERO_REFRESH_URL, VERO_TOKEN_URL } from "./config";
import type { VeroRefresh, VeroTokenResponse } from "./types";

/** Thrown when a Vero gateway call fails (non-2xx or network/timeout). */
export class VeroAuthError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "VeroAuthError";
    this.status = status;
  }
}

const REQUEST_TIMEOUT_MS = 5000;

async function postJson(
  url: string,
  body: unknown,
): Promise<VeroTokenResponse> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    // Timeout / DNS / connection error — treat as an invalid session upstream.
    throw new VeroAuthError(
      error instanceof Error ? error.message : "Vero gateway unreachable",
      0,
    );
  }

  if (!res.ok) {
    throw new VeroAuthError(`Vero gateway returned ${res.status}`, res.status);
  }

  const data = (await res.json()) as VeroTokenResponse;
  if (!data?.jwt || !data?.refresh?.tok) {
    throw new VeroAuthError("Malformed Vero token response", res.status);
  }
  return data;
}

/**
 * Exchange a single-use authorization code for a JWT + refresh triple.
 * Server-side only — the code is the credential and must never touch the client.
 */
export async function exchangeCode(code: string): Promise<VeroTokenResponse> {
  return postJson(VERO_TOKEN_URL, { code });
}

/**
 * In-flight refresh promises keyed by `uid:did` (one logical session).
 *
 * Vero rotates the refresh token on every use and runs reuse-detection: two
 * concurrent refreshes for the same session would invalidate each other. We
 * therefore single-flight per session so simultaneous 401s (from multiple
 * client tabs or parallel server requests) collapse into ONE network refresh
 * and all callers await the same rotated result.
 *
 * NOTE: this dedupe is per-process. A multi-instance deployment would need a
 * distributed lock to fully serialize refreshes across instances.
 */
const inFlightRefreshes = new Map<string, Promise<VeroTokenResponse>>();

/**
 * Refresh the access token, rotating the refresh triple. De-duplicated per
 * `(uid, did)` session. Callers MUST persist the returned rotated triple and
 * discard the old one.
 */
export async function refreshVeroTokens(input: {
  uid: string;
  refresh: VeroRefresh;
}): Promise<VeroTokenResponse> {
  const { uid, refresh } = input;
  const key = `${uid}:${refresh.did}`;

  const existing = inFlightRefreshes.get(key);
  if (existing) return existing;

  const promise = postJson(VERO_REFRESH_URL, {
    uid,
    did: refresh.did,
    tok: refresh.tok,
  }).finally(() => {
    inFlightRefreshes.delete(key);
  });

  inFlightRefreshes.set(key, promise);
  return promise;
}
