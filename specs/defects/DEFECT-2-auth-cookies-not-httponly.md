# DEFECT-2: Session cookies (`AUTH_TOKEN`, `user`) are not marked `HttpOnly`

| Field | Value |
|---|---|
| **Status** | Confirmed, open (not fixed) |
| **Severity** | High (a real, valid bearer JWT was confirmed extractable via `document.cookie` — see Impact) |
| **Component** | Auth cookie issuance — `AUTH_TOKEN` and `user` cookies set on login |
| **Environment** | https://staging-ruralloge.allweb.cloud (staging) |
| **First found** | 2026-08-05, security-focused exploratory testing |
| **Automated regression test** | `tests/rural-lodge-test/security/002_auth-cookies-not-httponly-defect.spec.ts` |
| **Reproduction rate** | 100% — reproduces on every login |
| **Related** | `DEFECT-1-protected-route-after-logout.md` — that defect's root cause is a stale `user` cookie surviving logout; this defect is about the same cookie's `HttpOnly` flag, a separate but adjacent issue |

---

## Summary

After logging in, both cookies the app uses to represent an authenticated session —
`AUTH_TOKEN` (the real session token the tRPC data layer reads) and `user` (a client-side info
cookie, already implicated in DEFECT-1) — are set **without the `HttpOnly` flag**. Both are
`Secure` and `SameSite=Lax`, but readable and writable from any JavaScript running on the page via
`document.cookie`.

## Steps to Reproduce

### 1. Open a fresh browser session and log in

Navigate to `/en/auth` and log in with a valid account (`TEST_USER_EMAIL` /
`TEST_USER_PASSWORD`). Wait for the redirect off `/auth` (to the public home page, per the
documented login flow in `user-stories/SCRUM.md`).

### 2. Open DevTools -> Application -> Cookies for this origin

Select `https://staging-ruralloge.allweb.cloud` under Cookies. Four cookies are present:
`theme`, `AUTH_TOKEN`, `user`, `NEXT_LOCALE`.

**Actual:** every row's `HttpOnly` column is unchecked, including `AUTH_TOKEN` and `user`:

```
theme:        httpOnly=false  secure=false  sameSite=Lax
AUTH_TOKEN:   httpOnly=false  secure=true   sameSite=Lax
user:         httpOnly=false  secure=true   sameSite=Lax
NEXT_LOCALE:  httpOnly=false  secure=false  sameSite=Lax
```

**Expected:** `AUTH_TOKEN` and `user` — the two cookies that carry session/identity state — should
show `HttpOnly` checked, so they are still sent with requests but are never exposed to page
JavaScript. `theme` and `NEXT_LOCALE` are plain UI preferences with no sensitive value, so their
lack of `HttpOnly`/`Secure` is not part of this defect.

### 3. Confirm from the page's own JavaScript context, not just the DevTools inspector

The DevTools cookie table can show a cookie exists without proving script access. The decisive
check is to open the Console (same authenticated tab) and run:

```js
document.cookie
```

**Actual:** the full cookie string comes back, including the live `AUTH_TOKEN` value and the
entire `user` payload, verbatim:

```
theme=public; AUTH_TOKEN=<redacted>; user={"id":"...","email":"...","firstName":"...","lastName":"...","role":"public","channel":"...","st":"<redacted JWT>"}; NEXT_LOCALE=en
```

A cookie that is genuinely `HttpOnly` never appears in `document.cookie` at all, regardless of
what script asks for it — its absence from this output is the actual test. Its presence here is
the concrete proof of impact, not just a config-table checkbox.

### 4. Decode the token actually sitting inside `document.cookie`

The `user` cookie's `st` field is not an opaque reference — it is itself a complete, valid JWT.
Decoding it (base64-decoding the token's middle segment) on data captured during this pass
produced:

```json
{
  "sub": "<user-id>",
  "role": "authenticated",
  "email": "<test-account-email>",
  "user_metadata": { "...": "..." },
  "aud": "authenticated",
  "iss": "https://staging-supabase-ruralloge.allweb.cloud/auth/v1",
  "exp": 1785921823,
  "iat": 1785918223
}
```

This is a real, unexpired Supabase auth token with `role: authenticated` — a second, independent
bearer credential (distinct from `AUTH_TOKEN` itself), fully readable by page JavaScript via a
non-`HttpOnly` cookie.

### 5. (Automated equivalent)

Steps 1-3 are exactly what
`tests/rural-lodge-test/security/002_auth-cookies-not-httponly-defect.spec.ts` does
programmatically via `context.cookies()` — see "Where this is covered in automation" below.

## Impact

- **A real bearer credential is confirmed extractable, not just theoretically exposed.** Step 4
  isn't a hypothetical — decoding the live `user` cookie's `st` field on this pass produced a
  valid, unexpired Supabase JWT (`role: authenticated`) sitting in plain sight in
  `document.cookie`. Any code with script execution in this origin can read and exfiltrate it
  today, with zero additional steps.
- **The app's own CSP compounds the risk.** The `Content-Security-Policy` header (see
  `001_security-response-headers.spec.ts`) includes `'unsafe-inline'` and `'unsafe-eval'` in
  `script-src`, alongside several third-party script origins (Google Maps, Cloudflare, GTM,
  Cloudflare Turnstile). `'unsafe-inline'` specifically defeats CSP's usual mitigation against
  *injected* inline scripts — so if an XSS injection point is ever found anywhere in the app (none
  was in this pass — see `004_xss-search-input-sanitization.spec.ts`, React's escaping held), or if
  any one of those allow-listed third-party scripts is ever compromised (a real, historically
  common supply-chain vector), the payload does not need to defeat CSP separately: it can run
  immediately and read this cookie straight away.
- **`Secure` and `SameSite=Lax` do not cover this risk** - they protect against network
  eavesdropping and cross-site request forgery respectively, but neither restricts same-origin
  JavaScript from reading the cookie. `HttpOnly` is the one flag that specifically closes this
  gap, and it is the one flag missing here.
- **Compounds DEFECT-1.** `DEFECT-1-protected-route-after-logout.md`'s root-cause hypothesis is
  that the dashboard route guard keys off the `user` cookie's mere *presence*, not its validity.
  Because `user` is script-writable (not just script-readable), the same access this defect
  documents would also let injected code forge that cookie's presence to influence DEFECT-1's
  guard, not only steal it.
- **No end-to-end account takeover was demonstrated in this pass** - there is no confirmed XSS
  injection point today, so this finding is "the credential is one script-execution bug away from
  being stolen," not "the credential has been stolen." That distinction is why this is filed as a
  cookie-hardening defect rather than an active account-compromise incident - but a valid,
  decodable session JWT sitting in `document.cookie` is a concrete artifact, not a speculative one,
  which is why this is rated High rather than a purely theoretical Medium.

## Suggested Fix

Set `HttpOnly` on both `AUTH_TOKEN` and `user` when they are issued at login. This is a
server-side response-header change (`Set-Cookie: ...; HttpOnly`); no client-side code should need
to read either cookie's raw value directly if the app is only using them for automatic
request-credential attachment and server-side session checks.

## Where this is covered in automation

```ts
// tests/rural-lodge-test/security/002_auth-cookies-not-httponly-defect.spec.ts
test('KNOWN DEFECT: AUTH_TOKEN and user cookies should be HttpOnly', ...)
```

Logs in, reads the resulting cookies via `context.cookies()`, and asserts
`httpOnly === true` for both `AUTH_TOKEN` and `user` — which fails today, by design, until this is
fixed.
