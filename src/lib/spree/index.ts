// Configuration

// Auth helpers — the Vero access JWT is injected into the Spree SDK here.
export { getAccessToken, withAuthRefresh } from "./auth-helpers";
export {
  getClient,
  getClientForSurface,
  getConfig,
  getWholesaleChannelCode,
  getWholesaleClient,
  initSpreeNext,
  isWholesaleEnabled,
} from "./config";
// Cookie management (cart token/ID)
export {
  clearAllCartCookies,
  clearCartCookies,
  getCartId,
  getCartOptions,
  getCartToken,
  isPoisonedDtcCartId,
  requireCartId,
  setCartCookies,
} from "./cookies";
// JWT helpers (expiry inspection, no signature verification)
export { decodeJwtExp, isJwtExpired } from "./jwt";
// Locale resolution (reads country/locale from cookies)
export { getLocaleOptions } from "./locale";
// Surface (DTC vs wholesale sales context)
export {
  cacheTagSuffix,
  cartCookieBaseName,
  DEFAULT_SURFACE,
  SURFACES,
  type Surface,
} from "./surface";
export type { SpreeNextConfig, SpreeNextOptions } from "./types";
