# DEFECT-2: Session cookies (`AUTH_TOKEN`, `user`) are not marked `HttpOnly`

| Field | Value |
|---|---|
| **Status** | Confirmed, open (not fixed) |
| **Severity** | Medium (defense-in-depth gap — no direct exploit demonstrated in this pass, but see Impact) |
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

1. Log in with a valid account (`TEST_USER_EMAIL` / `TEST_USER_PASSWORD`).
2. Inspect the resulting cookies (e.g. `context.cookies()` in Playwright, or `document.cookie` in
   devtools).

**Actual**, captured directly from staging:

```
theme:        httpOnly=false  secure=false  sameSite=Lax
AUTH_TOKEN:   httpOnly=false  secure=true   sameSite=Lax
user:         httpOnly=false  secure=true   sameSite=Lax
NEXT_LOCALE:  httpOnly=false  secure=false  sameSite=Lax
```

**Expected:** `AUTH_TOKEN` and `user` — the two cookies that carry session/identity state — should
be set with `HttpOnly`, so they are sent with requests but never exposed to page JavaScript.
`theme` and `NEXT_LOCALE` are plain UI preferences with no sensitive value, so their lack of
`HttpOnly`/`Secure` is not a concern.

## Impact

- `Secure` and `SameSite=Lax` already mitigate the two most common risks (network eavesdropping,
  cross-site request forgery). `HttpOnly`'s specific value is defense-in-depth against **XSS**: if
  any injected/third-party script ever runs in this origin's page context (a future XSS bug,
  a compromised third-party script tag, a malicious browser extension, etc.), it can currently
  read `document.cookie` and exfiltrate the live session token directly, rather than being blocked
  from touching it at all.
- This pass did not find an actual XSS injection point to chain with this (see
  `004_xss-search-input-sanitization.spec.ts` — React's default escaping held up against the one
  input tested), so there is no demonstrated end-to-end exploit here — the finding is the missing
  defense-in-depth layer itself, not a confirmed session-theft path.
- Also relevant to DEFECT-1: the `user` cookie's mere presence (not validity) is what that
  defect's root-cause hypothesis says the dashboard route guard keys off — making `user` readable/
  writable from JS means client-side code (including a future injected script) could not just
  steal it but forge its presence to influence that guard, compounding DEFECT-1's risk.

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
