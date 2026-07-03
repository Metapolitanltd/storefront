"use server";

import { clearVeroSession, readVeroSession } from "@/lib/vero/session";
import type { VeroSession } from "@/lib/vero/types";

/**
 * Return the current signed-in identity, or null. Reads identity from the Vero
 * access JWT (httpOnly cookie); if that token is missing/expired it silently
 * refreshes (with rotation) from the refresh token server-side. No tokens or
 * secrets cross the client boundary — only the resolved identity does.
 */
export async function getVeroSession(): Promise<VeroSession | null> {
  return readVeroSession();
}

/**
 * Clear the local session. The Vero refresh token is single-use and rotates
 * server-side, so there's no remote logout endpoint to call here — dropping our
 * cookies is sufficient. Any subsequent Vero refresh with the stale triple 401s.
 */
export async function veroLogout(): Promise<void> {
  await clearVeroSession();
}
