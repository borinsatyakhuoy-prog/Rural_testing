# Rural Lodge — Test Execution Report

**Date:** 2026-08-05 (Cycle 1 — first full run of the QA E2E workflow, Steps 5-7, per `QAE2EPromtFile.md`)
**Environment:** https://staging-ruralloge.allweb.cloud (staging), viewport 2000x1200
**Run type:** Steps 1-4 (user story, test plan, exploratory testing, automation scripts) were already complete from a prior session — this cycle picked up at **Step 5 (Execute & Heal)**, ran the full automated suite to a clean, stable baseline, then completed **Step 6 (this report)**.

---

## 1. Executive Summary

- **37 automated tests** across 6 spec files (`tests/rural-lodge-test/`, chromium project), covering all 5 planned domains (`specs/planner/01-authentication.md` … `05-customer-booking.md`, 35 planned scenarios).
- **22 manual exploratory scenarios** executed in the prior session (Step 3) across Authentication (9), Navigation (9), and Error Handling (4): 20 passed, 2 failed (both the same underlying defect, asserted from two angles) — see `specs/exploratory-findings.md`. Deeper exploratory passes on Lodge Owner CRUD, Lodge Owner's other modules, and the Customer Booking cycle are also fully documented there.
- **First full automated baseline this cycle:** 31 passed, 5 failed, 1 "did not run" (37 total, chromium, 2 workers, 6.3m).
- **After healing:** the suite now runs consistently at **33-34 passed / 3 known-defect failures** (intentional — see below) **/ 0 unexplained failures**, with one residual, already-documented, low-frequency environment flake (see §3f).
- **3 of the failures found in every run are not test bugs — they are the suite correctly, repeatably documenting 2 real, confirmed application defects** (the protected-route silent-failure bug is asserted from two files, plus the Wishlist remove-toggle bug). These are expected to fail until the application is fixed; see the Defects Log.
- **5 real test-suite/config issues were root-caused and healed this cycle** (none were application bugs): a cross-file shared-account session collision, three timing/assertion gaps, and one self-perpetuating hang in the Lodge Owner Profile test caused by a hardcoded rename value colliding with account state left behind by an earlier crash. Full detail in §3.
- **Cross-browser:** Firefox completed shortly after this cycle's chromium work (35 passed, 2 failed — both DEFECT-1, confirming it reproduces cross-browser). WebKit not yet run. See §5.
- **Overall status: STABLE.** No new application defects were found or fixed this cycle — all healing was test-code/config correctness work. The 2 known application defects already catalogued from Step 3 remain open and are now enforced by automated regression tests rather than only documented narratively.
- **Cycle 2 (2026-08-05): file-structure rework, performance suite, and 3 new test cases — suite grew from 37 to 46 tests.** By request, `tests/rural-lodge-test/` was reorganized from 6 flat per-domain spec files into `<domain>/NNN_description.spec.ts` subdirectories (matching the reference project's convention), with shared login helpers extracted to `helpers/auth.ts`. A new formal performance SLA (`specs/performance-sla.md`, `helpers/performance.ts`) with P99 gating was added (6 new tests, all passing, zero SLA FAILs — see §9). 3 new functional tests closed real coverage gaps found via live exploration: Google/Apple OAuth redirect verification (scoped to the boundary this app controls, per an explicit user decision — see §9) and the Stay Management calendar's real-data branch (previously only the empty-state was covered). Allure and monocart reporting were also wired in alongside the existing Playwright HTML report. **Final result: 42/46 passed (91.3%)** — the same 3 known-defect tests plus one recurrence of a low-frequency navigation hydration race (see §9). **A real config bug was also found and fixed:** Playwright's default `outputDir` was `test-results/` (the same folder holding this hand-authored report), so every run's own cleanup was silently deleting `Report.md` — fixed by pointing `outputDir` at a dedicated `playwright-output/` folder, the same fix the reference project already applied for the identical reason.
- **Cycle 3 (2026-08-05): Step 8 Smart Re-run — catch-up documentation for 3 already-committed but unreported commits, plus 3 new authentication tests — suite grew from 46 to 68 tests.** Comparing the current test plan/scripts against this report surfaced that a security-test domain (`specs/planner/06-security.md`, 5 tests — one real finding, now DEFECT-2, auth cookies missing `HttpOnly`), 5 cross-module filter tests, and 5 more performance endpoints had already been committed (`9d14165`, `1fa301d`, `0135b4c`) without ever updating this report — retroactively documented in §10a, no re-work needed. Separately, 3 new scripts closed a genuine coverage gap (planner scenarios 1.5/1.6/1.9, password-toggle/tab-switch/manage-lodge-auth-gate — see §10b), scoped as a PARTIAL re-run since the user story and test plan's substance were unchanged. **Final result: 64/68 passed** — the same 3 (now 4, after a DEFECT ID renumbering — see §6) known-defect failures plus 2 transient staging-load flakes that both cleared on isolated re-run, one of them the same navigation hydration race already known from Cycle 2. See §10.

---

## 2. What Changed Before This Run

This cycle began with the repo already containing (from a prior session, uncommitted):
- `specs/planner/` renumbered from unlinked `authentication.md`/`navigation.md`/`error-handling.md`/`lodge-owner.md`/`customer-booking.md` into a consistent, cross-referenced `01-`…`05-` sequence plus `specs/README.md`.
- `tests/rural-lodge-test/lodge-owner-crud.spec.ts` hardened with retry logic (`clickRowMenuItem`, `retryMissingLanguages`) for flakiness found while authoring it.
- Some scratch diagnostic scripts (`diag-login*.js`) used to investigate the protected-route defect, since removed (their findings are captured in `exploratory-findings.md`).

None of this changed any acceptance criteria or test plan scenarios — it was Step 4/5 polish already in flight. This cycle's own work started from there: run the full suite, heal what's broken, report, and (pending) commit.

---

## 3. Automated Test Results

| Stage | Passed | Failed | Did not run | Total | Duration |
|---|---|---|---|---|---|
| Baseline run 1 (2 workers, before any fix) | 31 | 5 | 1 | 37 | 6.3m |
| Baseline run 2 (1 worker, to test a hypothesis) | 27 | 5 | 5 | 37 | 9.5m |
| After fixing 4 timing/assertion issues + forcing `workers: 1` | 32 | 4 | 1 | 37 | 10.1m |
| After fixing the Reservations empty-state assertion | 32 | 4 | 1 | 37 | 10.1m |
| After the Profile test's real root-cause fix (see §3e) | **33** | **4*** | **0** | 37 | 7.4m |
| Confirmation run (new flake surfaced, then fixed) | 30 | 4** | 3 | 37 | 10.4m |
| Final isolated re-run of the affected file | 4 | 0 | 0 | 4 | 4.2m |

\* 3 of these 4 are the intentional known-defect tests (always expected to fail); the 4th was a newly-surfaced, previously-unseen `navigation.spec.ts` flake, healed immediately after (see §3g).
\*\* 3 known-defect + 1 rare, pre-existing `lodge-owner-crud.spec.ts` flake unrelated to any change made this cycle (see §3f).

**Steady-state result:** 3 tests fail on every run by design (they assert the *correct*, not-yet-implemented behavior for 2 confirmed application defects). Every other test passes reliably; one test (`lodge-owner-crud.spec.ts` › Create Lodge) has an observed ~1-in-8 flake rate tied to a backend condition already documented in `specs/exploratory-findings.md` (transient 502s during the multi-language Policy save).

### 3a. Root cause: a shared test account was not safe to run concurrently

`TEST_USER_EMAIL` is used by `authentication.spec.ts`, `navigation.spec.ts`, and `lodge-owner-crud.spec.ts` — three different files, which Playwright's `fullyParallel: true` config can schedule on different workers at the same time. Two of those files logging into the *same* account concurrently invalidates each other's session server-side (the same class of collision already found and fixed, within a single file, for the dedicated `OWNER_TEST_EMAIL`/`CUSTOMER_TEST_EMAIL` accounts via `test.describe.configure({ mode: 'serial' })`). This reproduced as a real, isolated failure in `lodge-owner-crud.spec.ts`'s Delete test only under the 2-worker run, never under 1 worker.

**Fix:** `playwright.config.ts` now forces `workers: 1` unconditionally (previously only on CI), with a comment explaining why, until a fourth dedicated account removes the need to share `TEST_USER_EMAIL`.

### 3b. `test.describe.configure({ mode: 'serial' })` cascades explained the "did not run" counts

Both `customer-booking.spec.ts` and `lodge-owner-modules.spec.ts` run their tests in forced serial order (to avoid the same shared-account collision, within their own dedicated accounts). In Playwright, once one test in a serial block fails, every sibling test *after* it in that block is skipped and reported as "did not run" — not as a separate set of new bugs. This fully accounted for the "5 did not run" and "1 did not run" figures seen across this cycle's runs; once the actual failing test in each block was fixed, the cascaded siblings passed normally.

### 3c. Timing gaps healed (genuine staging slowness, not app bugs)

| Test | Symptom | Fix |
|---|---|---|
| `authentication.spec.ts` / `error-handling.spec.ts` — logout / protected-route tests | Header account-button initials text stayed empty past a 10s wait under slower staging load | Bumped to 20s |
| `customer-booking.spec.ts` — "Booking happy path" | "Personal Details" text not visible within the default 5s after reaching the booking URL (a "Loading Your Booking..." transient state, per `exploratory-findings.md`) | Explicit 20s timeout on that assertion |

### 3d. `lodge-owner-modules.spec.ts` — Reservations empty-state assertion was too narrow

The test only recognized a "No results found" message as a valid empty state. Live diagnosis (via the page snapshot captured on failure) showed the actual UI renders a **"0 Reservations"** counter with an empty table body for this account — a legitimate empty state the assertion simply didn't check for. Fixed by accepting either signal.

### 3e. `lodge-owner-modules.spec.ts` — Profile test: a self-perpetuating hang (the main finding this cycle)

This test failed identically across 4 consecutive attempts, even after raising its timeout from 135s to 240s — a sign the problem wasn't about budget. Using the Playwright trace from an isolated run, the hang was pinpointed to a `page.getByRole('button', { name: 'Save Changes' }).click()` call that **never completed**, for the entire remaining test budget.

Live diagnosis via the Playwright MCP browser tools (logging into the same `OWNER_TEST_EMAIL` account manually) found the actual cause: **the account's display name was already stuck at `"QA Owner Test"`** — left behind by an earlier run of this same test that had crashed before its `finally` block could revert it. On every subsequent run, `originalName` read back as `"QA Owner Test"`, identical to the test's hardcoded `testName`. Renaming the account to the name it already had is a genuine no-op, so the app correctly never surfaced a "Save Changes" bar — and the test hung forever waiting for a button that would never appear. Every failed run left the fixture corrupted for the next one, which is why raising the timeout never helped.

**Fix:** the live account name was manually reverted to `"QA Owner"` via the Playwright MCP browser, and the test was changed to guarantee `testName` can never equal `originalName`, regardless of what a prior crash left behind — making the test self-healing. Confirmed via an isolated re-run of the full file: 6/6 passed in 1.0m (down from repeatedly exhausting a 240s budget).

### 3f. `lodge-owner-crud.spec.ts` — Create Lodge: pre-existing, low-frequency flake (not touched/introduced this cycle)

Failed once, in one full-suite run, with `"Request to review & Publish"` staying disabled for the entire 360s budget — meaning the Lodge Live Editor's completion percentage never reached 100%. This file was not modified during this cycle's healing. An isolated re-run immediately after passed cleanly (4/4, 4.2m), and across all 8 executions of this test in this session it passed 7 times (~87.5%) — consistent with the transient 502 errors during multi-language Policy saves already documented in `specs/exploratory-findings.md` (Lodge Owner CRUD section), not a regression. No further action taken; flagged as a residual, known risk.

### 3g. `navigation.spec.ts` — "Stay" link click: one-off hydration race

Surfaced once, in the run immediately following the Profile-test fix: clicking "Stay" (raw `href="/"`) right after a same-test navigation to `/en/activity` occasionally redirected to `/km` instead of client-side-navigating to `/en` — consistent with the click firing before the new page's router had finished hydrating, falling back to a hard navigation that then hit the server's default-locale redirect. Fixed with an explicit `page.waitForLoadState('load')` before the click. Not reproduced since.

---

## 4. Manual Test Results (Step 3, prior session)

Full detail, screenshots, and selector notes are in `specs/exploratory-findings.md`. Summary:

| Domain | Scenarios | Pass | Fail (defect confirmed) |
|---|---|---|---|
| Authentication | 9 | 8 | 1 (known defect) |
| Navigation | 9 | 9 | 0 |
| Error Handling | 4 | 3 | 1 (same known defect, asserted from a different angle) |
| Lodge Owner CRUD | 6 areas | 5 | 0 (1 documented product gap, not a bug) |
| Lodge Owner — other modules | 6 areas | 6 | 0 (2 documented feature gaps) |
| Customer Booking Cycle | 8 areas | 7 | 1 (Wishlist remove-toggle defect) |

All scenarios expected to pass, passed. Two real, reproducible defects were found (both now enforced by automated regression tests, see §6 Defects Log); several additional minor findings (copy bugs, UX inconsistencies, product gaps) were logged but are not blocking.

---

## 5. Cross-Browser Status

Per `user-stories/SCRUM.md`'s Technical Notes ("Test across Chrome, Firefox, and Safari"), this cycle's scope was directed to proceed to reporting/commit before the cross-browser pass was prioritized; a Firefox run was left executing in the background and completed shortly after:

| Browser | Passed | Failed | Total | Duration |
|---|---|---|---|---|
| chromium | 33-34 | 3 (known defects) | 37 | ~7-10m |
| firefox | 35 | 2 | 37 | 8.9m |
| webkit | — not yet run — | | | |

**Firefox result: 35 passed, 2 failed — both are DEFECT-1** (`authentication.spec.ts` and `error-handling.spec.ts`'s protected-route tests), confirming the defect reproduces cross-browser, not just in chromium. The failure shape differs slightly by engine: chromium's `page.goto()` succeeds and stays on the dashboard URL (assertion times out waiting for a redirect that never comes), while Firefox's `page.goto()` itself throws `NS_BINDING_ABORTED; maybe frame was detached?` — consistent with the same underlying defect (no clean server/client redirect), just manifesting as a different low-level navigation signal per browser engine.

**Notable: DEFECT-2 (Wishlist remove-toggle) did not reproduce in this Firefox run** (`customer-booking.spec.ts`'s Wishlist test passed). This is a single data point, not yet enough to conclude the bug is chromium-only — it could equally be a timing-dependent race that happened to resolve differently in Firefox this one time. Worth a repeat Firefox run to confirm before drawing a conclusion either way.

**WebKit has not yet been run** — recommend as a follow-up, run sequentially (not concurrently with chromium/firefox or with itself, per the shared-account constraint in §3a).

---

## 6. Defects Log

### Confirmed application defects (enforced by automated tests, expected to fail until fixed)

**DEFECT-1 (Severity: High) — Protected routes silently render a broken shell instead of redirecting to login, after logout.**
After logging out, navigating directly to `/en/customer/dashboard` does not redirect to `/login` or `/en/auth` as expected. The page renders a degraded dashboard shell ("Hello,", "No stats available", "No bookings found") while the browser console logs repeated `TRPCClientError: Authentication token not found in cookies` errors that are never surfaced to the user — violating both the Authentication and Error Handling acceptance criteria ("no silent failure or broken page").
**Root-cause hint (from exploratory testing):** after logout, a stale `user` cookie (containing a seemingly-valid but stale session identifier) survives, while the real auth-token cookie used by data-fetching is cleared. The route guard/shell appears to key off the mere *presence* of the `user` cookie rather than validating the real session.
**Coverage:** `tests/rural-lodge-test/authentication/006_protected-route-after-logout-defect.spec.ts` and `tests/rural-lodge-test/error-handling/002_protected-route-silent-failure-defect.spec.ts` — both reproduce this 100% of the time across every run this cycle.
**Recommendation:** route guards should validate actual auth-token presence/validity, not the `user` info cookie; logout should clear all auth-related cookies, not just the primary token.
**Full step-by-step repro with screenshots:** see [`specs/defects/DEFECT-1-protected-route-after-logout.md`](../specs/defects/DEFECT-1-protected-route-after-logout.md).

**DEFECT-2 (Severity: High) — Session cookies (`AUTH_TOKEN`, `user`) are not `HttpOnly`.**
After login, both the real session token (`AUTH_TOKEN`) and the client-info cookie already implicated in DEFECT-1 (`user`) are `Secure`+`SameSite=Lax` but missing `HttpOnly`, so both — including a decodable, unexpired Supabase JWT sitting inside `user`'s `st` field — are readable/writable from any page JavaScript via `document.cookie`. No active exploit was demonstrated (no confirmed XSS injection point exists today), but the app's CSP already allow-lists `'unsafe-inline'`/`'unsafe-eval'` and several third-party script origins, so this is "one script-execution bug away" rather than purely theoretical — which is why it's rated High, not Medium. Also compounds DEFECT-1: because `user` is script-*writable*, not just readable, injected code could forge that cookie's presence to influence DEFECT-1's route guard.
**Coverage:** `tests/rural-lodge-test/security/002_auth-cookies-not-httponly-defect.spec.ts` — reproduces 100% of the time (every login).
**Recommendation:** set `HttpOnly` on both cookies at issuance (`Set-Cookie: ...; HttpOnly`); no client code should need to read either cookie's raw value directly.
**Full repro with cookie capture and decoded JWT:** see [`specs/defects/DEFECT-2-auth-cookies-not-httponly.md`](../specs/defects/DEFECT-2-auth-cookies-not-httponly.md).

**DEFECT-3 (Severity: Medium) — Wishlist "Remove" toggle on the lodge-detail page does not persist server-side.**
*(Renumbered from DEFECT-2 in Cycle 3 — the security pass above independently assigned "DEFECT-2" to the auth-cookie finding before this doc's existing Wishlist entry was noticed; DEFECT-3 avoids the ID collision. No code/test files reference the old number, so this is a documentation-only renumbering.)*
Clicking the Save/Remove toggle a second time (while it reads "Remove") flips its own label back to "Save" — looking like a successful removal — but the item is still present when the Wishlist page is reloaded. The "add" path persists correctly; only the "remove" path on this specific control is affected. The dedicated Wishlist-page removal button + confirmation dialog works correctly and is the reliable removal path.
**Coverage:** `tests/rural-lodge-test/customer-booking/006_wishlist-remove-toggle-defect.spec.ts` — reproduces 100% of the time.
**Recommendation:** the lodge-detail toggle's "remove" path needs to actually await/persist its mutation rather than only updating local/optimistic UI state.

### Documented gaps / minor findings (not blocking, not asserted as failures)

- **Offers page "Coming Soon" placeholder copy says "activities," copy-pasted from the Activity page** — cosmetic content bug. Asserted as *current* behavior in `navigation.spec.ts` so a future fix will be caught by the test (it will start failing and prompt a human review), rather than silently going unnoticed.
- **No Archive/Deactivate/Unpublish action exists for lodges** — delete is all-or-nothing; a lodge owner cannot temporarily hide a lodge without permanently destroying its data. Product gap, not a bug.
- **Root locale default (`/km`) is only reliable with clean cookies** — a `NEXT_LOCALE` cookie from any prior language selection overrides the default on later bare `/` visits within the same session. Automation-relevant gotcha (tests must clear cookies), not itself a defect.
- **Transient 502 + unhelpful raw-JSON error message during Policy save** in the Lodge Live Editor — the backend occasionally 502s, and the frontend surfaces the resulting non-JSON parse error verbatim ("Expected property name or '}' in JSON...") instead of a user-friendly retry message. Retrying the same Save succeeds immediately.
- **False-positive "Discard changes?" dialog** — clicking Close immediately after a successful Pricing Save in the Lodge Live Editor still shows a "you have unsaved changes" warning even though the save already succeeded and persisted.
- **Document `<title>` briefly flashes Khmer text** on first paint (New Lodge wizard, lodge detail page) before hydrating to the correct locale's title.
- **No email/password change fields anywhere in Lodge Owner Account Settings** — only the display name is editable from the owner UI. Feature gap.
- **Wishlist list page can render a blank content area for several seconds** after navigation, with no loading indicator, before real data (or the empty state) appears.
- **Cloudflare Turnstile console noise** on the Sign Up tab — benign third-party widget messages, not an app defect, but will trip a naive "0 console errors" assertion if one is ever added.

---

## 7. Test Coverage Analysis

- All 5 planned domains (`specs/planner/01-` through `05-`) have full automated coverage: Authentication, Navigation, Error Handling, Lodge Owner CRUD + other modules, Customer Booking.
- Both confirmed application defects found during manual exploration are now enforced by automated regression tests (rather than only living in a findings document), so a real fix will be caught by CI/local runs going forward.
- **Gap: cross-browser (Firefox/WebKit) parity has not been verified this cycle** — deferred by request; see §5.
- **Gap: the customer-side "abandoned booking pre-payment" trace was never confirmed from the Lodge Owner's Reservations view** (per `exploratory-findings.md` §1.5) — the customer side shows zero trace of a held-but-unpaid booking, and the owner-side confirmation was explicitly out of scope for that exploration session. Worth a dedicated follow-up.
- Real payment submission is deliberately never exercised anywhere in the suite (scope constraint, honored throughout) — `customer-booking.spec.ts` stops at asserting the Payment step's two method options exist, without ever clicking "Scan QR" or "Payment".
- `lodge-owner-modules.spec.ts`'s Reservations/Stay Management/Notifications tests accept either an empty state or real data, since the dedicated `OWNER_TEST_EMAIL` account is intentionally kept "clean" (0 lodges/reservations at time of writing) — the Actions column's approve/reject/confirm controls have never been exercised against real reservation data. A follow-up pass with an account that has real pending bookings would close this.

---

## 8. Summary and Recommendations

- **The suite is stable.** All healing this cycle was test-code/config correctness work (a shared-account concurrency hazard, timing gaps, one narrow assertion, and one self-perpetuating test-fixture corruption) — **no new application defects were introduced or found**; the 2 already-known defects from Step 3 remain open and are now automated.
- **Recommend engineering prioritize DEFECT-1** (protected-route silent failure) — it's the most severe finding, violates two acceptance criteria at once, and has a specific, narrow root-cause hint (route guard should validate the real auth token, not a stale `user` cookie's presence; logout should clear all auth-related cookies).
- **Recommend DEFECT-2** (Wishlist remove-toggle) be fixed next — a real, if lower-severity, data-persistence bug that could confuse customers into thinking they removed something they didn't.
- **Recommend running WebKit** (the remaining browser from the Technical Notes), sequentially and not concurrently with any other run against these shared test accounts (§3a). Firefox is now confirmed stable, with DEFECT-1 reproducing there too.
- **Recommend a follow-up pass against an `OWNER_TEST_EMAIL`-equivalent account that has real reservation data**, to exercise the Reservations approve/reject/confirm actions and the owner-side view of an abandoned pre-payment booking — both currently only verifiable against empty-state UI.
- **Process note for future cycles:** this project now has 4 test accounts in play (`TEST_USER_EMAIL`, `OWNER_TEST_EMAIL`, `CUSTOMER_TEST_EMAIL`); `TEST_USER_EMAIL` is still shared across 3 spec files with no in-file serialization (relying instead on the global `workers: 1` setting). If a dedicated fourth account is ever introduced to fully separate `lodge-owner-crud.spec.ts` from `authentication.spec.ts`/`navigation.spec.ts`, `workers` could potentially be relaxed back to parallel for faster runs — not attempted this cycle since it wasn't necessary to reach a stable suite.
- **Cycle 2: recommend a developer look at the navigation "Stay" click hydration race** (§9) — it has now reproduced twice (once before, once after, a targeted fix), suggesting the app's own client-side router occasionally loses the race to intercept the link click, falling through to a real navigation that then hits the server's default-locale redirect. Not urgent (low-frequency, and the app's default-locale behavior itself is correct) but worth a look if it starts appearing more often. Recommend running WebKit next, and re-confirming Firefox now that the suite has grown to 46 tests.

---

## 9. Cycle 2 (2026-08-05): File Restructure, Performance Suite, New Test Cases

**Scope:** by request — (1) reorganize the test file structure and improve naming to match the reference project's convention, (2) explore and add new test coverage, (3) add a performance test suite with P99 SLA gating, matching the reference project's pattern.

### 9a. File structure rework

`tests/rural-lodge-test/` was reorganized from 6 flat spec files (`authentication.spec.ts`, `navigation.spec.ts`, etc., each holding many tests) into `<domain>/NNN_description.spec.ts` subdirectories — one file per scenario, numbered, matching `tests/fapa-test/`'s established convention in the reference project:

- `authentication/001`-`008` (8 files, was 1)
- `navigation/001`-`012` (12 files, was 1)
- `error-handling/001`-`003` (3 files, was 1)
- `lodge-owner-modules/001`-`007` (7 files, was 1)
- `customer-booking/001`-`006` (6 files, was 1)
- `lodge-owner-crud/001` (kept as a single combined file — tests 2-4 have a genuine DATA dependency on the lodge test 1 creates via an in-memory closure, which Playwright cannot share across separate test files; the reference project has precedent for this too, e.g. its own multi-subtest toggle-matrix files)
- New `helpers/auth.ts` — `login`, `loginAsCustomer`, `loginAsOwner`, `logout` extracted from the duplicated inline versions across the old flat files.

Verified via `--list` (37 tests in 34 files, exactly matching the pre-restructure count) and a full run: all 3 known-defect tests reproduced identically; 2 new failures surfaced in that one run (`lodge-owner-modules/003`, `navigation/009`) but both passed cleanly on an immediate isolated re-run, confirming transient staging load (likely compounded by a concurrent `npm install` and MCP browser exploration happening on the same machine during that run) rather than a regression from the restructure itself.

### 9b. Performance suite with P99 SLA (new)

Added `specs/performance-sla.md` and `tests/rural-lodge-test/helpers/performance.ts` (ported from the reference project's methodology: Navigation Timing/Paint Timing/Resource Timing APIs, `assertSLA`/`assertP99SLA` hard gates, `rate`/`ratedLine` heuristic labels) plus 6 new tests under `tests/rural-lodge-test/performance/`:

| Tier | Test | Result |
|---|---|---|
| T1 Page Load + T3 API Read | `001_login-page-performance.spec.ts` | PASS (login page load 1012-1514 ms; tRPC batch substring not confirmed yet, reports `n/a` gracefully) |
| T2 Navigation + T5 Dialog Open | `002_home-navigation-performance.spec.ts` | PASS/WARN (nav clicks 644-2226 ms; one WARN observed, within SLA max) |
| T4 Search/Filter | `003_owner-lodges-search-performance.spec.ts` | PASS (~1.2-1.25s against the 40+-row TEST_USER_EMAIL lodges table) |
| T5 Dialog Open | `004_booking-dialog-open-performance.spec.ts` | PASS (date picker 824-908 ms, guests dialog 320-342 ms) |
| T6 Booking flow | `005_booking-flow-performance.spec.ts` | PASS (Book CTA -> Personal Details ~2.0-2.1s, comfortably under the 20s max set from this suite's own documented "Loading Your Booking..." wait) |
| P99 (repeated samples) | `006_p99-sla-performance.spec.ts` | PASS/WARN (8x home-page-load and 6x nav-click samples; P99 landed as WARN once, 2108 ms vs. 2000 ms target, still well under the 8000/6000 ms max) |

**Known gap:** T3 (API Read) currently can't confirm the real tRPC batch endpoint substring fired around login within the measurement window (reports `n/a` rather than a false number) — matches the reference project's own documented pattern for not-yet-confirmed endpoint substrings. A follow-up could capture the real request URL via `page.on('request')` during a live session to pin this down.

**All 6 performance tests pass; zero SLA FAILs** (some WARNs — within SLA, above target, expected/normal per the methodology, not a defect).

### 9c. New functional test cases (via live exploration)

**Google/Apple OAuth login — scoped by explicit user decision.** Full third-party login automation was explicitly ruled out: neither provider has a dedicated test account in this project, and both `accounts.google.com`/`appleid.apple.com` have their own anti-bot protections (CAPTCHA, device verification) that would make a real login flaky even with credentials. Per the user's choice, the new tests (`authentication/007_google-oauth-redirect.spec.ts`, `008_apple-oauth-redirect.spec.ts`) verify only the boundary this app actually controls: clicking the button redirects to the correct real provider domain with the expected `client_id`/`redirect_uri` OAuth parameters wired up, confirmed live via Playwright MCP before automating - then stops, never attempting the provider's own login form. Both pass.

**Stay Management calendar with real lodge data (new).** The existing Stay Management test only ever exercised the "clean" `OWNER_TEST_EMAIL` account (0 lodges), so the real calendar branch had never been covered - only its empty state. Explored live via Playwright MCP using the `TEST_USER_EMAIL` account (40+ real lodges): confirmed a "Choose a lodge" selector (one button per lodge with its nightly price), a 4-item calendar legend (Custom price / Custom stay rules / Custom price & stay rules / Blocked), a 12-month rolling calendar grid, and Default Stay Rules / Custom Rules / Price Rules sections below it. New test: `lodge-owner-modules/007_stay-management-calendar-with-real-lodge-data.spec.ts` - passes, asserting all of the above.

**CAPTCHA/anti-bot bypass — declined.** A separate request to bypass Cloudflare Turnstile (present on the Sign Up tab, per `specs/exploratory-findings.md`) or Google/Apple's own bot-detection was declined: these exist specifically to block automated submissions, and deliberately circumventing them isn't something this suite will do, even for QA purposes, since it would defeat the actual security control being exercised. If the underlying environment already uses a Cloudflare Turnstile *test* sitekey (a common, legitimate practice for automatable staging environments), Sign Up submission would already work with no bypass needed - worth confirming with the dev team, not attempted this cycle.

### 9d. Screenshot reorganization

The 49 exploratory-testing screenshots (previously loose in the project root) were moved into `specs/screenshots/<domain>/`, mirroring `tests/rural-lodge-test/`'s own domain folder structure (`authentication/`, `navigation/`, `error-handling/`, `lodge-owner-crud/`) for easy cross-reference. All 40 inline screenshot citations in `specs/exploratory-findings.md` were updated to the new paths. 14 previously-uncited screenshots (an earlier draft pass's duplicates, by content) were kept and domain-bucketed rather than discarded.

### 9e. Reporting infrastructure

`allure-playwright` and `monocart-reporter` were added alongside the existing Playwright HTML reporter (`allurerc.mjs`, `tests/global-setup.ts` for the Allure Environment widget, matching the reference project's setup). All three reports are generated from the same run: Playwright HTML (`playwright-report/`), Allure (`allure-report/`, needs a static server - not a single file), and monocart (`monocart-report/index.html`, self-contained, opens directly in a browser with no server).

**Real config bug found and fixed in the process:** Playwright's default `outputDir` is `test-results/` — the exact folder this project's own `Report.md` and `SCRUM.md`-adjacent hand-authored files live in. Every test run's own start-of-run cleanup was silently deleting `Report.md` before this was ever noticed (caught when this section was about to be written and the file was found already gone). Fixed by setting `outputDir: './playwright-output'` in `playwright.config.ts` — the identical fix, for the identical reason, already documented in the reference project's own config. **Recommend never removing this setting**, and being aware that any future reports/hand-authored files should also avoid `test-results/`'s sibling `playwright-output/` if added later.

### 9f. Final result this cycle

**42/46 passed (91.3%), chromium.** The same 3 known-defect tests (unchanged, still correctly documenting DEFECT-1 and DEFECT-2) plus one recurrence of the `navigation/001` "Stay" click hydration race first found and "fixed" during Step 5 — it reproduced again in this cycle's full run despite the earlier `waitForLoadState('load')` fix, then passed cleanly on isolated re-run both times it's been seen. This is now understood as a genuine, if low-frequency (~1-in-3 to 1-in-4 full runs), timing race in the app's own client-side router rather than a fully-fixable test issue — documented as a residual known flake rather than chased further with additional timing hacks.

---

## 10. Cycle 3 (2026-08-05): Catch-Up Documentation + New Authentication Coverage

**Scope:** entered via `QAE2EPromtFile.md` Step 8 (Smart Re-run). Comparing the current user story, test plan, scripts, and this report surfaced two separate things:
1. Three commits (`9d14165`, `1fa301d`, `0135b4c`) had already added a full security-test domain and cross-module filter tests since Cycle 2, growing the suite from 46 to 65 tests — but none of it was ever folded into this report. That gap is closed retroactively in §10a below (no re-planning or re-exploration needed — the work was already done and stable).
2. The working tree additionally had 3 new, uncommitted automation scripts (`authentication/009`-`011`) plus a filename-only edit to `specs/planner/01-authentication.md` pointing at them. Since `user-stories/SCRUM.md` was unchanged and the test plan's only edit was a file-path correction (no new/changed acceptance criteria), this was scoped as a **PARTIAL re-run (Steps 4-7 only)** — covered in §10b.

### 10a. Retroactive catch-up: security suite + cross-module filter tests (already committed, undocumented until now)

**Security domain (new, `specs/planner/06-security.md`, 5 tests in `tests/rural-lodge-test/security/`).** Live recon against staging surfaced one real finding and confirmed four other checks were already safe:
- `001_security-response-headers.spec.ts` — `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, HSTS with `max-age`, and a restrictive CSP are all present on `/en` and `/en/auth`. PASS (regression lock-in).
- `002_auth-cookies-not-httponly-defect.spec.ts` — **the one real finding**, now DEFECT-2 (see §6). Fails by design.
- `003_open-redirect-returnurl.spec.ts` — `returnUrl=https://evil.example.com` cannot forward off-origin. PASS.
- `004_xss-search-input-sanitization.spec.ts` — `<img src=x onerror=alert(1)>` in a real search field is not reflected unescaped; React's default escaping holds. PASS.
- `005_unauthenticated-api-rejects-without-leaking-data.spec.ts` — a direct `booking.getBookings` call with cookies cleared gets a clean 401, no data leakage — confirms DEFECT-1 is a client-side/UX bug only, the server-side authorization boundary is already sound. PASS.

**Cross-module functional filter tests (5 new tests).** Every listing page with a filter control now has a test proving the filter drives real server-side behavior (a URL query param or a distinctly-filtered API request), not just that the control renders: Owner Lodges status filter, Owner Reservations `res_status` filter sheet, Owner Payout filter panel (sections only, per the module's existing view-only scope), Customer My Booking status tabs (asserted via the `booking.getBookings` request payload), and Customer Notifications read/unread tabs (via the `notifications.getMy` request payload). All 5 pass.

**Extended performance coverage (`9d14165`, 1 new test file).** T3 (API Read) SLA checks extended from login-only to 5 more endpoints (Customer Dashboard, Customer Wishlist, Owner Reservations, Owner Payout Overview, Owner Notifications). Also fixed a genuine Resource-Timing-buffer race (reading the buffer right after a UI marker could intermittently miss the entry) via a new `waitForResourceEntry()` poll helper, applied to the pre-existing login test too.

**Documentation note:** `06-security.md`'s "DEFECT-2" and this report's pre-existing "DEFECT-2" (Wishlist) collided — resolved by renumbering Wishlist to DEFECT-3; see §6.

### 10b. New this cycle: 3 authentication scenarios closed (Step 4-5, PARTIAL re-run)

Planner scenarios 1.5, 1.6, and 1.9 in `specs/planner/01-authentication.md` were previously documented but had no automation script. Three new scripts close that gap:
- `009_password-visibility-toggle.spec.ts` — the password field's icon-only show/hide toggle correctly masks/unmasks the typed value.
- `010_auth-tab-switch.spec.ts` — the Sign In / Sign Up tabs swap in the registration form and back without leaking fields between states.
- `011_manage-lodge-redirects-unauthenticated.spec.ts` — "Manage Your Lodge" correctly redirects an unauthenticated user to `/en/auth?returnUrl=%2F`, in explicit contrast to DEFECT-1's dashboard route.

Ran headed on chromium: **3/3 passed on the first attempt, no healing required.**

### 10c. Fresh full-suite baseline

With the retroactive catch-up and the 3 new scripts, the suite now totals **68 tests** (up from 46 in Cycle 2). Ran headed, chromium, `workers: 1`:

| Run | Passed | Failed | Total | Duration |
|---|---|---|---|---|
| Full suite (headed) | 62 | 6 | 68 | 13.6m |
| Isolated re-run of the 2 non-defect failures | 1 | 1 | 2 | 31.8s |
| Isolated re-run of the still-failing one alone | 1 | 0 | 1 | 24.3s |

The full run's 6 failures resolve to exactly the 4 known-defect tests (expected, by design) plus 2 transient-staging-load flakes, both cleared on isolation:
- **4 known-defect failures (unchanged, expected):** `authentication/006` + `error-handling/002` (DEFECT-1), `security/002` (DEFECT-2), `customer-booking/006` (DEFECT-3).
- **`navigation/001`** — the same previously-documented "Stay" click hydration race from Cycle 2 (§9f); passed cleanly on isolated re-run.
- **`performance/006` (P99 SLA)** — failed with `page.goto` exceeding the 45s timeout while running back-to-back with `navigation/001` (both hammer `/en` repeatedly); passed cleanly both alone and paired with only itself (P99 landed at 2517ms, a WARN within the 8000ms max, not a FAIL). Consistent with this suite's already-documented pattern of genuine transient staging slowness under concurrent load (`specs/exploratory-findings.md`), not a new regression.

**Steady-state result: 64/68 passed, 4 known-defect failures, 0 unexplained failures.**

### 10d. Files changed / to commit this cycle

- `specs/planner/01-authentication.md` — file-path corrections for scenarios 1.5, 1.6, 1.9.
- `tests/rural-lodge-test/authentication/009_password-visibility-toggle.spec.ts` (new)
- `tests/rural-lodge-test/authentication/010_auth-tab-switch.spec.ts` (new)
- `tests/rural-lodge-test/authentication/011_manage-lodge-redirects-unauthenticated.spec.ts` (new)
- `test-results/Report.md` (this update)

No other source files changed this cycle — the security suite, filter tests, and extended performance coverage documented in §10a were already committed in prior commits (`9d14165`, `1fa301d`, `0135b4c`) and required no changes, only documentation catch-up.
