# Rural Lodge - Security

## Application Overview

Security-focused checks added after the core functional/error-handling/performance passes,
based on live recon against staging (2026-08-05): response security headers, session cookie
hardening, an open-redirect vector on the auth page's `returnUrl` param, XSS input handling on a
real search field, and whether a protected API endpoint enforces authorization server-side
independently of the client-side route guard. One genuine finding came out of this pass -
DEFECT-2 (session cookies not `HttpOnly`) - documented in `specs/defects/`. Everything else
confirmed the app already behaves safely and is captured as a regression test, not a new bug
report.

## Test Scenarios

### 1. Security

**Seed:** `tests/seed.spec.ts`

#### 1.1. Hardening response headers are present on public and auth pages

**File:** `tests/rural-lodge-test/security/001_security-response-headers.spec.ts`

**Steps:**
  1. Load `/en` and `/en/auth` and inspect the response headers
    - expect: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
      `Strict-Transport-Security` with a `max-age`, and a `Content-Security-Policy` restricting
      `default-src` to `'self'` are all present
    - expect: this is already correctly configured on staging as of 2026-08-05 - the test exists
      to catch a future regression (a loosened CSP, a dropped header during a proxy/CDN change),
      not to report a new finding

#### 1.2. DEFECT: session cookies (AUTH_TOKEN, user) are not HttpOnly

**File:** `tests/rural-lodge-test/security/002_auth-cookies-not-httponly-defect.spec.ts`

**Steps:**
  1. Log in and inspect the resulting cookies
    - expect: `AUTH_TOKEN` and `user` are `Secure` + `SameSite=Lax` (already correct) but NOT
      `HttpOnly` - readable/writable from page JavaScript via `document.cookie`
    - expect: this is a confirmed defense-in-depth gap (see
      `specs/defects/DEFECT-2-auth-cookies-not-httponly.md`) - the test asserts the CORRECT
      expected behavior (`HttpOnly=true`) so it fails until fixed, rather than encoding the gap
      into the assertion

#### 1.3. Open redirect: `returnUrl` cannot forward to an external host

**File:** `tests/rural-lodge-test/security/003_open-redirect-returnurl.spec.ts`

**Steps:**
  1. Navigate to `/en/auth?returnUrl=https://evil.example.com`
    - expect: the app stays on `/en/auth` (its own origin) and never forwards to the external host
    - expect: this is already safe behavior on staging - locked in as a regression test

#### 1.4. XSS: injected HTML/script in a real search field is not reflected unescaped

**File:** `tests/rural-lodge-test/security/004_xss-search-input-sanitization.spec.ts`

**Steps:**
  1. Log in, open the Owner Lodges list, and type `<img src=x onerror=alert(1)>` into the search box
    - expect: no `dialog` event fires (the injected `onerror` handler never executes)
    - expect: the raw payload string is not present verbatim in `document.body.innerHTML` - React's
      default escaping holds up here, confirmed safe on staging, locked in as a regression test

#### 1.5. Unauthenticated direct API call is rejected server-side, independent of the UI route guard

**File:** `tests/rural-lodge-test/security/005_unauthenticated-api-rejects-without-leaking-data.spec.ts`

**Steps:**
  1. With all cookies cleared, call the `booking.getBookings` tRPC endpoint directly via `fetch`
    - expect: HTTP 401 with an `UNAUTHORIZED` error body, and no booking data in the response
    - expect: this confirms DEFECT-1 (`specs/defects/DEFECT-1-protected-route-after-logout.md`) is
      specifically a client-side/UX bug (the dashboard shell doesn't redirect) - the server-side
      authorization boundary itself is already correct and is locked in here as a regression test
