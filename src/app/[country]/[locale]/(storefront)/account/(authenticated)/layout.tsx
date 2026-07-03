import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthenticatedAccountShell } from "@/components/account/AuthenticatedAccountShell";
import { REQUEST_PATHNAME_HEADER, REQUEST_SEARCH_HEADER } from "@/i18n/routing";
import {
  buildAccountLoginHref,
  resolveAccountRedirect,
} from "@/lib/utils/account-redirect";
import { readVeroSession } from "@/lib/vero/session";

interface AuthenticatedAccountLayoutProps {
  children: React.ReactNode;
  params: Promise<{ country: string; locale: string }>;
}

export default function AuthenticatedAccountLayout(
  props: AuthenticatedAccountLayoutProps,
) {
  return (
    <Suspense fallback={null}>
      <AuthenticatedAccountLayoutContent {...props} />
    </Suspense>
  );
}

export async function AuthenticatedAccountLayoutContent({
  children,
  params,
}: AuthenticatedAccountLayoutProps) {
  const [{ country, locale }, requestHeaders, session] = await Promise.all([
    params,
    headers(),
    readVeroSession(),
  ]);

  const basePath = `/${country}/${locale}`;
  const pathname = requestHeaders.get(REQUEST_PATHNAME_HEADER);
  const search = requestHeaders.get(REQUEST_SEARCH_HEADER);
  const requestedPath = `${pathname ?? ""}${search?.startsWith("?") ? search : ""}`;
  const returnTo = resolveAccountRedirect(requestedPath, basePath);
  const loginHref = buildAccountLoginHref(basePath, returnTo);

  // `readVeroSession` resolves an identity from the Vero access JWT, or from the
  // refresh cookie once that short-lived JWT has expired — a recoverable session
  // the client session check rotates in a cookie-writable context. No identity
  // at all means the customer is anonymous.
  if (!session) redirect(loginHref);

  return (
    <AuthenticatedAccountShell loginHref={loginHref}>
      {children}
    </AuthenticatedAccountShell>
  );
}
