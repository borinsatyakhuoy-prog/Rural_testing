# Rural Lodge - Error Handling and No-Data States

## Application Overview

Cross-cutting checks for the story's Error Handling requirement: invalid login, empty required fields, and no-data states must all produce a visible, specific message rather than a silent failure or broken page. These tests intentionally overlap with individual scenarios in authentication.md and navigation.md but frame them from the 'is the failure visible and specific?' angle, and add the one genuine defect found during exploration: opening a protected route while logged out silently renders a broken dashboard shell instead of showing any message or redirecting.

## Test Scenarios

### 1. Error Handling and No-Data States

**Seed:** `tests/seed.spec.ts`

#### 1.1. Invalid login produces a specific, visible error message rather than a silent failure

**File:** `tests/rural-lodge-test/error-handling/invalid-login-message.spec.ts`

**Steps:**
  1. Navigate to /en/auth and submit an incorrect email ('wrong.user@example.com') and password ('WrongPassword123!')
    - expect: The exact text 'Invalid email or password. Please try again.' is rendered inline near the Password field within a reasonable time (no indefinite spinner)
    - expect: The page does not go blank, throw an unhandled error overlay, or silently do nothing
    - expect: The user remains able to correct the fields and resubmit

#### 1.2. Empty required fields give a visible invalid state but currently lack a text message (documented gap)

**File:** `tests/rural-lodge-test/error-handling/empty-fields-message-gap.spec.ts`

**Steps:**
  1. Navigate to /en/auth, type then clear a character in the Email field, and blur it
    - expect: The field is visibly marked invalid (red outline / aria-invalid=true)
  2. Search the page for any text such as 'required', 'Email is required', or similar near the field
    - expect: GAP: no such text is found on staging as of 2026-08-04 — the only feedback is the visual outline; recommend the product add an explicit inline message so screen-reader and low-vision users get a specific reason, matching the story's own wording of 'inline required validation'

#### 1.3. DEFECT: protected route access without a session fails silently instead of showing a message or redirecting

**File:** `tests/rural-lodge-test/error-handling/protected-route-silent-failure.spec.ts`

**Steps:**
  1. Log out (or start with no session) and navigate directly to /en/customer/dashboard
    - expect: No visible error banner, toast, or message tells the user they are not authenticated
    - expect: The page instead renders a degraded shell: 'Hello,' (no name), 'No stats available', 'No bookings found', with no indication anything went wrong
    - expect: Dev tools console shows repeated 'Authentication token not found in cookies' tRPC errors for notifications.getMy / notifications.getUnreadCount / booking.getBookings — confirming the failure is real but surfaced only in the console, not to the user
    - expect: This directly violates the story's Error Handling AC ('no silent failure or broken page'); the test should assert the CORRECT behavior (redirect to /login or a clear 'please sign in' message) so it fails and tracks the defect until fixed

#### 1.4. No-data states (e.g. an account with zero bookings) show clear, specific messaging

**File:** `tests/rural-lodge-test/error-handling/no-data-states.spec.ts`

**Steps:**
  1. Log in with a valid test account and open the Dashboard ('/en/customer/dashboard') or My Booking ('/en/customer/booking') view
    - expect: If the account has bookings, real booking cards are listed
    - expect: If the account (or a filtered tab, e.g. a status filter with no matches) has no data, the UI shows explicit copy such as 'No stats available' / 'No bookings found' plus a helpful call-to-action ('Please click the link below to explore lodge.' / 'Explore Lodge' button) rather than an empty blank area
    - expect: This compliant behavior should be protected with a regression test since it already meets the 'visible, specific message' requirement
