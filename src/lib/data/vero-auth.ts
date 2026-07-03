"use server";

import { updateTag } from "next/cache";
import { clearCartCookies } from "@/lib/spree";
import { clearVeroSession, readVeroSession } from "@/lib/vero/session";
import type { VeroSession } from "@/lib/vero/types";

/**
 * Return the current signed-in identity, or null. Reads identity from the Vero
 * access JWT (httpOnly cookie); if that token is missing/expired it falls back
 * to the identity stored in the refresh cookie (no network call, no rotation).
 * No tokens or secrets cross the client boundary — only the resolved identity.
 */
export async function getVeroSession(): Promise<VeroSession | null> {
  return readVeroSession();
}

/**
 * Clear the local session and detach the guest cart. The Vero refresh token is
 * single-use and rotates server-side, so there's no remote logout endpoint to
 * call — dropping our cookies is sufficient. Any subsequent Vero refresh with
 * the stale triple 401s.
 */
export async function veroLogout(): Promise<void> {
  await clearVeroSession();
  await clearCartCookies();
  updateTag("customer");
  updateTag("cart");
  updateTag("addresses");
  updateTag("credit-cards");
}
