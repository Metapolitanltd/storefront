# VERO Auth - Web Client Integration Guide

This document explains how a third-party web app integrates with the VERO authentication flow hosted by the Vero API Gateway (codename **Morannon**).

It covers:

1. The end-to-end auth flow.
2. The `?redirect=` query parameter (what to send, what is rejected).
3. How the JWT lands in your app after a successful login.
4. The whitelisting request you need to send to Vero backend engineers before going live.

---

## 1. Flow Overview

1. Your app needs an authenticated user.
2. You redirect the browser to the VERO login page hosted at:
    ```
    https://<vero-gateway-host>/auth?redirect=<your-callback-url>
    ```
3. The user authenticates (SRP password and/or WebAuthn passkey) on Vero's domain.
4. On success, Vero redirects the browser back to your callback URL, appending the JWT as a **URL fragment**:
    ```
    https://app.example.com/oauth/callback#jwt=<encoded-jwt>
    ```
5. Your callback page reads `location.hash`, extracts the JWT, and uses it as the user's session credential.

The JWT is delivered as `#jwt=` (fragment, not query string) so the token never enters server access logs.

### 1.1 Gateway Base URLs by Environment

| Environment | Base URL |
|-------------|----------|
| Development | `https://gateway-dev.veroapi.com` |
| Staging     | `https://gateway-stg.veroapi.com` |
| Production  | `https://gateway.veroapi.com` |

Append `/auth?redirect=<your-callback-url>` to the base URL of the target environment.

---

## 2. The `redirect` Query Parameter

### 2.1 What to Send

Pass a fully-qualified HTTPS URL as the value of `?redirect=`.

```
https://<vero-gateway-host>/auth?redirect=https%3A%2F%2Fapp.example.com%2Foauth%2Fcallback
```

**URL-encode the value** (`encodeURIComponent` in JS) before appending it to the gateway URL.

### 2.2 Validation Rules

The gateway runs a strict validator (`isAllowedRedirect`) on every request. Your URL is rejected unless it satisfies **ALL** of the following:

| # | Rule | Failure reason |
|---|------|----------------|
| 1 | Non-empty string | `empty` |
| 2 | Parses with `new URL()` | `invalid_url` |
| 3 | Scheme is **exactly** `https:` (no `http:`, no protocol-relative, no `javascript:`, no `data:`) | `bad_scheme` |
| 4 | No userinfo segment - the URL must NOT contain `user:pass@` | `userinfo` |
| 5 | Hostname does NOT end with `.` (no trailing-dot FQDNs) | `trailing_dot` |
| 6 | Origin is not opaque (`null`) | `opaque_origin` |
| 7 | The URL's **`origin`** (scheme + host + port) exactly matches an entry in Vero's server-side allowlist | `not_allowlisted` |
| 8 | The allowlist is configured and non-empty for this environment | `disabled` |

The match in rule 7 is on `URL.origin` only - **the path, query string, and fragment of your redirect URL are NOT compared** against the allowlist. They are preserved and forwarded.

### 2.3 Examples

| Redirect value | Result |
|----------------|--------|
| `https://app.example.com/oauth/callback` | OK (if origin allowlisted) |
| `https://app.example.com/oauth/callback?state=xyz` | OK - path and query preserved |
| `http://app.example.com/oauth/callback` | Rejected: `bad_scheme` |
| `https://app.example.com./oauth/callback` | Rejected: `trailing_dot` |
| `https://attacker@app.example.com/cb` | Rejected: `userinfo` |
| `https://staging.example.com/cb` (if not in allowlist) | Rejected: `not_allowlisted` |
| `//app.example.com/cb` | Rejected: `invalid_url` (no scheme) |

### 2.4 What Happens on Rejection

The login page still renders. The user can still authenticate. But after a successful login the page falls back to **same-origin redirect only** (i.e. it does NOT redirect to your app). The JWT will not reach you.

You get NO error response from `/auth` - the validation happens silently and is surfaced only via the absence of the `<meta name="auth-redirect-origin">` tag in the served HTML. Plan for this by sanity-checking the redirect URL on your side before sending users to `/auth`.

---

## 3. Receiving the JWT on Your Callback Page

When the redirect is approved, the user's browser lands on:

```
https://app.example.com/oauth/callback#jwt=<url-encoded-jwt>
```

If your redirect URL already had a fragment (e.g. `https://app.example.com/cb#existing`), the gateway replaces it cleanly using `URL.hash` semantics - you receive `#jwt=<token>` only, no `#existing#jwt=...` concatenation.

### 3.1 Minimal Callback Implementation

```html
<!doctype html>
<html>
<head><meta charset="utf-8"><title>Authenticating...</title></head>
<body>
<script>
(function () {
  // Read the fragment (everything after '#'), strip the leading '#'.
  const hash = window.location.hash.replace(/^#/, '');
  const params = new URLSearchParams(hash);
  const jwt = params.get('jwt');

  if (!jwt) {
    // No JWT in fragment - either the user came here without going through /auth,
    // or the redirect was rejected by the gateway validator.
    window.location.replace('/login-failed');
    return;
  }

  // 1) Store the JWT however your app expects it (cookie, IndexedDB, in-memory).
  //    The example below sets a same-site cookie. Use Secure in production.
  document.cookie =
    'veropass=' + encodeURIComponent(jwt) +
    ';path=/;SameSite=Strict;Secure';

  // 2) Wipe the fragment from the URL so the JWT does not linger in the address
  //    bar / browser history.
  history.replaceState(null, '', window.location.pathname + window.location.search);

  // 3) Continue into the app.
  window.location.replace('/');
})();
</script>
</body>
</html>
```

### 3.2 Security Notes for the Callback Page

- **Always serve the callback over HTTPS.** The gateway enforces HTTPS on its side; you must not break that on yours.
- **Strip the fragment immediately** after reading it (`history.replaceState`). Fragments persist in browser history and can leak via screen-share, screenshots, and some browser extensions.
- **Do NOT log the JWT** server-side. It is delivered in the URL fragment specifically so it stays out of HTTP server access logs - keep that property.
- **Validate the JWT** against the Vero issuer / audience your service is configured for before trusting any claims.

---

## 4. Whitelisting Request to Vero Backend Engineers

Before your integration works in any environment, the Vero backend team must add your callback **origin** to the gateway's `AUTH_REDIRECT_ALLOWED_ORIGINS_JSON` allowlist for that environment.

Send a request containing the information below. One line per environment you need.

### 4.1 Information to Provide

| Field | Required | Example |
|-------|----------|---------|
| Project / Team name | Yes | `acme-partner-portal` |
| Contact email | Yes | `eng@acme.example.com` |
| Environment | Yes | `dev`, `staging`, `production` |
| Full callback URL | Yes | `https://app.acme.example.com/oauth/callback` |
| **Origin to whitelist** (derived from the URL above) | Yes | `https://app.acme.example.com` |
| Expected traffic volume | Optional | `~5k logins/day` |
| Go-live date | Optional | `2026-06-15` |

### 4.2 Whitelist Format Constraints

What the backend team will actually add to the env variable:

- **Origin only** - scheme + host + optional non-default port. **No path, no query, no fragment, no trailing slash.**
    - Right: `https://app.example.com`
    - Right: `https://app.example.com:8443`
    - Wrong: `https://app.example.com/`
    - Wrong: `https://app.example.com/oauth/callback`
    - Wrong: `app.example.com` (missing scheme)
    - Wrong: `http://app.example.com` (HTTPS only)
- **Each subdomain is a distinct origin.** `https://app.example.com` does **NOT** cover `https://staging.app.example.com`. Request each subdomain explicitly.
- **Ports matter.** `https://app.example.com` does NOT cover `https://app.example.com:8443`.
- **No wildcards.** The validator uses exact-string equality on `URL.origin`. There is no support for `*.example.com` patterns by design (defense against subdomain-takeover open-redirects).

### 4.3 How to Request Whitelisting

Ping **@antoine** on Slack with the information from 4.1. Example message:

```
@antoine - VERO auth redirect whitelist request for acme-partner-portal

Please add the following origins to AUTH_REDIRECT_ALLOWED_ORIGINS_JSON:

  dev         https://dev.app.acme.example.com
  staging     https://staging.app.acme.example.com
  production  https://app.acme.example.com

Full callback URLs (for context, NOT what to whitelist):
  dev         https://dev.app.acme.example.com/oauth/callback
  staging     https://staging.app.acme.example.com/oauth/callback
  production  https://app.acme.example.com/oauth/callback

Contact: eng@acme.example.com
Go-live: 2026-06-15
```
