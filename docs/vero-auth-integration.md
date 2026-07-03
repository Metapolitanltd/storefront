## Vero Hosted Login - Auth Code Flow (Integration Guide)

This is a BFF (backend-for-frontend) authorization-code flow. Vero hosts the login UI (passkey / password). Your app never handles Vero credentials - you receive a short-lived opaque code, exchange it server-side for a signed JWT, and verify that JWT against Vero’s public keys.

## Endpoints

| Env | Gateway base URL |
|-----|------------------|
| Dev | https://gateway-dev.veroapi.com |
| Staging | https://gateway-stg.veroapi.com |
| Prod | https://gateway-prd.veroapi.com |

Three endpoints are used:

- GET  /auth?redirect=<your-callback-url> - hosted login page
- POST /veritas/token - exchange code -> JWT (server-side only)
- GET  /veritas/jwks - public signing keys (for JWT verification)

## Flow

Browser            Your app (server)          Vero gateway
   |                     |                          |
   | click "Sign in" --> | redirect to `/auth?redirect=<cb>`            |
   |---------------------------------------------------------------> |
   |                     |        user authenticates (passkey)       |
   | <--- 302 `<cb>?code=<uuid>` ------------------------------------- |
   |---> GET `<cb>?code`   |                          |
   |                     | POST `/veritas/token {code}`  ------------> |
   |                     | <-- 200 {jwt} --------------------------- |
   |                     | verify jwt via `/veritas/jwks` (RS256)      |
   |                     | set your own session, redirect to app     |





### Step 1 - Send the user to the hosted login

Redirect the browser to:

`https://gateway-dev.veroapi.com/auth?redirect=https://your-app.example.com/api/auth/callback`





Your callback origin must be allow-listed by Vero first. Send us the exact origin(s) (scheme + host, e.g. https://your-app.example.com) and we will add them. If the origin is not approved, the gateway will not hand back a code.





### Step 2 - Receive the code on your callback

After the user authenticates, the gateway redirects to:

https://your-app.example.com/api/auth/callback?code=2f1c9e3a-....-....-....-............





The code is:
- an opaque UUID (validate it matches a UUID before use)
- single-use (consumed on first exchange)
- short-lived (~60s TTL) - exchange it immediately

### Step 3 - Exchange the code for a JWT (server-side)

From your backend (NOT the browser), POST the code:

POST `/veritas/token`  HTTP/1.1
Host: `gateway-dev.veroapi.com`
Content-Type: application/json

{ "code": "2f1c9e3a-...." }





Success (200):

{ "jwt": "eyJhbG...compact.JWS...." }





Failure: 401 if the code is missing / invalid / expired / already consumed. Treat any non-200 as “session invalid” and send the user back to sign-in.

Use a short timeout (~5s) and do this strictly server-side - the code is the credential, so it must never round-trip through untrusted client JS.

### Step 4 - Verify the JWT

Fetch Vero’s public keys (this endpoint is public, no auth):

GET `/veritas/jwks`  HTTP/1.1
Host: `gateway-dev.veroapi.com`





Returns a standard JWKS ({ "keys": [ ... ] }). Notes:
- Keys are RS256, use: "sig".
- Match the JWT by kid and alg.
- kids are rotated and date-stamped (e.g. client-20260330-6501f530). Cache the JWKS with a short TTL (~5 min) and re-fetch on an unknown kid so rotation doesn’t break you.
- The user JWT does not set iss / aud - do not enforce issuer/audience checks. Verify signature + expiry, then read the user identity from the uid claim.

### Step 5 - Establish your own session

Once verified, mint your own session (e.g. httpOnly cookie) and authorize the uid however your app requires. Don’t rely on the Vero JWT as your long-lived session token.

Gotchas (the ones that bit us)
1. Server-side exchange only. The code -> JWT exchange is a BFF step. Don’t do it in the browser.
2. Exchange fast. ~60s TTL, single-use. Don’t buffer or retry a consumed code.
3. Allow-list your callback origin with Vero before testing, or you’ll never get a code back.
4. JWKS rotation. Cache short, re-fetch on unknown kid.
5. If your backend runs on Cloudflare Workers: server-side subrequests egress from shared Cloudflare IPs, which can be collateral-blocked by the gateway’s edge WAF. If /veritas/token or /veritas/jwks return a Cloudflare block page instead of JSON, ping us - we maintain a WAF skip-rule for these BFF paths and may need to confirm your egress is covered.

## Quick smoke test

*JWKS should return JSON with RS256 keys*
curl -s `https://gateway-dev.veroapi.com/veritas/jwks` | jq '.keys[] | {kid, alg, use}'

*A bogus code should return 401 (proves the exchange endpoint is reachable)*
curl -s -o /dev/null -w '%{http_code}\n' \
  -X POST `https://gateway-dev.veroapi.com/veritas/token` \
  -H 'Content-Type: application/json' \
  -d '{"code":"00000000-0000-0000-0000-000000000000"}'

Vero Hosted Login - Refresh Tokens (addendum)

The exchange response is more than just the JWT

POST /veritas/token actually returns:

{
  "jwt": "eyJhbG....compact.JWS....",
  "refresh": { "tok": "<ULID>", "exp": 1780000000, "did": "<device-id>" },
  "settings": { ... }
}





- jwt - the access token. Short-lived (minutes). Read its exp claim; once expired, don’t send it - refresh first.
- refresh - the refresh-token triple. Long-lived (~30 days). tok is the secret (a ULID), did is the device id, exp is the refresh-token expiry (unix seconds).
- settings - global app settings blob (optional to use).

/veritas/refresh (below) returns the same shape. Same model applies to your mobile/native logins too - any fresh login response carries this refresh triple.

## Refreshing the access token

When the JWT is near/at expiry, mint a new one server-side:

POST `/veritas/refresh`  HTTP/1.1
Host: gateway-dev.veroapi.com
Content-Type: application/json

{
  "uid": "<user-uuid>",          // the `uid` claim from the current JWT
  "did": "<refresh.did>",        // device id from the last response
  "tok": "<refresh.tok>"         // the refresh-token ULID from the last response
}





Success (200) returns a new { jwt, refresh: {tok, exp, did}, settings }.

Failure (401) means the refresh token is invalid / expired / already used -> send the user back through the hosted login (/auth).

## Rules that matter (these are enforced server-side)

1. Rotation - one use per refresh token. Every successful refresh invalidates the old tok and its whole family for that (uid, did) and issues a brand-new one (RFC 6749 §10.4 / OAuth 2.1). So you must persist the new refresh from each response and discard the old one. Reusing a consumed token = 401 and the session is dead.
2. No parallel refreshes. Because of rotation + reuse-detection, two concurrent refreshes for the same session will kill each other. Serialize refreshes per session (a mutex / single-flight on your backend).
3. Store it server-side. The refresh token is a 30-day credential. Keep it in your backend session store, never in browser-accessible JS. (Same BFF rule as the code exchange.)
4. uid comes from the JWT. Decode the verified JWT and read the uid claim; that’s the value you pass back as uid on refresh.
5. Carry did forward verbatim. Just echo back the did you got in the last response - don’t invent or re-derive it.

## Recommended session model

- On callback: exchange code -> store {refresh.tok, refresh.did} + uid in your server session; set your own httpOnly session cookie to the browser.
- On each request: if the Vero JWT is still valid use it; if expired, POST /veritas/refresh, persist the rotated triple, continue.
- On 401 from refresh: clear session, redirect to /auth.
