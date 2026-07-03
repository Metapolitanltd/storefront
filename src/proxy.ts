import { SUPPORTED_LOCALES } from "@/i18n/locales";
import { createSpreeMiddleware } from "@/lib/spree/middleware";
import { getDefaultCountry, getDefaultLocale } from "@/lib/store";
import { VERO_ACCESS_COOKIE, VERO_REFRESH_COOKIE } from "@/lib/vero/config";

export const proxy = createSpreeMiddleware({
  defaultCountry: getDefaultCountry(),
  defaultLocale: getDefaultLocale(),
  supportedLocales: SUPPORTED_LOCALES,
  // Auth is Vero-only: protected account routes recognise a session by the Vero
  // access/refresh cookies, not Spree's `_spree_jwt` / `_spree_refresh_token`.
  accessTokenCookieName: VERO_ACCESS_COOKIE,
  refreshTokenCookieName: VERO_REFRESH_COOKIE,
});

export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|.*\\..*$).*)"],
};
