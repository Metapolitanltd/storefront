"use server";

import { updateTag } from "next/cache";
import { cacheTagSuffix, clearAllCartCookies, SURFACES } from "@/lib/spree";
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
  // Clear every surface's cart — the wholesale cart lives in its own cookie
  // pair and cache tag, so a DTC-only clear would leave it behind for the
  // next session.
  await clearAllCartCookies();
  updateTag("customer");
  // Invalidate both the cart and the checkout (address/delivery) caches for
  // every surface — checkout state is tagged separately, so a cart-only clear
  // would leave the previous buyer's checkout data cached after logout.
  for (const surface of SURFACES) {
    updateTag(`cart${cacheTagSuffix(surface)}`);
    updateTag(`checkout${cacheTagSuffix(surface)}`);
  }
  updateTag("addresses");
  updateTag("credit-cards");
}
