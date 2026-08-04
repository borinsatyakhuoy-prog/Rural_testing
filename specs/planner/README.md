# Rural Lodge - Playwright Test Plan (Step 2)

Application under test: **https://staging-ruralloge.allweb.cloud** (Khmer/English/French rural-lodge booking site).
Source story: [`user-stories/SCRUM.md`](../../user-stories/SCRUM.md).

This plan was produced by driving the live staging app with Playwright (via the `playwright-test`
MCP planner tools) rather than guessing from the story text alone. Real field labels, button text,
nav item names, error copy, and URLs were captured directly from the app and are quoted verbatim
in each domain file below. Where the real UI differs from what the story assumed, that is called
out explicitly (see "Key findings" below) instead of silently rewriting the story's intent.

## Domain files

| File | Covers | Scenario count |
|---|---|---|
| [`authentication.md`](./authentication.md) | AC1 - login (happy path + negative), Forgot password / OTP reset, password visibility, Sign In/Sign Up tabs, logout, protected-route session behavior | 9 |
| [`navigation.md`](./navigation.md) | AC2 - top navigation bar (Stay / Offers / Activity), FR/EN/KH language toggle, locale-in-URL behavior, header consistency | 9 |
| [`error-handling.md`](./error-handling.md) | Cross-cutting "no silent failure" requirement - invalid login message, empty-field feedback, no-data states, and the one real defect found (silent failure on a protected route) | 4 |

Each scenario in every file has: a clear title, numbered step-by-step **perform** actions, an
**expect** list of observable results per step, and the test data it needs (env-driven credentials,
or explicit sample strings for negative cases). These are written so Step 4 (automation generation)
can turn each scenario directly into a Playwright spec under `tests/rural-lodge-test/<domain>/`.

## Key findings from live exploration (real UI vs. story assumptions)

- **Locales are URL-driven**: `/km` (Khmer, default), `/en` (English), `/fr` (French). The bare
  domain root (`/`) always redirects to `/km`; it does not remember a previously chosen language.
- **Login redirect target**: valid credentials redirect to the **public home page**
  (`/{locale}`), not to a "Dashboard" as the story assumes. A real Dashboard exists at
  `/{locale}/customer/dashboard` (with a sidebar: Dashboard, Booking, Notifications, Wishlist,
  Explore Lodge) but it is only reached via the account menu after login, not as the landing page.
- **Empty-field validation**: the `Continue` button simply stays disabled while either field is
  empty, so a truly empty submit can't happen via the UI. Touching then clearing a field marks it
  invalid (red outline / `aria-invalid`) on blur, but **no inline text message** (e.g. "Email is
  required") is ever shown - this is a gap versus the story's "inline required validation" wording
  and is documented as such rather than asserted as passing text.
- **Invalid credentials**: correctly show the specific message *"Invalid email or password. Please
  try again."* and keep the user on `/auth` - this matches the story well.
- **Forgot password**: the link opens an **in-place OTP reset panel** (same URL, no navigation) -
  "Reset password" / "Enter your email to receive an OTP." / "Send OTP" / "Back to login" - rather
  than navigating to a separate route.
- **Logout**: requires confirming a **"Confirm Logout"** dialog, and afterwards leaves the user on
  the current page - it does not force a redirect to `/login`.
- **Known defect / gap**: opening a protected route (e.g. `/en/customer/dashboard`) directly while
  logged out does **not** redirect to `/login` as AC1 assumes. Instead it silently renders a
  degraded dashboard shell ("Hello,", "No stats available", "No bookings found") while the browser
  console logs repeated `"Authentication token not found in cookies"` tRPC errors. This violates
  both AC1 and the Error Handling AC ("no silent failure or broken page") and is captured as its
  own test in both `authentication.md` and `error-handling.md`, written to assert the *expected*
  redirect-to-login behavior so it fails and is tracked until fixed.
- **Language toggle**: is a header icon button present on every page (home, auth, logged-in,
  logged-out) - not only on one screen - and fully translates nav labels, hero copy, and header
  button text across all three languages.
