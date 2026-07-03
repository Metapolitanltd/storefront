import { type NextRequest, NextResponse } from "next/server";
import {
  buildCallbackUrl,
  buildHostedLoginUrl,
  getSiteUrl,
  isVeroConfigured,
  RETURN_TO_MAX_AGE,
  VERO_RETURN_TO_COOKIE,
} from "@/lib/vero/config";
import { isSafeReturnTo } from "@/lib/vero/session";

/**
 * Login initiation (BFF step 1). Redirects the browser to Vero's hosted login,
 * stashing a same-site `returnTo` path so the callback can send the user back
 * where they started (Vero only echoes `?code`, not arbitrary state).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const returnTo = request.nextUrl.searchParams.get("returnTo");

  if (!isVeroConfigured()) {
    return NextResponse.redirect(
      new URL("/?error=auth_unconfigured", request.url),
    );
  }

  // Callback origin: a configured canonical SITE_URL, else the actual request
  // origin (so it works without extra env, and matches the allow-listed origin).
  const origin = getSiteUrl() || request.nextUrl.origin;
  const hostedLoginUrl = buildHostedLoginUrl(buildCallbackUrl(origin));
  const response = NextResponse.redirect(hostedLoginUrl);

  if (isSafeReturnTo(returnTo)) {
    response.cookies.set(VERO_RETURN_TO_COOKIE, returnTo, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: RETURN_TO_MAX_AGE,
    });
  }

  return response;
}
