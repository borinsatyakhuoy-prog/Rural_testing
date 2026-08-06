# Rural Lodge - Customer Booking Cycle (Browse -> Book -> Pre-Payment -> Account)

## Application Overview

Covers the "customer" side rental cycle: browsing lodges from the home page, viewing a lodge's
detail page, running the booking widget (dates/guests) as far as the Payment step **without**
submitting any payment, and the customer's own account area (My Booking, Notifications, Wishlist,
Account Settings). Exploration on staging (logged in as the dedicated customer test account,
`.env.customer-test-account`, which resolves to a profile named "QA Customer") confirmed:

- **Booking is a 3-step wizard living at `/{locale}/booking?scheduleID=<uuid>`**: `1 Personal
  Details` -> `2 Payment` -> `3 Complete`. Reaching it holds the reservation server-side for a
  visible **15-minute countdown** ("Your Booking is on Hold - We hold your booking for 15:00
  minutes..."), but does **not** create any record visible in the customer's own "My Booking" list
  or dashboard stats until the flow progresses further than this exploration was permitted to go
  (Total Bookings stayed at 0 after abandoning mid-flow). There is no separate "Request to Book
  without paying" entry point distinct from this flow.
- **Payment step exposes exactly two methods**: `Scan QR` (a Bakong-style QR code payment) and
  `Credit/Debit Card` (explicitly labelled **"Coming Soon"**, i.e. not implemented/selectable yet).
  Per task scope this exploration stopped at this screen and did not click `Scan QR` or the final
  `Payment` button, and did not enter any card details.
- **The booking widget's required-field gating follows the same "disabled button, no inline
  message" pattern** documented elsewhere in this repo (`01-authentication.md`, `04-lodge-owner.md`):
  `Book Now` stays disabled (and unlabeled beyond "Book Now") until both check-in and check-out
  dates are chosen, at which point its label becomes dynamic ("Book for N nights"); on the
  Personal Details step, `Next Step` stays disabled until `Phone Number*` is filled (Name/Email are
  pre-filled from the account and don't block progress).
- **Guest count is hard-capped at the lodge's own "Guest Capacity"** value (shown under "About this
  room" on the detail page) - the Guests popover's `+` steppers for Adults/Children/Pets are
  disabled once the total reaches that cap, with no error message needed (correct, expected
  UX - not a defect).
- **A real, reproducible wishlist bug was found**: the lodge-detail page's `Save`/`Remove` toggle
  button visually flips to "Remove" after adding an item (correct), but clicking that same button
  again while it reads "Remove" flips the label back to "Save" **without actually removing the item
  server-side** - the item persists in `/{locale}/customer/wishlist` regardless. The only way to
  actually remove an item is the dedicated (icon-only, `aria-label="Remove from wishlist"`) button
  on the Wishlist list page itself, which opens a real confirmation dialog ("Remove from Wishlist -
  Are you sure...?") before removing it.
- **No Reviews/Ratings section exists anywhere on a lodge's detail page** (checked the Overview,
  Rooms, Location, and Policies tabs) - this may be a product gap versus typical booking-site
  expectations, or a feature not yet built; documented here as an observation, not asserted as a
  defect.
- **This staging environment can have concurrent sessions sharing browser state** - during
  exploration, the browser tab/cookies were briefly taken over by a different concurrent
  account/session. Real Playwright specs are unaffected by this (each test gets its own isolated
  `BrowserContext` by default), but manual/MCP-driven exploration in a shared browser should open
  an explicit new context/tab per session to avoid cross-contamination.

## Test Scenarios

### 1. Customer Booking Cycle

**Seed:** `tests/seed.spec.ts`

#### 1.1. Browse lodges from the home page

**File:** `tests/rural-lodge-test/customer-booking/browse-lodges.spec.ts`

**Steps:**
  1. Navigate to `https://staging-ruralloge.allweb.cloud/en`
    - expect: A search hero ("Where do you want to go next?") with `Location`, `Check In/Check
      Out` (defaulted to today + 2 days, e.g. "6 August"/"8 August"), `Guests` ("1 Guests"), and
      `Explore` controls
    - expect: A "Discover Lodges" carousel (category cards e.g. "Unique Stay", "Get Around in
      Phnom Penh", "Popular Lodges in KAMPOT", "Dream Lodges in Siem Reap", "Private Room in Phnom
      Penh") with `Previous slide`/`Next slide` and numbered dot navigation (e.g. "01 / 05")
    - expect: Below the carousel, one horizontally-scrollable row per category, each lodge shown as
      a card: image, an `Add to wishlist` heart button, name (heading), location text, and
      "$X per night" / "$X /night" price - each card links to `/lodges/<slug>`
    - expect: A `Show More` link/button per row and a `Scroll right` control for overflowing rows
  2. Click a lodge card (e.g. "Lotus Lake Floating Villa")
    - expect: Navigates to `/en/lodges/lotus-lake-floating-villa`

#### 1.2. Lodge detail page shows complete listing information

**File:** `tests/rural-lodge-test/customer-booking/lodge-detail-view.spec.ts`

**Steps:**
  1. Navigate to `/en/lodges/lotus-lake-floating-villa`
    - expect: A main image with `Open image gallery` (lightbox) plus 4 thumbnail buttons (last one
      showing a "+N" overflow badge)
    - expect: Heading with the lodge name, `Save` and `Share` buttons, and a location line (e.g.
      "Anlong Tnaot, Chi Kraeng, Chi Kraeng, Siemreap, Cambodia")
    - expect: Four tabs: `Overview` (selected by default), `Rooms`, `Location`, `Policies`
    - expect: Overview tab shows "About this place" (description paragraph), "Activities You Can
      Enjoy" (chips, e.g. Fishing/Swimming/Cycling/Hiking), "Amenities You Can Enjoy" (chips, e.g.
      Air Conditioning/Gym/WiFi/Kitchen/Swimming Pool/etc.), and an embedded Google "Map" with
      zoom/expand controls and an "Open this area in Google Maps" link
    - expect: An "About this room" block shows Bedroom / Bathroom / Kitchen Room / Guest Capacity
      counts (e.g. 1/1/0/1), followed by expandable `Bedroom (N)` and `Bathroom (N)` cards, each
      showing a local-language title, size (e.g. "12 x 1 m"), and "Click to view details ->"
    - expect: `Rooms` tab and `Location` tab show the same room detail / map content in a
      dedicated section; `Policies` tab shows an expandable "Check-in/Check-out Policy" accordion
      (e.g. "Checkout is at 11:00 AM; late checkout incurs a 50% fee.")
    - expect: An owner card is shown: avatar-initials button, owner name button (e.g. "Den TOUCH"),
      an "Identity Verified" badge, a `properties` count, a `Joined` date, and the owner's own
      location text
    - expect: GAP/observation - no reviews or star-rating section is present anywhere on the page
      (Overview/Rooms/Location/Policies) for this lodge
  2. Note the page `<title>` on first paint
    - expect: MINOR BUG - the document title briefly renders in Khmer (e.g. "វីឡាលើទឹកបឹងឈូក |
      Rural Loge") even though the URL locale is `/en`, before hydrating to the correct English
      title ("Lotus Lake Floating Villa | Rural Lodge") a moment later - the same locale-leak
      pattern already documented for the "New Lodge" wizard in `04-lodge-owner.md`

#### 1.3. Happy path: start a booking through to the Payment step (no payment submitted)

**File:** `tests/rural-lodge-test/customer-booking/booking-happy-path-pre-payment.spec.ts`

**Steps:**
  1. On the lodge detail page's booking widget, click `Check-in — Check-out Select check-in and
    checkout dates`
    - expect: A `dialog` "Select your dates" opens with month navigation (`Previous`/`Next`,
      month/year buttons) and a day grid; each day's accessible name is e.g. "Thursday, August 6,
      $12" (available) or "..., Not available, Price not available" (blocked, see 1.4)
  2. Click an available check-in day (e.g. "Thursday, August 6"), then an available check-out day
    after it (e.g. "Saturday, August 8")
    - expect: After the first click, that day's label updates to include "Selected check-in" and a
      `Clear Selected` button appears in the dialog footer
    - expect: After the second click, the dialog closes; the trigger button now reads "Aug 6 - Aug
      8"; the sidebar's primary CTA changes from disabled `Book Now` to enabled `Book for 2
      nights`; a caption "You won't be charged yet." remains visible under the button
  3. Click the `Guests` button, then attempt to increase Adults beyond the lodge's Guest Capacity
    - expect: A `dialog` "Guest details" shows Adults/Children/Pets steppers with `-`/`+` buttons
      and a footer "Total guests (Adults) N of MAX max"; once at MAX, all three `+` buttons are
      disabled (no error toast needed - see 1.4 for the negative-path writeup)
  4. Click `Book for 2 nights`
    - expect: Navigates to `/en/booking`, briefly shows "Loading Your Booking... Fetching cart
      data", then resolves to `/en/booking?scheduleID=<uuid>` with a 3-step header (`1 Personal
      Details`, `2 Payment`, `3 Complete`) and a banner "Your Booking is on Hold - We hold your
      booking for 15:00 minutes..." (a live countdown)
    - expect: A right-hand summary panel shows the lodge name, Total Rooms, Check In/Check Out
      dates, Guests Details, and a Price Details breakdown (Lodging N nights x $/night + Cleaning
      Fee = Subtotal, + Tax 10% = Total) that matches the widget's earlier selections exactly
  5. On the "Personal Details" form, verify First Name/Last Name/Email are pre-filled from the
    logged-in account, fill the required `Phone Number*` field (test data: any digits, e.g.
    `012345678`), and click `Next Step`
    - expect: `Next Step` is disabled until `Phone Number*` is non-empty (First/Last/Email being
      pre-filled do not block progress); an optional `Telegram Number` field and a "Book for
      Another Person?" toggle are also present
    - expect: After clicking `Next Step`, the URL gains `&step=2` and the page shows "Payment"
    - expect: A read-only "Book Information" recap shows the submitted Full Name/Email/Phone/
      Telegram; a "Payment Details" section shows exactly two methods: `Scan QR` and `Credit/Debit
      Card` (labelled **"Coming Soon"**); `Back` and `Payment` buttons are present
  6. STOP HERE - do not click `Scan QR`, do not click `Payment`, and do not enter any card/payment
    details. Document that the payment form exists and is reached at this exact point.
    - expect: No payment fields (card number, expiry, CVV) are visible before this step; the "Scan
      QR" / "Credit/Debit Card" choice and the "Payment" button are the first and only
      payment-related UI encountered in the entire customer flow

#### 1.4. Negative/validation: date and guest-count constraints

**File:** `tests/rural-lodge-test/customer-booking/booking-validation.spec.ts`

**Steps:**
  1. Open the date picker and inspect days before today
    - expect: Every past day (e.g. "Sunday, July 26") is rendered as a disabled button with
      accessible name "..., Not available, Price not available" and a "--" placeholder instead of a
      price - these cannot be clicked/selected at all
  2. Select a check-in date (e.g. August 10), then click an **earlier** date (e.g. August 6) as the
    next click
    - expect: The earlier date (August 6) becomes the new "Selected check-in" (its accessible name
      updates accordingly), silently discarding the August 10 selection, rather than erroring or
      allowing an invalid checkout-before-checkin range - this is correct, expected behavior, not a
      defect
  3. Open the `Guests` dialog for a lodge whose "Guest Capacity" is 1, and click the Adults `+`
    button
    - expect: The `+` button is disabled (verified via `isDisabled()`); clicking it produces no
      change (count stays at 1) and no error message - consistent with the app's
      disabled-button-instead-of-message validation pattern used everywhere else
  4. On the Personal Details step, leave `Phone Number*` empty and inspect `Next Step`
    - expect: `Next Step` remains disabled; test data for the positive case is any non-empty digit
      string (no client-side format validation was observed to reject additional characters beyond
      requiring non-empty)

#### 1.5. Abandoning a booking pre-payment leaves no trace in the customer's own booking list

**File:** `tests/rural-lodge-test/customer-booking/abandoned-booking-no-trace.spec.ts`

**Steps:**
  1. Complete steps 1.3.1-1.3.5 (reach the Payment step with an active "Booking is on Hold"
    countdown), then navigate away (e.g. to `/en/customer/dashboard`) without clicking `Payment`
    - expect: The dashboard's "Total Bookings" / "Recent Bookings" stats read 0 (no new row for the
      abandoned booking)
  2. Navigate to `/en/customer/booking` and check every status filter tab (`All`, `Pending`,
    `Confirmed`, `Checked In`, `Checked Out`, `Cancelled`, `Rejected`)
    - expect: "0 Total Bookings" and "No bookings found" under every filter - the held-but-unpaid
      reservation does not surface as a "Pending" booking anywhere in the customer's own UI
    - expect: FOLLOW-UP (not verified in this session per task scope, which excludes payment): since
      no pending record appears even on the customer side, it is likely the lodge owner's
      Reservations list also would not show anything for an abandoned/unpaid booking attempt - this
      should be confirmed independently from the owner account (see `04-lodge-owner.md`) rather than
      assumed, and rather than switching accounts mid-session here

#### 1.6. Wishlist: add and remove a lodge

**File:** `tests/rural-lodge-test/customer-booking/wishlist.spec.ts`

**Steps:**
  1. On a lodge detail page, click `Save`
    - expect: The button's label/state immediately flips to `Remove` (optimistic UI)
    - expect: After navigating to `/en/customer/wishlist` (allow a few seconds - see bug note
      below), the lodge appears with a "1 Wishlist" count, thumbnail, name, location, and price
  2. BUG: on the same lodge detail page, click the button again while it reads `Remove`
    - expect (actual/buggy): the button's label flips back to `Save` (looks successful), but the
      item is **not** actually removed - reloading `/en/customer/wishlist` still shows the item and
      "1 Wishlist". This is a real defect: the detail-page toggle does not properly call/await the
      remove mutation (or ignores its result) even though it updates its own local UI state
  3. To actually remove the item, go to `/en/customer/wishlist` and click the dedicated icon button
    (`aria-label="Remove from wishlist"`) on the item's card, then confirm in the dialog
    - expect: A confirmation `dialog` "Remove from Wishlist" appears: "Are you sure you want to
      remove "<name>" from your wishlist?" with `Cancel`/`Remove`/`Close`
    - expect: Clicking the dialog's `Remove` button actually empties the wishlist ("0 items" /
      "Your wishlist is empty / Start browsing to add properties to your wishlist")
  4. Test data / automation note: allow generous wait/poll time (several seconds observed) after
    both adding and removing before asserting the wishlist page's item count - the list page was
    observed to briefly render **no items and no empty-state copy at all** (just pagination
    controls) immediately after a fresh navigation/reload, before the real data arrived a few
    seconds later; this looks like a missing loading skeleton, not an actual empty/error state -
    tests should wait for network idle or poll rather than asserting immediately on navigation

#### 1.7. Customer dashboard and account area (read-only tour)

**File:** `tests/rural-lodge-test/customer-booking/customer-dashboard.spec.ts`

**Steps:**
  1. Navigate to `/en/customer/dashboard` (via the account-menu "My Booking" link or directly)
    - expect: Sidebar shows `Dashboard`, `Booking`, `Notifications`, `Wishlist`, `Explore Lodge`,
      an app version footer ("Version 1.7.4 Powered by Rural Loge"), and a "Switch to hosting" link
      in the header
    - expect: Greeting "Hello, <First> <Last>", stat tiles "TOTAL BOOKINGS" / "RECENT BOOKINGS" /
      "NOTIFICATION" (0 each for a fresh account), and a "Recent bookings" panel with the clear
      empty-state copy "No bookings found" / "Please click the link below to explore lodge." /
      `Explore Lodge` button
  2. Navigate to `Booking` (`/en/customer/booking`)
    - expect: Title "My Booking", "0 Total Bookings", and filter tabs `All`/`Pending`/`Confirmed`/
      `Checked In`/`Checked Out`/`Cancelled`/`Rejected`; same "No bookings found" empty state
  3. Navigate to `Notifications` (`/en/customer/notification`)
    - expect: "0 new notifications", filter tabs `All`/`Read`/`Unread`, empty state "No
      notifications / You don't have any notifications yet."
  4. Navigate to `Wishlist` (`/en/customer/wishlist`)
    - expect: "My Wishlist", item count, "Filter Options", pagination ("Page 1 of 1 | Go to page"),
      empty state "Your wishlist is empty / Start browsing to add properties to your wishlist"
      (when empty)
  5. Open the account-initials menu -> `Account Settings` (`/en/customer/accounts`)
    - expect: Tabs `Account Settings` / `Security Settings` / `Notification` / `Delete Account` /
      `Sign Out`; a Profile Picture upload area ("Drag and drop your image here, or click to
      browse"), `First Name`/`Last Name` text fields pre-filled from the account, and `Cancel`/
      `Update Profile` buttons
    - expect: `Security Settings` tab shows "Change Password" with a "Last changed N days ago" note

#### 1.8. NEW FINDING (Cycle 4): every "Explore Lodge" CTA in the customer dashboard opens a new browser tab

**File:** `tests/rural-lodge-test/customer-booking/009_explore-lodge-cta-opens-new-tab.spec.ts`

**Added:** Cycle 4, via live exploration with Playwright MCP (not in the original plan). Confirmed
reproducible across all 3 "Explore Lodge" instances on the dashboard page (the sidebar link, the
greeting-header button, and the "No bookings found" empty-state button): each opens `/{locale}` in
a **brand-new browser tab**, unlike every other in-shell link (`Booking`/`Notifications`/`Wishlist`),
which navigates in the same tab as expected. Documented as current behavior (asserted so it passes
today, the same "regression lock-in" pattern already used for the Offers copy bug in
`02-navigation.md` 1.12) rather than as a hard failure, since it may be an intentional design choice
(escaping the authenticated dashboard shell into the separate public marketing site) - but it is a
genuine UX inconsistency worth a product decision, since a customer clicking it repeatedly
accumulates orphaned dashboard tabs with no way back except closing them manually.

**Steps:**
  1. Land on the empty `/{locale}/customer/dashboard` (0 bookings), locate the "No bookings found"
    panel's `Explore Lodge` button, and click it while listening for a new-page/popup event
    - expect: A new browser tab opens, navigating to `/{locale}` (the public home page)
    - expect: The original dashboard tab's URL is unchanged (still `/customer/dashboard`) - the
      click did not navigate the current tab at all
  2. Recommendation: get explicit product sign-off on whether this is intentional; if not, the fix
    is likely to drop `target="_blank"` (or its Next.js `<Link>` equivalent) from these 3 CTAs so
    they behave like every other sidebar link
