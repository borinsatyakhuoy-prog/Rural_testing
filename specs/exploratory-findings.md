# Rural Lodge — Step 3 Manual Exploratory Testing Findings

**Date:** 2026-08-04
**Environment:** https://staging-ruralloge.allweb.cloud (staging)
**Browser viewport used:** 2000x1200 (Playwright MCP browser tools)
**Test account:** value of `TEST_USER_EMAIL` in `.env` (password from `TEST_USER_EMAIL`/`TEST_USER_PASSWORD`, not printed here)
**Screenshots:** saved to the project root as `01-login-page-empty.png` … `22-dashboard-authenticated.png` (paths referenced below are relative to the repo root)

Executed against the scenarios defined in `specs/planner/01-authentication.md`, `specs/planner/02-navigation.md`,
and `specs/planner/03-error-handling.md`.

## Summary tally

| Domain | Scenarios | Pass | Fail (defect confirmed) |
|---|---|---|---|
| Authentication | 9 | 8 | 1 (1.8 known defect) |
| Navigation | 9 | 9 | 0 |
| Error Handling | 4 | 3 | 1 (1.3 known defect — same root issue as auth 1.8) |
| **Total** | **22** | **20** | **2** (both are the same underlying defect, asserted from two angles) |

All scenarios that were expected to pass, passed. The one real defect in the plan (protected route
silently rendering a broken shell instead of redirecting to login) was fully reproduced and confirmed.
Two additional minor findings not in the original plan were also discovered (see "New findings" below).

---

## Authentication (`01-authentication.md`)

### 1.1 Happy path: valid login redirects to home page — **PASS**
- Navigated to `/en/auth`: title "Login - Rural Lodge", heading "Login to your account", Email/Password empty, Continue disabled. Screenshot: `01-login-page-empty.png`.
- Filled valid `TEST_USER_EMAIL`/`TEST_USER_PASSWORD`; Continue became enabled. Screenshot: `02-login-filled.png`.
- Clicked Continue → navigated to `/en`, title "Welcome to Rural Lodge", header now shows "JA" user-initials button instead of the login icon. Screenshot: `03-home-authenticated.png`.
- Matches plan exactly (redirect to home, not to `/customer/dashboard`).

### 1.2 Negative: invalid credentials — **PASS**
- On `/en/auth?returnUrl=%2F` (arrived here via the 1.9 flow below), filled `wrong.user@example.com` / `WrongPassword123!`, clicked Continue.
- URL stayed on `/en/auth?returnUrl=%2F` (query preserved). Exact text **"Invalid email or password. Please try again."** rendered near the Password field. Both Email and Password textboxes had `[invalid]` (aria-invalid) state. Screenshot: `09-invalid-credentials-error.png`.

### 1.3 Negative: empty required fields — **PASS** (documented gap confirmed)
- Typed a character into Email, cleared it, blurred by clicking elsewhere: Email textbox got `[invalid]` state; **no inline text message** appeared anywhere in the DOM/accessibility tree. Continue remained disabled. Screenshot: `10-empty-email-invalid.png`.
- Repeated for Password: same result — `[invalid]` state only, no text, Continue still disabled.
- Confirms the plan's documented gap: only a visual red-outline/aria-invalid state, no "Email is required"-style copy.

### 1.4 Forgot password → OTP reset panel — **PASS**
- Clicked "Forgot password?": in-place panel replaced the form (URL unchanged). Heading "Reset password", text "Enter your email to receive an OTP.", Email field placeholder "you@example.com", helper text "We'll send a 6-digit code if the email exists.", "Send OTP" disabled, "Back to login" visible. Screenshot: `11-forgot-password-panel.png`.
- Typing an email enabled "Send OTP". Clicking "Back to login" restored the original Sign In form.

### 1.5 Password visibility toggle — **PASS**
- Typed `Test1234!` into Password; confirmed via `document.querySelectorAll('input')` that `type="password"` by default.
- Clicked the eye-icon button inside the password field → `type` became `"text"` (value visible). Screenshot: `12-password-visible.png`.
- Clicked again → reverted to `type="password"`.

### 1.6 Sign In / Sign Up tab switch — **PASS**
- Clicked "Sign Up" tab: tab selection moved, and a full registration form appeared (First name, Last name, Email, Password with live strength rules, Confirm password, "Continue with Email", ToS/Privacy links). Screenshot: `13-signup-tab.png`.
- Clicked "Sign In" tab: original login form restored. Screenshot: `14-signin-restored.png`.
- Note: switching to Sign Up triggers 2 console errors from the Cloudflare Turnstile widget (`challenges.cloudflare.com` `%c%d font-size:0` messages) — this is a benign third-party captcha-rendering artifact, not an application defect.

### 1.7 Logout requires confirmation — **PASS**
- Logged in, clicked "JA" button → menu opened with "jak ah (Customer)", email, "My Booking", "Account Settings", "Logout". Screenshot: `04-account-menu.png`.
- Clicked "Logout" → "Confirm Logout" dialog appeared with exact text "Are you sure you want to log out of your account?", "Cancel" and a red "Logout" button. Screenshot: `05-confirm-logout-dialog.png`.
- Clicked the confirming "Logout" button → dialog closed, header reverted to the generic login icon, user remained on `/en` (no forced redirect). Screenshot: `06-logged-out-header.png`.
- Minor a11y note: the confirming "Logout" button in the dialog has no distinct accessible name captured in the accessibility tree snapshot when the dialog first renders (`button [ref] [cursor=pointer]` with no name) — Playwright's `getByRole('button', {name:'Logout'})` still resolves correctly by first-match, but a screen reader could find both this button and the menu item ambiguous. Not a functional bug, noted for reference.

### 1.8 KNOWN DEFECT: protected route access while logged out does NOT redirect — **FAIL (defect CONFIRMED)**
- After logging out, navigated directly to `https://staging-ruralloge.allweb.cloud/en/customer/dashboard`.
- **Actual:** URL stayed at `/en/customer/dashboard` (no redirect to `/login` or `/en/auth`). Page title was "Dashboard". The sidebar and shell rendered normally, but the content area showed **"Hello,"** (no name), **"No stats available"**, and the "Recent bookings" panel showed **"No bookings found" / "Please click the link below to explore lodge."** Screenshot: `07-protected-route-defect.png`.
- **Console:** 7 errors appeared, all `TRPCClientError: Authentication token not found in cookies`, for queries `notifications.getMy` (x2), `notifications.getUnreadCount` (x2), and `booking.getBookings` (x3).
- **Expected (per AC1):** redirect to `/login` or localized `/en/auth`.
- This is a genuine, reproducible defect — confirmed exactly as described in the plan.
- **Root-cause hint found during this session (new finding, not in original plan):** after logout, `document.cookie` still contained a `user=...` cookie with a seemingly-valid session JWT (`st` field, with `exp`/`iat` claims that had not yet expired), even though the actual auth-token cookie used by the tRPC calls was gone. This suggests logout clears the primary auth cookie but leaves a stale client-side "user" info cookie behind, and the dashboard route guard/shell appears to key off the stale `user` cookie's mere presence (rendering the shell) rather than validating the real session — while the data-fetching layer correctly detects no valid token and fails. Worth flagging to developers as a likely root cause to investigate (route guard should check real auth state, not just cookie presence).

### 1.9 'Manage Your Lodge' correctly redirects unauthenticated user — **PASS**
- Logged out, on `/en`, clicked "Manage Your Lodge" → redirected to `/en/auth?returnUrl=%2F` (title "Login - Rural Lodge"). Screenshot: `08-manage-lodge-redirect.png`.
- Confirms auth-gating is correctly implemented for this entry point, in contrast to the dashboard route.

---

## Navigation and Localization (`02-navigation.md`)

### 1.1 Top nav reaches Stay — **PASS**
- From `/en/activity`, clicked "Stay" (href `/`) → URL stayed `/en` (locale preserved via client-side nav), hero "Where do you want to go next?" and lodge carousels visible.

### 1.2 Top nav reaches Offers — **PASS**
- Clicked "Offers" from `/en` → URL `/en/offers`, title "Offers".
- **New finding (not in original plan):** the Offers page body only shows a generic "Coming Soon" placeholder whose copy reads **"We are working hard to bring you exciting activities. Stay tuned!"** — this text says "activities", which is copy-pasted from the Activity page and is contextually wrong for the Offers page. Screenshot: `15-offers-page.png`. Minor content bug, not a functional blocker.

### 1.3 Top nav reaches Activity — **PASS**
- Clicked "Activity" → URL `/en/activity`, title "Activities", same "Coming Soon" / "...exciting activities..." placeholder (correct wording for this page). Screenshot: `16-activity-page.png`.

### 1.4 Language toggle → English — **PASS**
- From `/km` (with cookies cleared first), opened language selector (heading "ជ្រើសរើសភាសា", English/French/Khmer options with radios, Khmer checked). Screenshot: `18-language-selector-open.png`.
- Clicked "English English" → URL became `/en`, nav labels "Stay"/"Offers"/"Activity", hero "Where do you want to go next?".

### 1.5 Language toggle → French — **PASS**
- From `/en`, opened selector, clicked "French Français" → URL `/fr`. Nav became "Séjour"/"Offres"/"Activité", hero "Où voulez-vous aller ensuite ?", "Manage Your Lodge" button became "Gérer votre Lodge". Screenshot: `19-french-locale.png`.

### 1.6 Language toggle → Khmer — **PASS**
- From `/fr`, opened selector, clicked "Khmer ខ្មែរ" → URL `/km`, nav reverted to Khmer script.

### 1.7 Language toggle on login page — **PASS**
- On `/en/auth`, a language icon button ("EN") is visible top-left of the auth panel. Screenshot: `20-auth-page-language-icon.png`.
- Selected "Khmer ខ្មែរ" from the "Select Language" popover → URL became `/km/auth`, heading became "ចូលប្រើគណនីរបស់អ្នក", fields "អ៊ីមែល" / "ពាក្យសម្ងាត់". Screenshot: `21-km-auth-page.png`.
- Reopening the panel showed the Khmer radio option checked.

### 1.8 Root URL defaults to Khmer locale — **PASS, with an important nuance (new finding)**
- With cookies/localStorage fully cleared, navigating to `https://staging-ruralloge.allweb.cloud/` redirected to `/km` as expected. Screenshot: `17-km-home-default.png`.
- **However:** on a *second* visit to `/` within the same browser session (cookies NOT cleared), the root redirected to `/en` instead of `/km` — because a **`NEXT_LOCALE=en`** cookie had been set by the earlier language-toggle interaction and persists across visits. This refines (does not contradict) the plan's note that "locale is carried via the URL path, not a persisted cookie/session" — in practice there IS a `NEXT_LOCALE` cookie, and it does override the `/km` default on subsequent bare `/` visits. **Automation implication:** tests asserting the `/km` default must use a fresh/cleared browser context (no `NEXT_LOCALE` cookie), otherwise the test will flake depending on prior test order.

### 1.9 Header consistency across Stay/Offers/Activity — **PASS**
- Verified across `/en`, `/en/offers`, `/en/activity`: logo link, Stay/Offers/Activity nav, "Manage Your Lodge" button, language toggle (EN), "$ USD" button, and login/account icon were present and consistent on every page.

---

## Error Handling and No-Data States (`03-error-handling.md`)

### 1.1 Invalid login produces a specific, visible message — **PASS**
- Same evidence as Authentication 1.2. Exact text shown, no blank page/unhandled overlay, user can correct and resubmit.

### 1.2 Empty required fields — visible invalid state but no text (documented gap) — **PASS** (gap confirmed as documented)
- Same evidence as Authentication 1.3. No "required"/"Email is required" text found anywhere near the field; only the aria-invalid/red-outline state.

### 1.3 DEFECT: protected route silent failure — **FAIL (defect CONFIRMED)**
- Identical reproduction to Authentication 1.8: no visible error/toast/banner is shown to the user; the dashboard renders "Hello,", "No stats available", "No bookings found" with a fully-styled shell that looks like it worked; only the browser console (7 `TRPCClientError: Authentication token not found in cookies` errors across `notifications.getMy`, `notifications.getUnreadCount`, `booking.getBookings`) reveals that anything failed. This directly violates the "no silent failure or broken page" AC. Screenshot: `07-protected-route-defect.png`.

### 1.4 No-data states show clear, specific messaging — **PASS**
- Logged in properly with the test account and navigated to `/en/customer/dashboard`.
- Since this account has real bookings, the dashboard showed real data: "Hello, ah jak", Total Bookings: 16, a "Recent bookings" list with 3 real booking cards (Mekong Serenity Stay x2, EN_Lodge_jpYPFR) each showing status ("Pending"/"Rejected"), dates, and price. Screenshot: `22-dashboard-authenticated.png`.
- This confirms the "has data" branch renders correctly. The "zero bookings" empty-state copy ("No bookings found" / "Please click the link below to explore lodge." / "Explore Lodge" button) was directly observed earlier in the (logged-out/broken) dashboard shell (`07-protected-route-defect.png`) and is visually well-formed and specific — it is a good, compliant no-data message *when reached in a properly-authenticated empty-account context*; the defect is specifically that this same UI is wrongly shown to a logged-out user instead of a login redirect.

---

## New findings not in the original plan (Step 2)

1. **Offers page placeholder text says "activities" instead of "offers"** (Navigation 1.2) — copy/paste content bug on `/en/offers`. Low severity, cosmetic/content issue.
2. **Stale `user` cookie survives logout** — after clicking "Logout" and confirming, `document.cookie` still contains a `user=...` cookie with what looks like a valid JWT (`st` field with unexpired `exp`), while the real auth-token cookie used by tRPC is gone. This is the likely root cause of the protected-route defect (Auth 1.8 / Error-Handling 1.3): the dashboard shell renders because some client code checks for the mere presence of the `user` cookie rather than validating a real session, while the data-fetching hooks correctly detect the missing auth token and fail. Recommend developers ensure logout clears ALL auth-related cookies and that route guards validate actual token presence, not just the `user` info cookie.
3. **Root locale default (`/km`) is only reliable with clean cookies** — a `NEXT_LOCALE` cookie set by any prior language selection overrides the `/km` default on later bare `/` visits within the same session (Navigation 1.8). Automation must isolate browser contexts / clear cookies before asserting this behavior.
4. **Cloudflare Turnstile console errors on Sign Up tab** — benign third-party widget console noise (`challenges.cloudflare.com`), not an app defect, but will show up if automated tests assert "0 console errors" — should be filtered/ignored by URL pattern in automation.

---

## Selectors / locators confirmed to work (for Step 4 automation reuse)

All obtained via Playwright's accessibility-tree role/name locators (the MCP tools resolve them internally via `page.getByRole(...)`). These are stable, human-readable, and did not require CSS/XPath.

### Login form (`/{locale}/auth`)
- Email field: `page.getByRole('textbox', { name: 'Email' })`
- Password field: `page.getByRole('textbox', { name: 'Password' })`
- Password show/hide toggle (no accessible name — icon-only button inside the password field wrapper): `page.locator('form').getByRole('button').filter({ hasText: /^$/ })` (resolves to the single icon button with no text inside the form)
- Continue (submit) button: `page.getByRole('button', { name: 'Continue', exact: true })` (note: disabled until both fields non-empty; use `exact: true` since "Continue with Google"/"Continue with Apple" also match "Continue" loosely)
- Forgot password link: `page.getByRole('button', { name: 'Forgot password?' })`
- Sign In / Sign Up tabs: `page.getByRole('tab', { name: 'Sign In' })` / `page.getByRole('tab', { name: 'Sign Up' })`, parent `page.getByRole('tablist', { name: 'Authentication switch' })`
- Invalid-credentials error text: `page.getByText('Invalid email or password. Please try again.')`
- Reset-password Email field: `page.getByRole('textbox', { name: 'Email *' })`
- Send OTP button: `page.getByRole('button', { name: 'Send OTP' })`
- Back to login button: `page.getByRole('button', { name: 'Back to login' })`
- Language toggle icon on the auth page: `page.getByRole('button', { name: 'EN' })` (or `'KH'`/`'FR'` depending on current locale — the button's accessible name IS the current locale code)

### Header / navigation (public site)
- Nav links: `page.getByRole('link', { name: 'Stay Stay' })`, `page.getByRole('link', { name: 'Offers Offers' })`, `page.getByRole('link', { name: 'Activity Activity' })` (name is duplicated because of a visually-hidden + visible label pair — use the full duplicated string or a substring/regex match)
- Manage Your Lodge button: `page.getByRole('button', { name: 'Manage Your Lodge' })`
- Language toggle (logged in/out, public pages): `page.getByRole('button', { name: 'EN' })` (exact match needed — also matches inside "Continue" etc. if not careful with locale code buttons)
- Language option buttons inside the popover: `page.getByRole('button', { name: 'English English' })`, `page.getByRole('button', { name: 'French Français' })`, `page.getByRole('button', { name: 'Khmer ខ្មែរ' })`
- Currency button: `page.getByRole('button', { name: '$ USD' })`
- Logged-out account/login icon: generic icon button with no accessible name, last button in the header utility group — target via position or `page.locator('banner').getByRole('button').last()` style locator, or (more robust) the authenticated "JA"-style button once logged in: `page.getByRole('button', { name: 'JA' })` (initials vary per user — derive dynamically from user's first/last name initials, do not hardcode "JA")

### Account menu / logout
- Open menu: click the initials button (see above)
- Menu items: `page.getByRole('menuitem', { name: 'My Booking' })`, `page.getByRole('menuitem', { name: 'Account Settings' })`, `page.getByRole('menuitem', { name: 'Logout' })`
- Confirm Logout dialog: `page.getByRole('alertdialog')` containing heading "Confirm Logout"
- Confirm dialog buttons: `page.getByRole('button', { name: 'Cancel' })` and `page.getByRole('button', { name: 'Logout' })` (the confirming button; resolvable by name despite not exposing a distinct accessible name in the raw a11y snapshot — Playwright's text-based role query still matches it as the only "Logout"-labeled button inside the dialog, so scope the locator to the dialog: `page.getByRole('alertdialog').getByRole('button', { name: 'Logout' })`)

### Dashboard (authenticated, `/​{locale}/customer/dashboard`)
- Sidebar items: `page.getByRole('link', { name: 'Dashboard' })` / `'Booking'` / `'Notifications'` / `'Wishlist'` / `'Explore Lodge'` (verify actual role — some render as buttons/links depending on state)
- "No stats available" text: `page.getByText('No stats available')`
- "No bookings found" text: `page.getByText('No bookings found')`

### General notes for automation
- The Playwright MCP browser tools in this environment require an exact element **ref** from the latest `browser_snapshot` (or a plain accessible-name role query resolved by the tool) as the `target` — arbitrary CSS/role-string shorthand like `button "Continue"` passed directly errors with a CSS-parsing failure. When writing actual `.spec.ts` files (not MCP tool calls), standard `page.getByRole(...)` Playwright locators (as listed above) work directly and are what should be used in Step 4.
- Cookie/localStorage clearing tools (`browser_cookie_clear`, `browser_cookie_list`) were not available in this MCP session; cookies were cleared via `page.evaluate()` walking `document.cookie`. Real Playwright test specs should use `context.clearCookies()` / a fresh `browser.newContext()` instead.

---

## Lodge Owner CRUD

**Date:** 2026-08-04
**Scenarios executed against:** `specs/planner/04-lodge-owner.md`
**Reference script used as baseline:** `C:\Users\khuoybo\Downloads\Project\Rural_lodge_testing\tests\001_ Create_Lodge.spec.ts`
**Account used:** the `.env` `TEST_USER_EMAIL` account, which on staging resolves to a "Lodge Owner" profile ("teba gof") with 40+ pre-existing lodges — session was already authenticated when this exploration began (persisted from a prior run), so the login step itself was not re-exercised here (see `01-authentication.md` for that coverage).
**Test lodge created:** `QA_Explore_Lodge_0804` (id `501a3d20-c442-4f53-99c3-091befacec9c`), created, read, updated, then deleted during this session.

### Summary tally

| Action | Result |
|---|---|
| Create (full wizard -> Lodge Live Editor -> Request to review & Publish) | PASS |
| Create - negative/validation (disabled-button gating) | PASS (documented as expected, not a defect) |
| Read/List (own lodges list, status, columns) | PASS |
| Update (edit Description + Price on a Pending Review lodge) | PASS (one transient bug hit and recovered, see below) |
| Delete (permanent hard-delete via row menu) | PASS |
| Deactivate/Archive/Unpublish | GAP — no such action exists anywhere in the owner UI |

### 1.1 Create Lodge — happy path — **PASS**

- Logged in already; clicked `Manage Your Lodge` -> landed directly on `/en/dashboard` (a full
  Lodge Owner dashboard with sidebar Dashboard/Lodges/Reservations/Payout/Profile/Stay Management),
  not a modal as the reference script's naming implies — but the dashboard's own `New Lodge`
  button is in the same position the script expects, so `page.getByRole('button', {name:'New
  Lodge'}).first().click()` still works unchanged. Screenshots: `01-home-authenticated.png`,
  `02-lodge-owner-dashboard.png`.
- Clicked `New Lodge` -> navigated to `/en/lodges/new` (title "Create Lodge"). The language-step
  heading rendered in **French** ("Quelle langue souhaitez-vous utiliser ?") despite the site being
  on `/en` — selected `English`, clicked `Next`. Screenshot: `03-create-lodge-language-select.png`.
- Selected lodge type `Entire Place`, clicked `Next` (URL `?step=2` then `?step=3`).
- On the combined "Loge Information" step (name/description/category/arrangement/recommendations/
  activities are all ONE page, matching the reference script's step grouping even though it's
  written as two separate `test.step()` blocks): filled Name `QA_Explore_Lodge_0804`, filled a rich
  text Description, selected Category "Beachfront Villa", Place Arrangement "One Bedroom",
  recommendation "Couples", activity "Hiking". `Next` was disabled until Name/Category/Arrangement
  were all set. Screenshot: `04-lodge-info-step-filled.png`.
- Location step: selected Province "Banteay Meanchey" -> District "Malai" -> Commune "Boeng Beng"
  -> Village "Sangkae", exactly matching the reference script's location choice. Attempting to
  click the map (`.gm-style`, same locator the reference script uses) **caused a full browser-
  context crash** in this MCP session — the click retried 500+ times against child elements that
  intercepted pointer events, then the tool reported "Target page, context or browser has been
  closed." Real Playwright test specs hitting this should add `{force: true}` and a bounded retry,
  or click a specific child element/coordinate rather than the bare `.gm-style` container.
- After recovering the session (re-navigated to `/en/dashboard`, still authenticated), found the
  in-progress lodge had already been **persisted as a Draft** — Total Lodge count on the dashboard
  had gone from 42 to 44 (two abandoned attempts), and `QA_Explore_Lodge_0804` appeared in
  `/en/lodges` with Status "Draft", 13 minutes old, Location/Category/etc. all preserved from
  before the crash. This confirms the wizard auto-saves progressively, not only on final submit —
  see `04-lodge-owner.md` scenario 1.6 for the dedicated writeup. Screenshot: `05-lodges-list-view.png`.
- Reopened the Draft via the row's first action icon (no accessible name — resolved by CSS position
  in this session; in a real spec use the row menu's `Edit` link instead, see below) -> landed on
  `/en/lodges/editor/<id>` "Lodge Live Editor", 29% Completed. Screenshot implied by subsequent
  steps; the editor's own state (Location/Gallery/Activities/Pricing/Amenities/Guests/Categories/
  Place Arrangement/Accommodation Type/Suitable Recommendation) was already auto-completed from the
  pre-crash wizard steps, confirming the amenities/price/image steps do not need to be manually
  redone once auto-saved.
- Filled `Titles*` (needed KM+FR only, EN was pre-filled from the lodge name), `Description*`
  (needed KM+FR), `Bedroom*` (New Room -> Title/Description in EN, KM, FR), `Bathroom*` (New
  Bathroom -> Title/Description in EN, KM, FR), and `Policies*` (Add Policy -> Check-in/Check-out
  Policy -> Title/Content in KM, EN, FR) — completion meter climbed 29% -> 57% -> 71% -> 86% -> 100%
  as each section was finished. Screenshots: `06-bedroom-editor-empty.png`,
  `07-policy-save-error-bug.png`, `08-editor-100-percent-complete.png`.
- **Bug hit and recovered**: saving the French Policy the first time failed with a visible error
  message "Failed to save policy: Expected property name or '}' in JSON at position 1 (line 1
  column 2)" — console showed the root cause: `Failed to load resource: the server responded with
  a status of 502 () @ .../api/trpc/policy.update?batch=1`, i.e. a transient 502 from the backend
  whose non-JSON error body broke the tRPC client's JSON parser, which then also threw 5x "Minified
  React error #419" (hydration mismatch) in the console. Unlike the silent-failure defect in
  `01-authentication.md`/`03-error-handling.md` (protected route), this failure DID show the user a
  message — just an unhelpful, technical one, not "Please try again" style copy. Clicking `Save`
  again immediately succeeded (100% Completed reached).
- Clicked `Request to review & Publish` (enabled only once 100% Completed) -> a `Confirmation`
  dialog appeared: "Are you sure you want to submit this lodge for review?" (Cancel/Confirm) —
  clicked `Confirm` -> redirected to `/en/lodges?sort=updatedAt&sortOrder=desc`; the lodge's row
  showed Status "Pending Review". No explicit "success"/toast text was captured in the snapshot at
  that moment — success was confirmed via the redirect + status change rather than a message, so
  automation should assert on the list status, not on toast text. Screenshot:
  `09-lodges-list-pending-review.png`.

### 1.2 Create Lodge — negative/validation — **PASS (documented as expected, not a defect)**

- Confirmed the pattern already documented for login in `01-authentication.md`: required fields use
  a **disabled-button** gate rather than an inline "X is required" message. `Next` on the type/
  info/location steps and `Request to review & Publish` in the Lodge Live Editor were all observed
  disabled until their respective required data was complete — no separate negative-path bug found
  here; this is consistent, expected behavior across the whole app.

### 1.3 List/View Own Lodges — **PASS**

- `/en/lodges?sort=updatedAt&sortOrder=desc` (reachable via the dashboard sidebar's `Lodges` link)
  shows: page heading "Loges" (branding inconsistency: "Lodges" in the sidebar nav vs "Loges" as
  the page `<h1>` vs "Lodge" in "New Lodge"/"Lodge Live Editor" elsewhere — cosmetic only), an
  `Add Loge` button (`/lodges/new`), a "`N` loges" count, search box, sort combobox, `Filter`
  button, and a 10-column table: No. / Loge / Location / Type / Price / Discount / Available in /
  Status / Last Updated / Actions. Pagination: "Page 1 of 3", 20 rows/page. Screenshots:
  `05-lodges-list-view.png`, `11-lodges-list-after-price-update.png`.
- Status values observed directly: "Draft" and "Pending Review". "Published" was not present on
  page 1 of results during this session but is confirmed to exist via the dashboard's "Published
  Lodges: 2" stat tile.
- Each row's Actions cell has 3 unlabeled icon buttons plus a kebab/chevron button; the kebab opens
  a `menu` with exactly `Edit` (a link to `/lodges/editor/<id>`) and `Delete` (a `menuitem`).

### 1.4 Edit Lodge — **PASS**

- Opened the "Pending Review" `QA_Explore_Lodge_0804` via the row's Edit action — the Lodge Live
  Editor opened normally with all sections already "Completed" (no locked/read-only state for a
  submitted lodge).
- Edited the EN Description (appended " UPDATED via edit test.") and Saved — the section's Save
  button went back to `disabled` immediately, and the live preview iframe showed the new text.
  Screenshot: `10-description-edited-saved.png`.
- Changed `Price per night*` from `10` to `15` in the Pricing section — the VAT/base-price preview
  recalculated live ("$16.50 including 10% VAT") before Save was even clicked. Clicked Save (button
  became enabled/clickable once the value changed) then `Close`.
- **Minor UX inconsistency found**: clicking `Close` immediately after a successful Pricing Save
  still triggered a "Discard changes?" confirmation dialog ("If you leave now, all your progress
  will be lost...") even though the section's own Save button was already back to `disabled` (i.e.
  the app's own state said there was nothing unsaved). Confirmed this was a false-positive prompt,
  not real data loss: after clicking "Yes, discard changes" and returning to `/en/lodges`, the
  Price column correctly showed the new value "$15/night" — the change had already persisted
  server-side. Automation should not rely on the absence of this dialog as a correctness signal.

### 1.5 Delete/Deactivate Lodge — **PASS for Delete; GAP for Deactivate**

- The only lifecycle action beyond Edit is **Delete**, reached via the row kebab menu. Clicking
  `Delete` opened an `alertdialog`: heading "Are you absolutely sure?", body "This action cannot be
  undone. This will permanently delete your property and remove your data from our servers.",
  buttons `Cancel` / `Delete`. Screenshot: `12-delete-confirmation-dialog.png`.
- Clicked the dialog's `Delete` button -> the row disappeared from the list immediately (no reload
  needed) and the "`N` loges" count dropped from 44 to 43, confirmed by re-reading the list.
  Screenshot: `13-lodges-list-after-delete.png`.
- **GAP**: no Archive / Deactivate / Unpublish / "revert to Draft" action exists anywhere in the
  owner UI (not in the row menu, not in the 3 unlabeled row icon-buttons, not in the Lodge Live
  Editor's own header). An owner who wants to temporarily hide a lodge without permanently
  destroying its data has no way to do so from the UI as of 2026-08-04 — delete is all-or-nothing.
  This is documented as a product gap in `specs/planner/04-lodge-owner.md` scenario 1.5 rather than
  forced/faked in automation.

### Payment/billing UI — noted, not interacted with

- The owner sidebar has a `Payout` nav item (payment/payout setup). Per task instructions this was
  **not** clicked into or interacted with in any way — its mere existence in the sidebar is noted
  here for completeness only.

### Selectors confirmed working vs. needing updates (for Step 4 automation reuse)

**Still work exactly as in the reference script:**
- `page.getByRole('button', { name: 'Manage Your Lodge' })`, `page.getByRole('button', { name:
  'New Lodge' }).first()`, `page.getByRole('button', { name: 'English' }).first()`,
  `page.getByRole('button', { name: 'Next' }).first()`
- Lodge type card: `page.getByRole('button', { name: /^Entire Place/i }).first()`
- Category/Place Arrangement/Recommendation/Activity buttons by exact visible name, e.g.
  `page.getByRole('button', { name: 'Beachfront Villa' }).first()`
- Location selects: `page.getByRole('button', { name: 'City/Province*' })` /
  `'District'` / `'Commune'` / `'Village'`, each followed by
  `page.getByRole('option', { name: <value> }).first()`
- Lodge Live Editor section buttons via regex: `page.getByRole('button', { name: /Titles/i
  }).first()` (also works for Description/Bedroom/Bathroom/Policies — the accessible name includes
  a dynamic suffix like "* Required: KM, FR" or "* Completed" but the regex still matches)
- In-editor language switch: a button whose accessible name IS the current 2-letter code (`EN` /
  `KH` / `FR`) opens a `menu` with `menuitem`s `English` / `French` / `Khmer` — exactly as the
  reference script's `switchLanguage()` helper expects
- `New Room` / `New Bathroom` / `Add Policy` -> `Check-in/Check-out Policy` buttons — all match by
  exact visible name
- Final submit: `page.getByRole('button', { name: 'Request to review & Publish' }).first()` then
  `page.getByRole('button', { name: 'Confirm' }).first()` in the resulting `alertdialog`

**Needed updating / drifted from the reference script:**
- Lodge name input: the real placeholder is **"Enter the loge name"** (not "lodge name") — the
  script's `input[placeholder*="lodge name" i]` will NOT match this; it only succeeds via its
  `input[name*="propertyName" i]` / generic `[role="textbox"]` fallback locators. Prefer
  `page.getByRole('textbox', { name: /loge name/i })` going forward.
- Save buttons inside Lodge Live Editor sections (Titles/Description/Bedroom/Bathroom/Policy/
  Pricing) render the text "Save" only while **disabled**; once a field changes and Save becomes
  clickable, the button can render icon-only with no visible/accessible "Save" text in the
  snapshot tooling used here — `page.getByRole('button', { name: 'Save', exact: true })` resolved
  correctly in every case tested in this session, but plan to add a CSS/structural fallback (e.g.
  "last button inside the currently-open editor panel") if this proves flaky in real Playwright
  runs, since the accessible name is not guaranteed stable across the disabled/enabled state.
- The row-level Delete/Edit actions are inside a kebab/chevron `menu`, not directly on visible
  icon buttons with names — real specs should open the menu (`page.locator(...).last()` on the
  Actions cell, or a dedicated `aria-haspopup` button) and then use
  `page.getByRole('menuitem', { name: 'Edit' })` / `page.getByRole('menuitem', { name: 'Delete'
  })`, rather than guessing at the 3 unlabeled icon buttons that precede it (their exact purpose
  was not fully identified in this session beyond one of them also opening the editor directly).
- `.gm-style` map click (both in the New Lodge wizard's Location step) is unreliable via a bare
  click in this MCP tooling — real Playwright specs should keep the reference script's `{ force:
  true }` click but should also wrap it in a short retry/timeout guard, since a raw click can hang
  indefinitely against intercepting child elements.

---

## Customer Booking Cycle

**Date:** 2026-08-04
**Scenarios executed against:** `specs/planner/05-customer-booking.md`
**Account used:** the dedicated `.env.customer-test-account` account (`CUSTOMER_TEST_EMAIL` /
`CUSTOMER_TEST_PASSWORD`, not printed here), which resolves to a "QA Customer" profile with no
pre-existing bookings/wishlist items at the start of this session.
**Scope constraint honored:** payment was never submitted — exploration stopped at the "Payment"
step of the booking wizard (method selection + a `Payment` submit button) without clicking `Scan
QR`, `Payment`, or entering any card details.

### Summary tally

| Area | Result |
|---|---|
| Browse lodges (home page carousels/categories) | PASS |
| Lodge detail view (gallery, tabs, amenities, rooms, owner card, map) | PASS (1 gap: no reviews section) |
| Start booking — happy path up to Payment step | PASS (reached payment method screen, stopped there) |
| Booking validation (past dates, guest cap, checkin/checkout re-anchor, phone required) | PASS |
| Abandoned booking pre-payment → visible to customer as pending? | NO trace found (0 bookings) — see finding below |
| Wishlist add | PASS |
| Wishlist remove via lodge-detail toggle | **FAIL (defect confirmed)** — see below |
| Wishlist remove via dedicated wishlist-page button+dialog | PASS |
| Customer dashboard / My Booking / Notifications / Account Settings (read-only) | PASS |

### 1.1 Browse lodges — **PASS**

- `/en` home page: search hero ("Where do you want to go next?") with Location/Check-in-Check-out
  (defaulted to today+2 days)/Guests/Explore controls; a "Discover Lodges" carousel (Unique Stay,
  Get Around in Phnom Penh, Popular Lodges in KAMPOT, Dream Lodges in Siem Reap, Private Room in
  Phnom Penh) with slide dots ("01 / 05"); then one horizontally-scrollable row per category, each
  lodge card showing image, an `Add to wishlist` heart button, name, location, and "$X per night"
  price, linking to `/lodges/<slug>`.
- Clicked into "Lotus Lake Floating Villa" (`/en/lodges/lotus-lake-floating-villa`) for the
  remainder of this session's detail/booking testing.

### 1.2 Lodge detail view — **PASS, with one gap noted**

- Gallery: main image with `Open image gallery` lightbox trigger + 4 thumbnails (last showing
  "+1" overflow).
- Tabs: `Overview` (default) / `Rooms` / `Location` / `Policies`. Overview shows "About this place"
  description, "Activities You Can Enjoy" chips (Fishing/Swimming/Cycling/Hiking), "Amenities You
  Can Enjoy" chips (Air Conditioning/Gym/Breakfast Included/Free Parking/Pet Friendly/WiFi/Kitchen/
  Swimming Pool), and an embedded Google Map with zoom/expand controls and an "Open this area in
  Google Maps" link.
- "About this room": Bedroom/Bathroom/Kitchen Room/Guest Capacity counts (1/1/0/1 for this lodge),
  then expandable `Bedroom (1)` / `Bathroom (1)` cards with local-language titles, size ("12 x 1
  m"), and "Click to view details →". `Rooms`/`Location` tabs mirror this + a dedicated map;
  `Policies` tab shows an expandable "Check-in/Check-out Policy" ("Checkout is at 11:00 AM; late
  checkout incurs a 50% fee.").
- Owner card: avatar-initials button, owner name ("Den TOUCH"), "Identity Verified" badge,
  properties count ("12"), Joined date ("Mar 17, 2026"), owner's own location.
- **GAP**: no Reviews/Ratings section exists anywhere on the detail page (checked all 4 tabs).
- **Minor bug (new finding)**: the document `<title>` briefly renders in Khmer
  ("វីឡាលើទឹកបឹងឈូក \| Rural Loge") on first paint even though the URL locale is `/en`, before
  hydrating to the correct English title ("Lotus Lake Floating Villa \| Rural Lodge") — the same
  locale-leak pattern already documented for the New Lodge wizard in the Lodge Owner CRUD section
  above.

### 1.3 Start booking — happy path up to Payment step — **PASS**

- Booking widget: price/night, `Check-in — Check-out` button opening a "Select your dates" dialog,
  `Guests` button opening a "Guest details" dialog, an "Extra Services" section (e.g. "Cleaning
  Fee — Included with your booking — $0.01"), and a `Book Now` button (disabled until dates are
  chosen) with caption "You won't be charged yet."
- Selected check-in Thursday Aug 6, check-out Saturday Aug 8: trigger button updated to "Aug 6 -
  Aug 8"; CTA changed to enabled `Book for 2 nights`.
- Guests dialog showed Adults/Children/Pets steppers with a footer "Total guests (Adults) 1 of 1
  max" for this lodge's Guest Capacity of 1.
- Clicked `Book for 2 nights` → navigated to `/en/booking`, brief "Loading Your Booking... Fetching
  cart data" state, then resolved to `/en/booking?scheduleID=<uuid>` with a 3-step header (`1
  Personal Details` / `2 Payment` / `3 Complete`) and a live-countdown banner: "Your Booking is on
  Hold - We hold your booking for 15:00 minutes..." (observed ticking down to 14:53 within ~7
  seconds of real time).
- Summary panel matched exactly: Lodging (2 nights) USD $12/night = $24, Cleaning Fee $0.01,
  Subtotal $24.01, Tax (10%) $2.40, **Total $26.41**.
- Personal Details form: First Name ("QA") / Last Name ("Customer") / Email pre-filled from the
  account; `Phone Number*` empty and required — `Next Step` was disabled until it was filled
  (test data used: `012345678`); an optional `Telegram Number` field and a "Book for Another
  Person?" toggle were also present.
- Filled Phone Number, `Next Step` became enabled, clicked it → URL gained `&step=2`, page showed
  "Payment": a read-only "Book Information" recap (Full Name, Email, Phone, Telegram), and
  "Payment Details" with exactly two methods — **`Scan QR`** and **`Credit/Debit Card` (labelled
  "Coming Soon" — not implemented/selectable)** — plus `Back` and a final `Payment` button.
- **Stopped here per task scope**: did not click `Scan QR`, did not click `Payment`, entered no
  card details. This is the exact and only point in the entire customer flow where a real payment
  form/action is reached — confirmed its existence without submitting it.

### 1.4 Booking validation — **PASS**

- Past dates in the calendar (before "today", Aug 4 2026) are rendered as disabled buttons with
  accessible name "..., Not available, Price not available" and a "--" placeholder price —
  completely unclickable.
- Selecting check-in Aug 10, then clicking an *earlier* date (Aug 6) correctly **re-anchors**
  check-in to Aug 6 (discarding the Aug 10 pick) rather than erroring or accepting an invalid
  checkout-before-checkin range. Sensible, expected behavior.
- Guests dialog: with Adults at the lodge's max (1), the `+` button for Adults (and Children/Pets)
  is `disabled` — verified via `isDisabled()` and by attempting a click (no-op, count stayed at 1,
  no error shown). Consistent with the app-wide "disabled button instead of inline message"
  validation pattern documented in `01-authentication.md` and `04-lodge-owner.md`.
- Personal Details: `Next Step` gated solely on `Phone Number*` being non-empty; no additional
  format validation was observed.

### 1.5 Abandoned booking pre-payment — no trace found (follow-up noted) — **Finding, not a defect**

- After reaching the Payment step (an active 15-minute hold with a real `scheduleID`), navigating
  away to `/en/customer/dashboard` without clicking `Payment` showed **Total Bookings: 0** / no
  entry in "Recent bookings".
- `/en/customer/booking` under every status filter (`All`/`Pending`/`Confirmed`/`Checked In`/
  `Checked Out`/`Cancelled`/`Rejected`) showed "0 Total Bookings" / "No bookings found" — the
  held-but-unpaid reservation never surfaced as a customer-visible "Pending" booking.
- **Conclusion**: there is no "Request to Book without paying" path distinct from this flow — a
  booking only becomes a visible record after progressing past the point this task's scope allows
  (payment submission). **FOLLOW-UP for owner-side verification** (not performed here, per task
  instructions not to switch accounts mid-session): given the customer side shows zero trace of an
  abandoned hold, it is very likely the lodge owner's Reservations list (see Lodge Owner CRUD
  section above) also shows nothing for it — this should be confirmed directly from an owner
  session rather than assumed.

### 1.6 Wishlist — add PASS, lodge-detail remove is a **CONFIRMED DEFECT**, wishlist-page remove PASS

- Clicked `Save` on the lodge detail page: button label flipped to `Remove` immediately
  (optimistic UI). After a load delay (several seconds — see note below), `/en/customer/wishlist`
  correctly showed "1 Wishlist" with the lodge's thumbnail/name/location/price.
- **BUG (new finding)**: clicking the same detail-page button again while it read `Remove` flipped
  its label back to `Save` (visually looks like a successful removal), **but the item was not
  actually removed** — reloading `/en/customer/wishlist` still showed "1 Wishlist" with the same
  item present. This is a genuine, reproducible defect: the lodge-detail page's wishlist toggle
  updates its own local/optimistic UI state on the "remove" path without the change actually
  persisting server-side (the "add" path does persist correctly).
- Actual removal only succeeded via the **dedicated icon button on the Wishlist list page itself**
  (`aria-label="Remove from wishlist"`), which opens a real confirmation dialog: heading "Remove
  from Wishlist", body 'Are you sure you want to remove "Lotus Lake Floating Villa" from your
  wishlist?', buttons `Cancel`/`Remove`/`Close`. Clicking the dialog's `Remove` correctly emptied
  the wishlist ("0 items" / "Your wishlist is empty / Start browsing to add properties to your
  wishlist"), confirmed by reload.
- **Secondary minor finding**: the Wishlist list page has a slow/inconsistent loading experience —
  immediately after navigating to it (both right after adding, and on a plain page reload), it can
  render a completely blank content area (no item, no "0 items" text, no empty-state copy — just
  pagination controls) for several seconds before the real 1-item list appears. No loading
  spinner/skeleton is shown during this gap, which could read to a real user as "my wishlist is
  broken/empty" when it is actually just slow to load. Automation should poll/wait rather than
  assert immediately after navigation.

### 1.7 Customer dashboard and account area — **PASS**

- `/en/customer/dashboard`: sidebar `Dashboard`/`Booking`/`Notifications`/`Wishlist`/`Explore
  Lodge`, footer "Version 1.7.4 Powered by Rural Loge", header "Switch to hosting" link. Greeting
  "Hello, QA Customer", stat tiles all 0 for this fresh account, "Recent bookings" empty state "No
  bookings found / Please click the link below to explore lodge." / `Explore Lodge` button — a
  good, specific empty-state message (consistent with the "has-data vs empty" finding already
  documented in Error Handling 1.4 above).
- `/en/customer/booking` ("My Booking"): "0 Total Bookings", filter tabs `All`/`Pending`/
  `Confirmed`/`Checked In`/`Checked Out`/`Cancelled`/`Rejected`, same empty-state copy.
- `/en/customer/notification`: "0 new notifications", filter tabs `All`/`Read`/`Unread`, empty
  state "No notifications / You don't have any notifications yet."
- `/en/customer/accounts` ("Account Settings"): tabs `Account Settings`/`Security Settings`/
  `Notification`/`Delete Account`/`Sign Out`; Profile Picture upload area, `First Name`/`Last Name`
  fields pre-filled ("QA"/"Customer"), `Cancel`/`Update Profile` buttons. `Security Settings` tab
  showed "Change Password - Last changed 30 days ago".

### Environment note: shared browser context caused cross-session interference (not a product bug)

- Partway through this session, the MCP browser tab/cookies were found to have been taken over by
  a **different, concurrently-running session** logged in as another account ("Owner QA
  (Customer)", a distinct test account) that was actively navigating pages (observed landing on
  `/en/reservations` as an owner, `/en/profile-management`, `/en/dashboard`) in the same tab this
  exploration started in — causing some of this session's own clicks/navigations to appear to
  "succeed" against a snapshot that actually reflected the other session's page/account instead.
- **Resolution used**: opened a brand-new, fully isolated Playwright `BrowserContext` (via
  `browser.newContext()` from `browser_run_code_unsafe`) and drove all subsequent customer-flow
  testing through that isolated context/page, completely separate from the shared/contended tab.
- **Automation implication**: this is an artifact of manual/MCP exploration sharing one physical
  browser across concurrent agent sessions in this environment, not an application defect. Real
  Playwright Test suites are unaffected since each test already gets its own isolated
  `BrowserContext` by default — but this is worth flagging in case future exploratory/manual
  testing in this same shared staging environment produces confusing "my click did the wrong
  thing" results.

### Selectors confirmed working (for Step 4 automation reuse)

**Home page / browse:**
- Lodge card link: `page.getByRole('link', { name: /<Lodge Name>/ })` → `href="/lodges/<slug>"`
- Wishlist heart on a card: `page.getByRole('button', { name: 'Add to wishlist' })` (scope to the
  specific card's locator when there are multiple matches)

**Lodge detail page (`/{locale}/lodges/<slug>`):**
- Tabs: `page.getByRole('tab', { name: 'Overview' })` / `'Rooms'` / `'Location'` / `'Policies'`
- Save/Remove wishlist toggle: `page.getByRole('button', { name: 'Save' })` (becomes `page.getByRole('button', { name: 'Remove' })` after adding — **note the confirmed defect**: this "Remove" button does not reliably persist removal; prefer the wishlist-page removal flow in automation that needs a guaranteed-clean state)
- Date picker trigger: `page.getByRole('button', { name: 'Check-in — Check-out Select' })`
- Date dialog: `page.getByRole('dialog')` containing heading "Select your dates"; day buttons via
  `page.getByRole('button', { name: /August 6,/ })` (accessible name embeds weekday/month/day/
  availability/price, e.g. "Thursday, August 6, $12" or "..., Not available, Price not available"
  for disabled/past days)
- Guests trigger: `page.getByRole('button', { name: /Guests/ })`; Guests dialog:
  `page.getByRole('dialog')` with `+`/`-` stepper buttons (`page.getByRole('button', { name: '+' })` scoped to the dialog; three such pairs exist for Adults/Children/Pets — index them in document order)
- Booking CTA: `page.getByRole('button', { name: /Book (Now|for)/ })` (label changes from "Book
  Now" to "Book for N nights" once dates are chosen; disabled state persists until then)

**Booking wizard (`/{locale}/booking?scheduleID=<uuid>`):**
- Phone Number field: `page.getByPlaceholder('Enter your phone number')`
- Next Step / Back / Payment buttons: `page.getByRole('button', { name: 'Next Step' })` /
  `'Back'` / `'Payment'` (the final, un-clicked payment-submit button)
- Payment method buttons: `page.getByRole('button', { name: 'Scan QR' })` / `'Credit/Debit Card'`
  (the latter is a "Coming Soon" placeholder, not a real selectable option)

**Wishlist (`/{locale}/customer/wishlist`):**
- Remove icon (real removal): `page.getByRole('button', { name: 'Remove from wishlist' })`
- Confirm dialog: `page.getByRole('dialog').filter({ hasText: 'Remove from Wishlist' })`, then
  `.getByRole('button', { name: 'Remove', exact: true })` (careful: `exact: true` is required since
  the page also has a "Remove from wishlist" icon button whose name would otherwise partially
  match)

**Customer dashboard sidebar (`/{locale}/customer/*`):**
- `page.getByRole('link', { name: 'Dashboard' })` / `'Booking'` / `'Notifications'` / `'Wishlist'`
  / `'Explore Lodge'`
- Account menu → Account Settings: `page.getByRole('menuitem', { name: 'Account Settings' })` →
  `/​{locale}/customer/accounts`; tabs `page.getByRole('tab', { name: 'Security Settings' })` etc.

### General automation notes

- Prefer `waitUntil: 'load'` (not `'networkidle'`) for `page.goto()` on this app — background
  polling/websocket-style requests appear to keep the network from ever going fully idle, causing
  `networkidle` waits to time out at 30s even though the page is fully usable.
- The Wishlist list page in particular needs a generous wait/poll (several seconds observed) after
  navigation before asserting item count or empty-state text — see 1.6 above.
- When driving multiple logically-separate "sessions" (e.g. customer vs. owner) against this
  staging app in the same tooling run, prefer an isolated `browser.newContext()` per session
  rather than reusing one shared page/context, to avoid the cross-session interference described
  above.

---

## Lodge Owner — Other Modules

**Date:** 2026-08-04
**Account used:** the dedicated `OWNER_TEST_EMAIL` account from `.env.owner-test-account`
(display name "QA Owner", dual-role "Owner QA (Customer)" / Lodge Owner, 0 lodges / 0 reservations
/ 0 notifications at time of testing — a deliberately separate, "clean" account from the
`TEST_USER_EMAIL` account used for the Lodge Owner CRUD pass documented above).
**Scenarios executed against:** the new sections added to `specs/planner/04-lodge-owner.md`
(Reservations, Payout (view-only), Stay Management, Notifications, Profile / Account Settings).

### Summary tally

| Module | Result | Notes |
|---|---|---|
| Reservations | PASS (list/filter UI) / GAP (no data) | Filters and columns confirmed; approve/reject/confirm action not observable — 0 reservations |
| Payout (view-only) | PASS (view only) | Overview + Settings tabs documented; no real payment data entered/submitted |
| Stay Management | PASS (empty state) / GAP (no data) | Confirmed purpose (availability/pricing calendar) via empty-state copy; calendar itself not explorable — 0 lodges |
| Notifications | PASS (empty state) / GAP (no data) | Empty state confirmed; real notification content not observable — 0 notifications |
| Profile (name edit) | PASS | Reversible display-name edit round-tripped correctly and persisted |
| Account Settings | PASS (documented) / GAP (scope) | Notification-channel toggles found; no email/password change fields found anywhere in owner UI |

### Session note: login flakiness in this browser profile (environment, not an app defect)

Before reaching the owner dashboard, this session hit repeated instability: the shared browser
profile had **stale saved sessions/autofill for at least two other test accounts** ("OQ"/"Owner QA"
itself was actually already logged in at the very start of the session before any action was taken,
and a second unrelated account showing initials "CQ" appeared after a stray click). Chrome's
built-in saved-password autofill also silently overwrote `page.fill()`-set Email/Password values
with a different saved credential pair mid-flow on one attempt. Several clicks also resolved against
stale `aria-ref`s and landed on an unrelated lodge-detail link/card instead of the intended target
(most likely Playwright's actionability retry loop finally succeeding once a carousel had
auto-advanced new content under the same screen coordinates). None of this reflects an application
defect — closing/reopening the browser context and re-navigating fresh each time resolved it, and
credentials were verified via the account menu ("Owner QA (Customer)",
`30606f013e4c5595@web-library.net`) before proceeding. **Automation implication:** real Playwright
specs should use `context.clearCookies()` / a fresh incognito-style `browser.newContext()` per test
and disable password-manager autofill (`--disable-features=PasswordManagerOnboarding` or
per-context `permissions`) to avoid this class of flake.

### Reservations — **PASS (UI) / GAP (no data)**

- `/en/reservations?page=1&res_status=pending,confirmed,checkedIn` — default query pre-selects 3 of
  6 possible statuses. Header: `Export report` button, `Filter <N>` button, `Reservation Status: N`
  chip with reset icon.
- Filter dialog (`Filter Reservations`) confirmed 6 reservation statuses (`Cancelled`,
  `Checked In`, `Checked Out`, `Confirmed`, `Pending`, `Rejected`) and 5 payment statuses
  (`Awaiting Confirmation`, `Paid Out`, `Pending Payout`, `Pending Refund`, `Refunded`), plus an
  unexplored `Date Range` accordion.
- Table columns: No. / Code / Lodge / Check-in / Status / Guest / Payment / Created at / Actions.
- **GAP:** re-querying with all 6 statuses combined still returned "0 Reservations" / "No results
  found" — this account genuinely has no reservation data, so the owner-side approve/reject/confirm
  control (implied by the "Actions" column) could not be observed. Needs a follow-up pass with an
  owner account that has real pending bookings.

### Payout (view-only) — **PASS**

- `/en/payout`, two tabs: `Overview` (default) and `Settings`.
- Overview: `Payout Filters 1` button; 4 stat tiles (Total Earnings, Amount Paid, Pending Payouts,
  Awaiting Confirmation, all "$0"); Payout History table columns: No. / Transaction ID /
  Reservation Code / Status / Amount / Platform Fee / Payout Tax / Net Payout / Payment Method /
  Payment Date / Created At. Empty state: "No results found".
- Settings: a **disabled** combobox fixed to `KHQR` (Cambodia's national QR payment rail — appears
  non-configurable), a second empty combobox (native `<select>` hidden behind custom UI, likely a
  bank/provider picker — not interacted with), a QR-code upload dropzone ("PNG, JPG up to 5MB"),
  and a `Save Settings` button that is disabled by default. **No real bank/payment details were
  entered and nothing was submitted**, per task instructions.

### Stay Management — **PASS (empty state) / GAP (no data)**

- Sidebar `Stay Management` → `/en/lodges/calendar` (title "Calendar Lodge"); breadcrumb "Dashboard
  > Lodges > Stay Management" shows it's logically nested under Lodges.
- With 0 lodges, empty state reads: "No lodges yet" / "Create your first lodge to set availability,
  pricing, and stay rules from this calendar." + `Create lodge` link to `/en/lodges/new`. This
  copy itself confirms the module's purpose (a per-lodge availability/pricing/stay-rules calendar).
- **GAP:** the actual calendar grid and any date-availability toggle could not be exercised — this
  account has no lodge to select. Needs a follow-up pass against an owner with at least one lodge.

### Notifications — **PASS (empty state) / GAP (no data)**

- Sidebar "Others" > `Notifications` → `/en/notifications`; heading + "0 new notifications"
  counter, tabs `All` / `Read` / `Unread`. Empty state: "No notifications" / "You don't have any
  notifications yet."
- **GAP:** no real notification item was observed (this account has never received a booking
  request or status change to trigger one). Given the `notifications.getMy` /
  `notifications.getUnreadCount` tRPC calls already documented in `01-authentication.md`'s
  protected-route defect, this is backed by a real API; content/format needs a follow-up pass with
  an account that has actual reservation activity.

### Profile / Account Settings — **PASS**

- `/en/profile-management` ("Profile" in the sidebar) is the **public-facing** owner profile shown
  to travelers — "Add Cover Photo", avatar-initials circle, an editable display-name
  heading/button, "Joined <date>", and a "Pinned Lodges" drag-to-reorder section (0 here, no
  published lodges).
- **Reversible edit test:** clicked the name -> it became an inline textbox ("Enter your name")
  with save/cancel icons, and a page-level `Cancel` / `Save Changes` bar appeared. Changed
  `QA Owner` -> `QA Owner Test`, saved (inline check icon, then page-level `Save Changes`),
  reloaded the page, and confirmed both the Profile page and the sidebar user-info card correctly
  showed the new name and updated avatar initials (`QO` -> `QOT`) after a hard reload (i.e.
  server-persisted, not just optimistic UI). Reverted back to `QA Owner` the same way and
  reconfirmed after another reload — clean round-trip, **no bugs found**.
- **`/en/settings` ("Settings" under "Others") is a separate, narrower page:** `Notification` tab
  has 2 toggle switches (`Telegram`, `Telegram Group`, both off, not toggled in this pass);
  `Account` tab contains **only** a "Delete Account" section (OTP-verified deletion with a
  cancellable grace period) and a `Manage Account Deletion` link (not clicked — destructive/out of
  scope). **Finding/GAP:** no email or password change fields were found anywhere in the owner
  dashboard UI — the only directly-editable personal info is the display name on the public
  Profile page.
- **Dual-role toggle:** the sidebar user-info card has a `Switch to Traveller` button that
  navigates to `/en/customer/dashboard` (the Customer/Traveller dashboard), confirming this account
  is dual-role. Navigating directly back to `/en/dashboard` restores the Lodge Owner view — the
  toggle behaves as a navigation shortcut rather than a persisted account-wide mode flag.

### Selectors confirmed working (for Step 4 automation reuse)

- Sidebar nav (owner dashboard): `page.getByRole('button', { name: 'Reservations' })` /
  `'Payout'` / `'Profile'` / `'Stay Management'` / `'Notifications'` / `'Settings'` / `'Logout'`
- Reservations filter: `page.getByRole('button', { name: 'Filter' })` opens a dialog located via
  `page.getByRole('dialog')` containing `page.getByRole('checkbox', { name: 'Pending' })` etc.
- Payout tabs: `page.getByRole('main').getByRole('button', { name: 'Overview' })` /
  `{ name: 'Settings' }` (scope to `main` — "Settings" also matches the sidebar nav item)
- Profile inline name edit: click `page.getByRole('button', { name: '<current name>' })` to reveal
  `page.getByRole('textbox', { name: 'Enter your name' })`; the inline save icon is unlabeled
  (resolved via `page.getByRole('button').filter({ hasText: /^$/ }).nth(2)` in this session — a
  brittle index-based fallback; prefer a scoped container locator in real specs); the page-level
  commit button has an accessible name of `Save Changes`.
- Settings tabs: `page.getByRole('main').getByRole('button', { name: 'Notification' })` /
  `{ name: 'Account' }`
- Dual-role toggle: `page.getByRole('button', { name: 'Switch to Traveller' })`
