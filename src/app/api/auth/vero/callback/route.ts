import { updateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { associateGuestCart } from "@/lib/data/cart";
import { exchangeCode } from "@/lib/vero/client";
import { verifyVeroJwt } from "@/lib/vero/jwks";
import { consumeReturnTo, establishVeroSession } from "@/lib/vero/session";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DEFAULT_COUNTRY = process.env.NEXT_PUBLIC_DEFAULT_COUNTRY ?? "us";
const DEFAULT_LOCALE = process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? "en";

/** Locale-aware account URL, derived from the proxy-set locale cookies. */
function accountFallback(request: NextRequest, error?: string): URL {
  const country =
    request.cookies.get("spree_country")?.value ?? DEFAULT_COUNTRY;
  const locale = request.cookies.get("spree_locale")?.value ?? DEFAULT_LOCALE;
  const suffix = error ? `?error=${error}` : "";
  return new URL(`/${country}/${locale}/account${suffix}`, request.url);
}

/**
 * Callback (BFF steps 2–5). Receives the single-use `code`, exchanges it for a
 * JWT server-side, verifies the JWT against Vero's JWKS, establishes our own
 * session, and redirects the user back into the app.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get("code");

  if (!code || !UUID_RE.test(code)) {
    return NextResponse.redirect(accountFallback(request, "invalid_code"));
  }

  try {
    const tokens = await exchangeCode(code);
    const claims = await verifyVeroJwt(tokens.jwt);
    await establishVeroSession(claims, tokens);

    // Attach any guest cart to the now-authenticated user (Vero JWT injected).
    await associateGuestCart();

    // Identity just changed — drop identity-scoped caches so the post-login
    // pages render as the authenticated user (parity with the old finalizeAuth;
    // symmetric with veroLogout).
    updateTag("customer");
    updateTag("cart");

    const returnTo = await consumeReturnTo();
    const destination = returnTo
      ? new URL(returnTo, request.url)
      : accountFallback(request);
    return NextResponse.redirect(destination);
  } catch {
    // Any failure (expired/consumed code, bad signature, gateway down) → sign in.
    await consumeReturnTo(); // drop the stale return path
    return NextResponse.redirect(accountFallback(request, "auth_failed"));
  }
}
