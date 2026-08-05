# Rural Lodge - Authentication

## Application Overview

Rural Lodge (https://staging-ruralloge.allweb.cloud) is a multilingual (KM/EN/FR) lodge-booking site. This suite covers AC1 (Authentication): login (happy path and negative), the "Forgot password?" OTP reset flow, logout, and protected-route session behavior. Exploration on staging showed several realities that differ from the story's assumptions: (1) submitting valid credentials redirects to the public home page ("/{locale}"), not to a "Dashboard" — a separate Dashboard exists at "/{locale}/customer/dashboard" reachable only from the account menu after login; (2) empty required fields never let you click "Continue" (it stays disabled) and once a field is touched-then-emptied it only gets a red "invalid" outline with no inline text message — there is no "Email is required" style copy; (3) invalid credentials correctly show the specific inline message "Invalid email or password. Please try again." and keep the user on /auth; (4) logout requires a "Confirm Logout" dialog and afterwards leaves the user on the current page rather than forcing a redirect; (5) directly opening a protected route (e.g. /en/customer/dashboard) after logout does NOT redirect to /login as the story assumes — it renders a broken/empty dashboard shell while the console silently logs "Authentication token not found in cookies" tRPC errors. That last point is a real defect/gap and is captured as its own test so it is tracked (expected: redirect to login) rather than silently accepted.

## Test Scenarios

### 1. Authentication

**Seed:** `tests/seed.spec.ts`

#### 1.1. Happy path: valid login redirects to home page and shows authenticated header

**File:** `tests/rural-lodge-test/authentication/login-happy-path.spec.ts`

**Steps:**
  1. Navigate to https://staging-ruralloge.allweb.cloud/en/auth
    - expect: Page title is 'Login - Rural Lodge'
    - expect: Heading 'Login to your account' is visible
    - expect: Email and Password textboxes are visible and empty
    - expect: The 'Continue' button is present and disabled
  2. Fill Email with the valid test user address (env TEST_USER_EMAIL) and Password with the valid test user password (env TEST_USER_PASSWORD). Test data: values are read from the project's .env file, never hard-coded or logged.
    - expect: The 'Continue' button becomes enabled once both fields are non-empty
  3. Click the 'Continue' button
    - expect: The app navigates to the home page at '/{locale}' (e.g. '/en'), title 'Welcome to Rural Lodge'
    - expect: The header's login icon is replaced by a user-initials button (e.g. 'JA'), confirming an authenticated session
    - expect: Note: this differs from the story wording 'redirected to the Dashboard' — assert the home-page redirect as the real behavior, and treat a direct redirect to '/{locale}/customer/dashboard' as a separate, currently-not-implemented enhancement rather than a regression

#### 1.2. Negative: invalid credentials show a specific inline error and stay on the login page

**File:** `tests/rural-lodge-test/authentication/login-invalid-credentials.spec.ts`

**Steps:**
  1. Navigate to /en/auth
    - expect: Login form is visible
  2. Fill Email with 'wrong.user@example.com' and Password with 'WrongPassword123!' (test data: any syntactically valid but non-existent/incorrect credential pair)
    - expect: 'Continue' button becomes enabled
  3. Click 'Continue'
    - expect: The URL remains '/en/auth' (returnUrl query preserved if present) — no navigation away from the login page
    - expect: An inline message reading exactly 'Invalid email or password. Please try again.' appears near the Password field
    - expect: Both Email and Password fields are marked invalid (red outline / aria-invalid)

#### 1.3. Negative: empty required fields keep submission disabled and only show a red-outline invalid state (no text message)

**File:** `tests/rural-lodge-test/authentication/login-empty-fields.spec.ts`

**Steps:**
  1. Navigate to /en/auth
    - expect: 'Continue' button is disabled while Email and Password are both empty
  2. Click into the Email field, type a single character, clear it back to empty, then click elsewhere to blur it
    - expect: The Email textbox is marked aria-invalid / shows a red outline
    - expect: GAP vs the story's 'inline required validation' wording: no visible text such as 'Email is required' is rendered anywhere near the field — assert only the invalid visual state, and log this text-message gap as a finding rather than asserting text that does not exist
  3. Repeat the same touch-then-clear-then-blur sequence on the Password field
    - expect: The Password textbox also shows the red/invalid outline with no accompanying text message
    - expect: 'Continue' remains disabled throughout since both fields are empty

#### 1.4. Forgot password link opens an in-place OTP reset flow and can return to login

**File:** `tests/rural-lodge-test/authentication/forgot-password.spec.ts`

**Steps:**
  1. Navigate to /en/auth
    - expect: 'Forgot password?' link/button is visible below the 'Continue' button
  2. Click 'Forgot password?'
    - expect: The URL does not change (still '/en/auth'); the login form is replaced in place by a reset panel
    - expect: Heading 'Reset password' and helper text 'Enter your email to receive an OTP.' are visible
    - expect: An Email field (placeholder 'you@example.com') and the text "We'll send a 6-digit code if the email exists." are visible
    - expect: 'Send OTP' button is disabled and a 'Back to login' button is visible
  3. Type a test email address (e.g. the TEST_USER_EMAIL value) into the reset Email field
    - expect: 'Send OTP' button becomes enabled
  4. Click 'Back to login'
    - expect: The original Sign In form (Email, Password, Continue) is restored

#### 1.5. Password field visibility toggle masks and reveals the typed password

**File:** `tests/rural-lodge-test/authentication/009_password-visibility-toggle.spec.ts`

**Steps:**
  1. Navigate to /en/auth and type any string, e.g. 'Test1234!', into the Password field
    - expect: Characters render masked (type=password) by default
  2. Click the eye icon button inside the Password field
    - expect: The typed password becomes visible as plain text (type=text)
  3. Click the same icon again
    - expect: The password is masked again

#### 1.6. Sign In / Sign Up tab switch toggles the auth form mode

**File:** `tests/rural-lodge-test/authentication/010_auth-tab-switch.spec.ts`

**Steps:**
  1. Navigate to /en/auth and confirm the 'Sign In' tab is selected by default
    - expect: Tablist 'Authentication switch' shows 'Sign In' selected and 'Sign Up' unselected
  2. Click the 'Sign Up' tab
    - expect: 'Sign Up' becomes the selected tab and a registration form is displayed instead of the login form
  3. Click the 'Sign In' tab
    - expect: The original login form (Email, Password, Continue, Forgot password?) is restored

#### 1.7. Logout requires confirmation and ends the authenticated session

**File:** `tests/rural-lodge-test/authentication/logout.spec.ts`

**Steps:**
  1. Log in with valid test credentials (see 'Happy path' test) so the header shows the user-initials button
    - expect: Header shows the user-initials button (e.g. 'JA') instead of the login icon
  2. Click the user-initials button to open the account menu
    - expect: A menu opens with items including 'My Booking' (or 'Explore Lodge' when on the dashboard), 'Account Settings', and 'Logout'
  3. Click 'Logout'
    - expect: A confirmation dialog titled 'Confirm Logout' appears with the text 'Are you sure you want to log out of your account?' and 'Cancel' plus a confirming 'Logout' button
  4. Click the confirming 'Logout' button in the dialog
    - expect: The dialog closes
    - expect: The header reverts to the logged-out state: the user-initials button is replaced by the generic login icon
    - expect: The user remains on the page they logged out from (no automatic redirect to /login was observed when logging out from a public page such as home or the dashboard)

#### 1.8. KNOWN GAP: opening a protected route while logged out does not redirect to /login

**File:** `tests/rural-lodge-test/authentication/protected-route-redirect.spec.ts`

**Steps:**
  1. Ensure there is no authenticated session (log out first, or start with cleared cookies/local storage)
    - expect: Header shows the logged-out login icon
  2. Navigate directly to https://staging-ruralloge.allweb.cloud/en/customer/dashboard
    - expect: EXPECTED (per story AC1): the app redirects to '/login' (or the localized '/en/auth')
    - expect: ACTUAL (observed on staging, 2026-08-04): the URL stays at '/en/customer/dashboard'; the page renders a degraded dashboard shell reading 'Hello,' (no name), 'No stats available', and 'No bookings found' instead of redirecting
    - expect: The browser console logs repeated tRPC errors: 'Authentication token not found in cookies' for the notifications.getMy, notifications.getUnreadCount, and booking.getBookings queries
    - expect: Write this test asserting the EXPECTED redirect-to-login behavior so it fails loudly and is tracked as a defect until the app is fixed, rather than asserting the current broken behavior as correct

#### 1.9. 'Manage Your Lodge' correctly redirects an unauthenticated user to login

**File:** `tests/rural-lodge-test/authentication/011_manage-lodge-redirects-unauthenticated.spec.ts`

**Steps:**
  1. Ensure logged out, then navigate to the home page '/en'
    - expect: 'Manage Your Lodge' button is visible in the header
  2. Click 'Manage Your Lodge'
    - expect: The app redirects to '/en/auth?returnUrl=%2F' (the login page)
    - expect: This confirms auth-gating works correctly for this entry point, in contrast to the dashboard route in the 'KNOWN GAP' test above
