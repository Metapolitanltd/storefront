import "server-only";

import { createRemoteJWKSet, jwtVerify } from "jose";
import { veroJwksUrl } from "./config";
import type { VeroJwtClaims } from "./types";

/**
 * Remote JWKS set for verifying Vero access tokens.
 *
 * `createRemoteJWKSet` caches keys in-process and, per the integration guide,
 * transparently re-fetches when it encounters an unknown `kid` — so key rotation
 * (kids are date-stamped and rotated) doesn't break verification.
 */
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks(): ReturnType<typeof createRemoteJWKSet> {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(veroJwksUrl()), {
      cacheMaxAge: 5 * 60 * 1000, // 5 min — matches the doc's suggested TTL
      cooldownDuration: 30 * 1000, // throttle re-fetches on unknown kid
    });
  }
  return jwks;
}

/**
 * Verify a Vero access JWT's RS256 signature + expiry and return its claims.
 *
 * The user JWT sets no enforced `iss` / `aud` contract, so we verify signature +
 * expiry only, then read identity from `uid`.
 *
 * @throws if the signature is invalid, the token is expired, or `uid` is absent.
 */
export async function verifyVeroJwt(jwt: string): Promise<VeroJwtClaims> {
  const { payload } = await jwtVerify(jwt, getJwks(), {
    algorithms: ["RS256"],
  });

  if (typeof payload.uid !== "string" || payload.uid.length === 0) {
    throw new Error("Vero JWT is missing the `uid` claim");
  }

  return payload as VeroJwtClaims;
}
