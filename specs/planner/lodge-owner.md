# Rural Lodge - Lodge Owner CRUD (Create / Read / Update / Delete)

## Application Overview

Covers the "lodge owner" side of the app: creating a new lodge listing, viewing the owner's own
lodge list, editing an existing lodge, and deleting one. Exploration on staging (logged in as the
`.env` test account, which resolves to a "Lodge Owner" profile named "teba gof" with 40+ existing
lodges) confirmed the reference script's flow (`Manage Your Lodge` -> `New Lodge` -> language ->
lodge type -> name/description/category/etc -> location -> amenities -> image -> price -> `Lodge
Live Editor` -> `Request to review & Publish`) still works end-to-end, with these real-world
differences from what the script assumes:

- **`Manage Your Lodge` navigates to a full owner dashboard**, not a modal — it goes straight to
  `/{locale}/dashboard`, a page with its own sidebar (Dashboard / Lodges / Reservations / Payout /
  Profile / Stay Management) and a `New Lodge` button. The reference script's click sequence still
  works because that dashboard also exposes a `New Lodge` button in the same position.
- **The wizard silently auto-creates a persisted "Draft" lodge row as soon as you start filling it
  in** — even if you never reach the final "Request to review & Publish" step. This was observed
  directly: the owner's "Total Lodge" count on the dashboard increased, and a partially-filled
  lodge appeared in the `/en/lodges` list with status "Draft", after a browser-context crash
  aborted an in-progress wizard run. Automation and manual testers should account for this: a
  cancelled/abandoned "New Lodge" attempt is NOT a no-op — it leaves orphaned Draft data.
- **The lodge name field's placeholder is "Enter the loge name"** (branding uses "Loge", the French
  word, throughout the owner UI: "Loge Information", "Loge Location", "Add Loge", nav item
  "Lodges" but page heading "Loges") — the reference script's locator
  `input[placeholder*="lodge name" i]` will NOT match this placeholder text (it has no literal
  substring "lodge name"); it only matches through its `name*="propertyName"` / `contenteditable`
  fallback selectors.
- **The wizard's own language-selection heading rendered in French** ("Quelle langue
  souhaitez-vous utiliser ?") even though the browser was on the `/en` locale — a locale/state leak
  between the site-wide locale and the wizard's separately-remembered "last used lodge language".
- **The Location step's map pin ("Location on Map *") is a real required field** — the `Next`
  button on that step stays disabled until a location is set on the embedded Google Map, matching
  the reference script's explicit `.gm-style` click step; clicking the raw `.gm-style` container in
  this environment is flaky (a bare click can hang retrying against child elements that intercept
  pointer events) and caused a full browser-context crash during this exploration.
- **The post-wizard "Lodge Live Editor" requires per-language completion** (EN/KM/FR) of Titles,
  Description, Policies, Bedroom (at least one room), and Bathroom (at least one room) before
  `Request to review & Publish` becomes enabled — the header shows a live "`N`% Completed" meter.
  Location, Gallery Media, Activities, Pricing, Amenities, Number of Guests, Categories, Place
  Arrangement, Accommodation Type, and Suitable Recommendation are auto-completed from the earlier
  wizard steps and do not need to be revisited.
- **A real transient bug was reproduced**: saving a Policy occasionally fails with a raw
  `TRPCClientError`/502 surfaced verbatim to the user ("Failed to save policy: Expected property
  name or '}' in JSON at position 1..."). Unlike the known silent-failure defect documented in
  `authentication.md`/`error-handling.md`, this one at least shows *a* message (if a very
  technical, non-actionable one) — retrying the same Save click succeeded.
- **Lodges remain fully editable while "Pending Review"** — there is no read-only/locked state for
  a submitted-but-not-yet-approved lodge; the owner can keep changing Titles/Description/Price/etc.
  and the changes save immediately without resetting the review status.
- **Delete is a real, permanent hard-delete**, reached via a per-row kebab/chevron menu (`Edit` /
  `Delete`) with a confirmation dialog reading "This action cannot be undone. This will permanently
  delete your property and remove your data from our servers." There is no separate
  archive/deactivate/unpublish action anywhere in the owner UI — delete is all-or-nothing.

## Test Scenarios

### 1. Lodge Owner CRUD

**Seed:** `tests/seed.spec.ts`

#### 1.1. Happy path: full "New Lodge" wizard through to "Pending Review"

**File:** `tests/rural-lodge-test/lodge-owner/create-lodge-happy-path.spec.ts`

**Steps:**
  1. Log in with the test account, click `Manage Your Lodge`, then click `New Lodge`
    - expect: Navigates to `/{locale}/lodges/new` (title "Create Lodge"), showing a "Which language
      do you want to use?" step with English / Khmer / French options and a `Next` button
  2. Select `English`, click `Next`, then select a lodge type (`Entire Place` / `Private Room` /
    `Shared Room` / `Unique Stay`) and click `Next`
    - expect: URL gains `?step=2`; the heading "Which of these best describes your place?" is shown
      with the four type cards; `Next` stays disabled until a type is picked
  3. On the combined "Loge Information" step (`?step=3`), fill Name* (test data: a unique string,
    e.g. `QA_Explore_Lodge_<random>`), type a Description (rich-text editor), pick a Category*
    (e.g. "Beachfront Villa"), a Place Arrangement* (e.g. "One Bedroom"), at least one Suitable
    Recommendation (e.g. "Couples") and at least one Activity (e.g. "Hiking"), then click `Next`
    - expect: `Next` is disabled until Name, Category, and Place Arrangement are all set
  4. On the Location step (`?step=4`), choose City/Province* (e.g. "Banteay Meanchey"), District
    (e.g. "Malai"), Commune (e.g. "Boeng Beng"), Village (e.g. "Sangkae"), set a pin on the
    "Location on Map *" widget, then click `Next`
    - expect: `Next` stays disabled until the map location is set
  5. Select one or more Amenities, click `Next`; on the image-upload step, skip it (`Done` then
    `Next`); set a `Price per night*` (test data: e.g. `10.00`), then click `Submit`/`Next`
    - expect: The app navigates to the "Lodge Live Editor" for the new lodge
      (`/{locale}/lodges/editor/<id>`), showing a completion meter starting well below 100%
  6. In the Lodge Live Editor, open `Titles*`, `Description*`, `Policies*`, `Bedroom*`, and
    `Bathroom*` in turn; for each, switch the in-editor language selector to fill and Save content
    in whichever of EN/KM/FR the section still marks "Required: ..." (Titles/Description only need
    KM+FR since EN is pre-filled from earlier steps; Policies/Bedroom/Bathroom need all three)
    - expect: Each section's badge changes from "Required: ..." to "Completed" after a successful
      Save, and the "N% Completed" meter in the header increases
  7. Once the meter reads "100% Completed", click `Request to review & Publish`, then `Confirm` in
    the "Are you sure you want to submit this lodge for review?" dialog
    - expect: The app redirects to `/{locale}/lodges?sort=updatedAt&sortOrder=desc`
    - expect: The new lodge appears at (or near) the top of the list with Status = "Pending Review"

#### 1.2. Negative: wizard "Next" and final "Request to review & Publish" stay disabled until required data is present

**File:** `tests/rural-lodge-test/lodge-owner/create-lodge-validation.spec.ts`

**Steps:**
  1. On the "Loge Information" step, leave Name empty (or leave Category/Place Arrangement
    unselected)
    - expect: `Next` remains disabled — there is no inline "Name is required" text message, the
      button simply never becomes clickable (same "disabled-button-instead-of-message" pattern
      documented for the login form in `authentication.md`)
  2. On the Location step, fill Province/District/Commune/Village but do not interact with the map
    - expect: `Next` remains disabled until a map pin/location is set
  3. In the Lodge Live Editor, before completing all required per-language sections, inspect the
    `Request to review & Publish` button
    - expect: The button is disabled (not merely unstyled) whenever "% Completed" is below 100,
      and the header explicitly shows which sections still say "Required: <languages>"
  4. Test data: an intentionally incomplete lodge (e.g. only Titles/Description done, Policies/
    Bedroom/Bathroom left empty)
    - expect: No error toast appears for the incomplete state — absence of an error message here is
      correct/expected since the disabled button already communicates "not ready", unlike the
      protected-route defect documented elsewhere which needed a message but had none

#### 1.3. Owner can list and view their own lodges with status and key columns

**File:** `tests/rural-lodge-test/lodge-owner/list-own-lodges.spec.ts`

**Steps:**
  1. From the dashboard sidebar, click `Lodges`
    - expect: Navigates to `/{locale}/lodges?sort=updatedAt&sortOrder=desc` (title "Lodges"); page
      heading reads "Loges"; an `Add Loge` button links to `/lodges/new`
    - expect: A summary count ("`N` loges") and a paginated table are shown (20 rows/page, "Page
      `X` of `Y`", a page-size selector, and a `Search for loges...` box plus a sort combobox)
  2. Inspect the table columns
    - expect: Columns are, in order: No. / Loge (thumbnail + name) / Location / Type / Price /
      Discount / Available in / Status / Last Updated / Actions
    - expect: Status values observed on staging include "Draft" and "Pending Review"; the
      dashboard's "Published Lodges" stat confirms a "Published" status exists for approved lodges
      even though none were on the first results page during this exploration
  3. Locate the lodge created in 1.1 by its name
    - expect: Its row shows the correct Location ("Banteay Meanchey, Cambodia"), Type ("Entire
      Place"), Price ("$10/night"), Status ("Pending Review"), and a recent "Last Updated" (e.g.
      "a few minutes ago")

#### 1.4. Owner can edit an existing lodge (including one already "Pending Review") and the change persists

**File:** `tests/rural-lodge-test/lodge-owner/edit-lodge.spec.ts`

**Steps:**
  1. From the Lodges list, open the row-level kebab/chevron Actions menu for a lodge and click
    `Edit` (or click the row's first icon button, which opens the same Lodge Live Editor directly)
    - expect: Navigates to `/{locale}/lodges/editor/<id>` — this works even when Status is
      "Pending Review"; there is no read-only/locked state
  2. Open the `Description*` section, change the English description text (test data: append
    " UPDATED via edit test."), and Save
    - expect: The section's Save button becomes disabled again immediately after a successful save
      (indicating no unsaved changes remain); the live preview iframe reflects the new text
  3. Open `Pricing`, change `Price per night*` (test data: e.g. `10` -> `15`), and Save
    - expect: The VAT/total preview recalculates live (e.g. "$16.50 including 10% VAT") as soon as
      the field changes, before Save is even clicked
    - expect: After Save, closing the editor may still show a "Discard changes?" confirmation even
      though the section's own Save button is already disabled — note this as a minor UX
      inconsistency, not a data-loss bug, since the change is already persisted server-side by then
  4. Navigate back to `/{locale}/lodges`
    - expect: The edited lodge's Price cell now reads the new value (e.g. "$15/night"); Status is
      unchanged ("Pending Review" does not reset or change because of an edit)

#### 1.5. Owner can permanently delete a lodge; no separate archive/deactivate/unpublish action exists

**File:** `tests/rural-lodge-test/lodge-owner/delete-lodge.spec.ts`

**Steps:**
  1. From the Lodges list, open the row-level kebab/chevron Actions menu (rightmost column) for the
    lodge to remove
    - expect: A dropdown menu opens with exactly two items: `Edit` (a link to the Lodge Live
      Editor) and `Delete`
    - expect: GAP/finding: no `Archive`, `Deactivate`, `Unpublish`, or `Draft`-revert option exists
      anywhere in this menu, the 3 unlabeled row icon-buttons, or the Lodge Live Editor itself —
      delete is the only lifecycle action beyond edit
  2. Click `Delete`
    - expect: An `alertdialog` appears: heading "Are you absolutely sure?", body "This action
      cannot be undone. This will permanently delete your property and remove your data from our
      servers.", with `Cancel` and `Delete` buttons
  3. Click the dialog's `Delete` button
    - expect: The dialog closes; the lodge's row disappears from the list without a page reload
    - expect: The "`N` loges" summary count decrements by exactly 1
    - expect: Re-navigating to `/{locale}/lodges` (fresh load) confirms the lodge is gone — this is
      a genuine hard delete, not a soft/hidden status change

#### 1.6. Known behavior: starting "New Lodge" auto-persists a Draft even if the wizard is abandoned

**File:** `tests/rural-lodge-test/lodge-owner/abandoned-wizard-leaves-draft.spec.ts`

**Steps:**
  1. Start the `New Lodge` wizard, fill only the Name and select a Lodge Type/Category/Place
    Arrangement (do not reach the Lodge Live Editor or click any submit/publish action), then
    navigate away (e.g. close the tab, or hit the browser back button repeatedly)
    - expect: NOTE (not necessarily a defect, but a real behavior automation must plan around): the
      lodge already exists server-side — it appears in `/{locale}/lodges` with Status = "Draft" and
      counts toward the dashboard's "Total Lodge" stat, even though the owner never clicked any
      explicit "Save Draft" or "Submit" action
  2. Reopen the Draft lodge via its row's Edit action
    - expect: All previously-entered fields (Name, Category, Place Arrangement, Location if it was
      reached) are preserved exactly as left off, confirming the wizard saves progressively
      step-by-step rather than only at final submission
    - expect: Test suites that create throwaway lodges for other scenarios should explicitly delete
      them afterward (see 1.5) to avoid leaving orphaned Draft rows in the shared staging account

---

## Reservations

**Seed:** `tests/seed.spec.ts`
**Account used for this exploration:** the dedicated `OWNER_TEST_EMAIL` account ("QA Owner", a
dual-role Lodge Owner/Customer account with **0 lodges and 0 reservations** at time of testing) —
this account is intentionally separate from the `TEST_USER_EMAIL` account used for the Lodge Owner
CRUD scenarios above.

### 2.1. Owner can view and filter their reservation requests

**File:** `tests/rural-lodge-test/lodge-owner/reservations-list.spec.ts`

**Steps:**
  1. From the dashboard sidebar, click `Reservations`
    - expect: Navigates to `/{locale}/reservations?page=1&res_status=pending,confirmed,checkedIn`
      (title "Reservations"); by default the query pre-selects 3 of 6 possible statuses
    - expect: Header shows an `Export report` button, a `Filter <N>` button showing the active
      filter count, and a `Reservation Status: <N>` quick-summary chip with a reset ("Cleaning
      Icon") button
  2. Click `Filter` to open the filter panel
    - expect: A `Filter Reservations` dialog opens with an "N active filters" counter + reset
      button, and three accordion sections:
      - **Reservation Status** (expanded by default): checkboxes `Cancelled`, `Checked In`
        (checked), `Checked Out`, `Confirmed` (checked), `Pending` (checked), `Rejected` — 6
        possible reservation statuses in total
      - **Payment Status**: checkboxes `Awaiting Confirmation`, `Paid Out`, `Pending Payout`,
        `Pending Refund`, `Refunded` — 5 possible payment statuses
      - **Date Range** (not explored further in this pass)
      - A `Filters` button applies the selection
  3. Inspect the reservations table
    - expect: Columns, in order: No. / Code / Lodge / Check-in / Status / Guest / Payment /
      Created at / Actions
    - expect: A `Search` textbox and a sort combobox (default "Created At") sit above the table
    - expect: Pagination shows "Page 1 of 1", a "Go to page" input, and a page-size combobox
      (default 5 rows/page on this screen, vs. 20 elsewhere in the app)
  4. Test data: with 0 reservations on this account, re-query with all 6 statuses combined
    (`res_status=pending,confirmed,checkedIn,checkedOut,cancelled,rejected`)
    - expect: Still "0 Reservations" / "No results found" — confirms the account genuinely has no
      reservation data under any status, not just the default 3

### 2.2. GAP/LIMITATION: approve/reject/confirm actions on a real reservation were not observable

**Steps:**
  1. Attempt to locate an owner-side approve/reject/confirm action for an incoming booking request
    - expect: NOT POSSIBLE with the dedicated QA Owner account as configured — it has 0 lodges and
      therefore can never receive a reservation. The "Actions" column exists in the table header,
      but no row was ever rendered to reveal what icons/menu items it contains.
    - **Recommendation:** re-run this scenario against an owner account that has at least one
      Published lodge and a customer-submitted booking (e.g. by using the `TEST_USER_EMAIL` CRUD
      account's lodges, or by seeding a booking via a customer account), to document the actual
      approve/reject/confirm control and the resulting status transition.

---

## Payout (view-only)

**Account used:** same `OWNER_TEST_EMAIL` account. Per task constraints, no real bank/payment
details were entered and no payout settings form was submitted — this section is observational
only.

### 3.1. Owner can view earnings overview and payout history (read-only)

**File:** `tests/rural-lodge-test/lodge-owner/payout-overview-view-only.spec.ts`

**Steps:**
  1. From the dashboard sidebar, click `Payout`
    - expect: Navigates to `/{locale}/payout` (title "Payout"), heading "Manage your earnings and
      payout settings", with two tabs: `Overview` (default) and `Settings`
  2. On the `Overview` tab, inspect the Earnings Overview section
    - expect: A `Payout Filters <N>` button (1 active filter by default) with a reset icon button
    - expect: 4 stat tiles: Total Earnings, Amount Paid, Pending Payouts, Awaiting Confirmation —
      all "$0" for this account (no lodges/bookings)
  3. Inspect the Payout History table
    - expect: Columns, in order: No. / Transaction ID / Reservation Code / Status / Amount /
      Platform Fee / Payout Tax / Net Payout / Payment Method / Payment Date / Created At
    - expect: A sort combobox (default "Created At") and pagination (default page size 20)
    - expect: Empty state: "0 Payout History" / "No results found" / "Try adjusting your search or
      filters to find what you're looking for."

### 3.2. Owner can view (but this exploration did NOT fill in) payout settings fields

**File:** `tests/rural-lodge-test/lodge-owner/payout-settings-view-only.spec.ts`

**Steps:**
  1. On the `Payout` page, click the `Settings` tab
    - expect: Heading "Payout Settings" with:
      - A disabled combobox pre-set to `KHQR` (Cambodia's national QR payment scheme) — appears to
        be the only/fixed payment method, not user-selectable
      - A second, currently-empty combobox next to it (rendered as a custom UI over a
        visually-hidden native `<select>`) — inferred to be a bank/provider chooser; not
        interacted with in this pass
      - An upload widget: "Upload your bank QR code for easy payment identification" / "Click to
        upload QR code" / "PNG, JPG up to 5MB"
      - A `Save Settings` button, disabled by default (presumably until the bank/QR fields are
        filled)
  2. Test data: NONE — no bank details, provider selection, or QR image were entered/uploaded, and
    `Save Settings` was never clicked, per task constraints (view-only, no real payment info)
    - expect: A future pass with explicit sign-off to use test/dummy payment data should complete
      this form end-to-end and confirm `Save Settings` becomes enabled and persists correctly

---

## Stay Management

**Account used:** same `OWNER_TEST_EMAIL` account (0 lodges).

### 4.1. Stay Management is a per-lodge availability/pricing calendar; empty state when no lodges exist

**File:** `tests/rural-lodge-test/lodge-owner/stay-management-empty-state.spec.ts`

**Steps:**
  1. From the dashboard sidebar, click `Stay Management`
    - expect: Navigates to `/{locale}/lodges/calendar` (title "Calendar Lodge"); breadcrumb reads
      "Dashboard > Lodges > Stay Management", implying this view is logically nested under Lodges
    - expect: Since the account has 0 lodges: an empty state renders — heading "No lodges yet",
      body text "Create your first lodge to set availability, pricing, and stay rules from this
      calendar.", and a `Create lodge` link to `/{locale}/lodges/new`
    - expect: This empty-state copy is itself evidence of the module's purpose: a per-lodge
      calendar for managing **availability, pricing, and stay rules** (e.g. blocking dates,
      nightly rate overrides) — consistent with a standard channel-manager-style calendar
  2. GAP/LIMITATION: the actual calendar UI (date grid, per-date price/availability editing) could
    NOT be exercised in this pass since the dedicated QA Owner account has no lodge to select.
    **Recommendation:** re-run against an owner account with at least one lodge (e.g. the
    `TEST_USER_EMAIL` CRUD account) to document the real calendar interactions, including whether
    a date-availability toggle is safely reversible.

---

## Notifications

**Account used:** same `OWNER_TEST_EMAIL` account (0 lodges, 0 reservations, 0 notifications).

### 5.1. Owner notification center — empty state

**File:** `tests/rural-lodge-test/lodge-owner/notifications-empty-state.spec.ts`

**Steps:**
  1. From the sidebar "Others" group, click `Notifications`
    - expect: Navigates to `/{locale}/notifications` (title "Notifications"); heading
      "Notifications" with "N new notifications" counter (0 here) and three filter tabs: `All`,
      `Read`, `Unread`
    - expect: Empty state: heading "No notifications", body "You don't have any notifications
      yet."
  2. GAP/LIMITATION: no real notification content/format was observed since this account has never
    received a reservation request, status change, or system message. Per the `notifications.getMy`
    / `notifications.getUnreadCount` tRPC calls referenced elsewhere in this spec suite (see the
    protected-route defect in `authentication.md`), notifications are backed by a real API and are
    most likely triggered by new booking requests and reservation status changes.
    **Recommendation:** re-run this scenario once a booking request exists against one of this
    owner's lodges, to capture the actual notification item's layout/content and confirm
    unread-count badge behavior.

---

## Profile / Account Settings

**Account used:** same `OWNER_TEST_EMAIL` account.

### 6.1. Public-facing owner Profile page: editing display name is a safe, reversible, and correctly-persisted action — **PASS**

**File:** `tests/rural-lodge-test/lodge-owner/profile-edit-name.spec.ts`

**Steps:**
  1. From the sidebar, click `Profile`
    - expect: Navigates to `/{locale}/profile-management` (title "Profile") — this is the
      **public-facing** owner profile shown to travelers, not a private account-settings page
    - expect: Page shows an "Add Cover Photo" control, an avatar-initials circle, the owner's
      display name as a clickable heading/button, a "Joined <date>" line, and a "Pinned Lodges"
      section (drag-to-reorder of the owner's own published lodges as featured on their public
      profile — 0 here since no lodges are published)
  2. Click the display name (test data: change from `QA Owner` to `QA Owner Test`)
    - expect: The name becomes an inline-editable textbox ("Enter your name") with small
      save/cancel icon buttons, AND a page-level `Cancel` / `Save Changes` action bar appears
    - expect: The avatar-initials circle live-updates as the name changes (e.g. "QO" -> "QOT")
      before the page-level Save is even clicked
  3. Click the inline save (check) icon, then click the page-level `Save Changes` button
    - expect: Both the sidebar user-info card (top of the owner dashboard nav) and the Profile
      page itself update to show the new name/initials immediately
  4. Reload the page (fresh navigation to `/{locale}/profile-management`)
    - expect: The new name (`QA Owner Test`) and initials (`QOT`) persist after reload — confirms
      the change was saved server-side, not just optimistic client state
  5. Repeat steps 2-4 to revert the name back to the original `QA Owner`
    - expect: Reverts cleanly and persists after reload; no residual "QA Owner Test" state remains
    - expect: No bugs found in this edit flow — clean PASS

### 6.2. Account Settings (`/settings`) is a separate page from the public Profile; scope is narrower than expected

**File:** `tests/rural-lodge-test/lodge-owner/account-settings-scope.spec.ts`

**Steps:**
  1. From the sidebar "Others" group, click `Settings` (distinct from the `Profile` sidebar item)
    - expect: Navigates to `/{locale}/settings` (title "Settings") with two tabs: `Notification`
      (default) and `Account`
  2. On the `Notification` tab
    - expect: Two toggle switches: `Telegram` ("Receive notifications via Telegram") and
      `Telegram Group` ("Receive notifications via Telegram group") — both off by default; not
      toggled in this pass to avoid altering account-linked notification channels
  3. On the `Account` tab
    - expect: GAP/finding — this tab contains **only** a "Delete Account" section (body text
      explains an OTP-verified deletion request with a cancellable grace period) and a
      `Manage Account Deletion` link to `/{locale}/settings/delete-account`
    - expect: GAP/finding — **no email or password change fields exist anywhere in Account
      Settings**; the only editable personal info found across the whole owner UI is the display
      name on the public Profile page (see 6.1). This may be intentional (e.g. email/password
      changes routed through a different flow such as "Forgot password"), but it was not
      discoverable from the owner dashboard UI itself.
    - Note: the `Manage Account Deletion` link was NOT clicked (destructive action, out of scope
      for this exploration)

### 6.3. Dual-role account: "Switch to Traveller" toggles between Lodge Owner and Customer dashboards

**Steps:**
  1. In the sidebar user-info card (below the logo, above "Main" nav), click `Switch to Traveller`
    - expect: Navigates to `/{locale}/customer/dashboard` (the Traveller/Customer dashboard) —
      confirms this account is dual-role, matching the "Owner QA (Customer)" label seen in the
      public-site account menu (see `authentication.md` / `lodge-owner.md` account descriptions)
  2. Navigate directly back to `/{locale}/dashboard`
    - expect: The Lodge Owner dashboard loads normally regardless of which "mode" was last active —
      the toggle appears to be a navigation convenience rather than a persisted account-wide mode
      switch
