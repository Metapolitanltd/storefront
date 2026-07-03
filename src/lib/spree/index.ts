// Configuration

// Auth helpers — the Vero access JWT is injected into the Spree SDK here.
export { getAccessToken, withAuthRefresh } from "./auth-helpers";
export { getClient, getConfig, initSpreeNext } from "./config";
// Cookie management (cart token/ID)
export {
  clearCartCookies,
  getCartId,
  getCartOptions,
  getCartToken,
  requireCartId,
  setCartCookies,
} from "./cookies";
// Locale resolution (reads country/locale from cookies)
export { getLocaleOptions } from "./locale";
export type { SpreeNextConfig, SpreeNextOptions } from "./types";
