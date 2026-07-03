/**
 * Auth-provider selection flag.
 *
 * Toggles the account section between the new Vero hosted-login (BFF) flow and
 * the legacy Spree SDK auth. Public (build-time inlined) so both server and
 * client components can branch on it. Defaults to `vero`.
 *
 *   NEXT_PUBLIC_AUTH_PROVIDER=vero   # Vero hosted login (default)
 *   NEXT_PUBLIC_AUTH_PROVIDER=spree  # legacy Spree email/password
 */
export type AuthProvider = "vero" | "spree";

export const AUTH_PROVIDER: AuthProvider =
  process.env.NEXT_PUBLIC_AUTH_PROVIDER === "spree" ? "spree" : "vero";

export function isVeroAuth(): boolean {
  return AUTH_PROVIDER === "vero";
}
