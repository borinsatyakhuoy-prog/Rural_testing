import { test, expect, type Page } from '@playwright/test';

/**
 * Covers the "Customer Booking Cycle" domain: browsing lodges, the lodge detail page, the 3-step
 * booking wizard (Personal Details -> Payment -> Complete) up to and including the Payment step
 * (never submitted), date/guest-count validation, the known wishlist toggle defect, and the
 * customer dashboard/account area - against the dedicated CUSTOMER_TEST_EMAIL account, per
 * specs/planner/customer-booking.md and specs/exploratory-findings.md ("Customer Booking Cycle").
 *
 * IMPORTANT (scope constraint): no test in this file ever submits a real payment. Any test that
 * reaches the Payment step stops after asserting its two payment-method options are present -
 * "Scan QR" and "Payment" are never clicked, and no card details are ever entered.
 */

const BASE_URL = 'https://staging-ruralloge.allweb.cloud';
const LODGE_SLUG = 'lotus-lake-floating-villa';
const LODGE_NAME = 'Lotus Lake Floating Villa';

const CUSTOMER_EMAIL = process.env.CUSTOMER_TEST_EMAIL;
const CUSTOMER_PASSWORD = process.env.CUSTOMER_TEST_PASSWORD;

if (!CUSTOMER_EMAIL || !CUSTOMER_PASSWORD) {
  throw new Error('CUSTOMER_TEST_EMAIL / CUSTOMER_TEST_PASSWORD must be set in .env');
}

/** Logs in as the dedicated customer test account and lands on the localized home page. */
async function loginAsCustomer(page: Page) {
  await page.goto(`${BASE_URL}/en/auth`);
  await page.getByRole('textbox', { name: 'Email' }).fill(CUSTOMER_EMAIL!);
  await page.getByRole('textbox', { name: 'Password' }).fill(CUSTOMER_PASSWORD!);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  // A successful login redirects to the localized home page, not straight into /customer/*.
  await page.waitForURL((url) => !url.pathname.includes('/auth'), { timeout: 15000 });
}

/**
 * Reliably removes a lodge from the wishlist via the dedicated Wishlist-page icon button + confirm
 * dialog. Per specs/exploratory-findings.md this is the ONLY path that actually persists a removal
 * server-side (the lodge-detail page's own toggle does not - see the dedicated defect test below).
 * Used here purely to reset state so the defect test always starts from a known-clean wishlist.
 */
async function removeFromWishlistIfPresent(page: Page, lodgeName: string) {
  await page.goto(`${BASE_URL}/en/customer/wishlist`);
  // The wishlist page can render a blank content area for several seconds after navigation (no
  // item, no empty-state copy) before real data arrives - poll rather than asserting immediately.
  const card = page.getByText(lodgeName, { exact: false });
  const present = await card.first().isVisible({ timeout: 15000 }).catch(() => false);
  if (!present) return;

  await page.getByRole('button', { name: 'Remove from wishlist' }).first().click();
  const confirmDialog = page.getByRole('dialog').filter({ hasText: 'Remove from Wishlist' });
  await expect(confirmDialog).toBeVisible();
  await confirmDialog.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.getByText(lodgeName, { exact: false })).toHaveCount(0, { timeout: 15000 });
}

test.describe('Customer Booking Cycle', () => {
  // Every test below logs in as the SAME dedicated CUSTOMER_TEST_EMAIL account (see loginAsCustomer
  // above). Running them concurrently (this suite's default) causes overlapping logins to invalidate
  // each other's session on this backend - the same cross-test session collision already identified
  // and fixed for the OWNER_TEST_EMAIL account in lodge-owner-modules.spec.ts - so this describe block
  // is forced serial to avoid it.
  test.describe.configure({ mode: 'serial' });

  test('Browse lodges from the home page and open a lodge detail page', async ({ page }) => {
    await loginAsCustomer(page);
    await page.goto(`${BASE_URL}/en`);

    await expect(page.getByText('Where do you want to go next?')).toBeVisible();

    const lodgeLink = page.getByRole('link', { name: new RegExp(LODGE_NAME) }).first();
    await expect(lodgeLink).toBeVisible();
    await lodgeLink.click();
    await page.waitForURL(new RegExp(`/lodges/${LODGE_SLUG}`), { timeout: 15000 });

    // Key detail-page info: gallery, heading, tabs, description, amenities, price, guest capacity.
    await expect(page.getByRole('button', { name: 'Open image gallery' })).toBeVisible();
    await expect(page.getByRole('heading', { name: LODGE_NAME }).first()).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible();
    await expect(page.getByText('About this place')).toBeVisible();
    await expect(page.getByText('Amenities You Can Enjoy')).toBeVisible();
    await expect(page.getByText('Guest Capacity')).toBeVisible();
    await expect(page.getByText(/\$\d+/).first()).toBeVisible();
  });

  test('Booking happy path: reach the Payment step without submitting payment', async ({ page }) => {
    await loginAsCustomer(page);
    await page.goto(`${BASE_URL}/en/lodges/${LODGE_SLUG}`);

    // Pick check-in/check-out a few days out from "today" so the dates are always in the future
    // and within the currently-displayed calendar month, regardless of which day this test runs.
    const today = new Date();
    const checkIn = new Date(today);
    checkIn.setDate(today.getDate() + 2);
    const checkOut = new Date(today);
    checkOut.setDate(today.getDate() + 4);
    const checkInLabel = checkIn.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    const checkOutLabel = checkOut.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

    await page.getByRole('button', { name: 'Check-in — Check-out Select' }).click();
    const dateDialog = page.getByRole('dialog').filter({ hasText: 'Select your dates' });
    await expect(dateDialog).toBeVisible();

    // Day buttons' accessible names embed weekday/month/day/availability/price, e.g.
    // "Thursday, August 6, $12" - match on "<Month> <Day>," to avoid depending on the weekday.
    await dateDialog.getByRole('button', { name: new RegExp(`${checkInLabel},`) }).first().click();
    await dateDialog.getByRole('button', { name: new RegExp(`${checkOutLabel},`) }).first().click();
    await expect(dateDialog).toBeHidden();

    const bookCta = page.getByRole('button', { name: /Book for \d+ nights?/ });
    await expect(bookCta).toBeEnabled();
    await bookCta.click();

    await page.waitForURL(/\/booking\?scheduleID=/, { timeout: 20000 });
    await expect(page.getByText('Personal Details').first()).toBeVisible();
    await expect(page.getByText(/Booking is on Hold/i)).toBeVisible();

    await page.getByPlaceholder('Enter your phone number').fill('012345678');
    const nextStep = page.getByRole('button', { name: 'Next Step' });
    await expect(nextStep).toBeEnabled();
    await nextStep.click();
    await page.waitForURL(/step=2/, { timeout: 15000 });

    // --- STOP HERE. Do not go any further. ---
    // The Payment step is the one and only place in the entire customer flow where a real charge
    // could be triggered. Per task scope, this test only asserts that the step is reached and that
    // its two payment-method options are present - it deliberately never clicks "Scan QR" or the
    // final "Payment" button, and never enters any card/payment details.
    await expect(page.getByText('Payment').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Scan QR' })).toBeVisible();
    // "Credit/Debit Card" is NOT selectable (it's the "Coming Soon" placeholder per
    // specs/planner/customer-booking.md / specs/exploratory-findings.md), so - unlike "Scan QR",
    // which IS a real clickable button - it renders as a plain, non-interactive heading rather
    // than a button. Assert on its actual role/text rather than a button role it doesn't have.
    await expect(page.getByRole('heading', { name: 'Credit/Debit Card' })).toBeVisible();
    await expect(page.getByText('Coming Soon')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Payment', exact: true })).toBeVisible();
  });

  test('Date picker: past dates are disabled and cannot be selected', async ({ page }) => {
    await loginAsCustomer(page);
    await page.goto(`${BASE_URL}/en/lodges/${LODGE_SLUG}`);

    await page.getByRole('button', { name: 'Check-in — Check-out Select' }).click();
    const dateDialog = page.getByRole('dialog').filter({ hasText: 'Select your dates' });
    await expect(dateDialog).toBeVisible();

    // The calendar opens on the current month, so any day before "today" (e.g. the 1st-3rd of the
    // month if today is the 4th) is already in view without needing to navigate back a month.
    const pastDayButtons = dateDialog.getByRole('button', { name: /Not available, Price not available/ });
    expect(await pastDayButtons.count()).toBeGreaterThan(0);
    await expect(pastDayButtons.first()).toBeVisible();
    await expect(pastDayButtons.first()).toBeDisabled();
  });

  test('Guest count cannot exceed the lodge Guest Capacity', async ({ page }) => {
    await loginAsCustomer(page);
    await page.goto(`${BASE_URL}/en/lodges/${LODGE_SLUG}`);

    await page.getByRole('button', { name: /Guests/ }).first().click();
    const guestsDialog = page.getByRole('dialog').filter({ hasText: 'Guest details' });
    await expect(guestsDialog).toBeVisible();

    // Adults/Children/Pets each have their own +/- stepper pair; Adults is first in document order.
    const adultsPlus = guestsDialog.getByRole('button', { name: '+' }).first();

    // Push Adults up until the app disables the "+" button. Bounded loop (rather than reading the
    // lodge's exact Guest Capacity number up front) so this works for any lodge's capacity.
    for (let i = 0; i < 20 && !(await adultsPlus.isDisabled()); i++) {
      await adultsPlus.click();
    }

    await expect(adultsPlus).toBeDisabled();
    // Footer text confirms the cap was actually reached, e.g. "Total guests (Adults) 1 of 1 max".
    await expect(guestsDialog.getByText(/of \d+ max/i)).toBeVisible();
  });

  test('Customer dashboard/profile loads and shows Bookings/Wishlist/Notifications sections', async ({ page }) => {
    await loginAsCustomer(page);
    await page.goto(`${BASE_URL}/en/customer/dashboard`);

    await expect(page.getByText(/Hello,/)).toBeVisible();
    for (const name of ['Dashboard', 'Booking', 'Notifications', 'Wishlist', 'Explore Lodge']) {
      // Sidebar items were observed as links, but verify structurally rather than assume the role
      // never changes (exploratory-findings.md flags this as worth double-checking).
      const asLink = page.getByRole('link', { name, exact: true });
      const asButton = page.getByRole('button', { name, exact: true });
      const visible = (await asLink.first().isVisible().catch(() => false))
        || (await asButton.first().isVisible().catch(() => false));
      expect(visible, `sidebar item "${name}" should be visible as a link or button`).toBeTruthy();
    }

    await page.goto(`${BASE_URL}/en/customer/booking`);
    await expect(page.getByText(/Total Bookings/i)).toBeVisible();
    // These filter chips render as plain buttons, not ARIA tabs - the same app-wide pattern
    // already documented in lodge-owner-modules.spec.ts (Payout/Notifications tab bars).
    for (const tab of ['All', 'Pending', 'Confirmed', 'Cancelled']) {
      await expect(page.getByRole('button', { name: tab, exact: true })).toBeVisible();
    }

    await page.goto(`${BASE_URL}/en/customer/notification`);
    await expect(page.getByText(/notifications/i).first()).toBeVisible();

    await page.goto(`${BASE_URL}/en/customer/wishlist`);
    await expect(page.getByText(/Wishlist/i).first()).toBeVisible();

    // "Profile" per this scenario's title refers to Account Settings - a light read-only check.
    // These render as plain buttons, not ARIA tabs (same pattern as the Booking filters above).
    await page.goto(`${BASE_URL}/en/customer/accounts`);
    await expect(page.getByRole('button', { name: 'Account Settings', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Security Settings', exact: true })).toBeVisible();
  });

  // This test is placed LAST in the describe block on purpose: it is an intentional, permanent
  // KNOWN DEFECT test (see below) that always fails until the app is fixed. In a `mode: 'serial'`
  // describe block, Playwright skips every test AFTER one that fails - so if this test were placed
  // anywhere before its siblings, its expected failure would permanently mark the rest of this file
  // as "did not run" rather than actually executing them. Keeping it last means its expected
  // failure never blocks any other real coverage in this file.
  test('Wishlist: the lodge-detail Save/Remove toggle should persist removal (KNOWN DEFECT, fails until fixed)', async ({ page }) => {
    // specs/exploratory-findings.md documents a confirmed, reproducible defect: on the lodge-detail
    // page, clicking the Save/Remove toggle a SECOND time (while it reads "Remove") flips its own
    // label back to "Save" - looking like a successful removal - but never actually persists the
    // removal server-side. Reloading /customer/wishlist afterwards still shows the item.
    //
    // This test asserts the CORRECT expected behavior (the item is genuinely gone from the
    // Wishlist page afterwards) rather than encoding the bug into the assertion. It is therefore
    // expected to FAIL right now and should start passing once the toggle's remove path is fixed
    // to actually await/persist the mutation - the chosen convention in this suite for known
        // defects: a failing test documenting the gap, not a green test that quietly bakes in the bug.
    await loginAsCustomer(page);

    // Start from a known-clean wishlist in case a previous run left the item saved.
    await removeFromWishlistIfPresent(page, LODGE_NAME);

    await page.goto(`${BASE_URL}/en/lodges/${LODGE_SLUG}`);
    const toggle = page.getByRole('button', { name: /^(Save|Remove)$/ });
    await expect(toggle).toHaveText('Save');

    // The initial "add" click is the one path exploratory testing confirmed to reliably persist
    // (only the SECOND/"remove" click below is the documented defect under test) - but on this
    // page a click landing right after navigation has occasionally been observed to no-op (the
    // toggle's mutation is briefly guarded while the page's own wishlist-status check is still in
    // flight). Retry the click itself, bounded, rather than the assertion, so a swallowed first
    // click doesn't make this test fail for a reason unrelated to the actual defect being asserted.
    for (let i = 0; i < 5 && (await toggle.textContent()) !== 'Remove'; i++) {
      await toggle.click();
      await page.waitForTimeout(500);
    }
    await expect(toggle).toHaveText('Remove');

    await toggle.click(); // the buggy "remove" click
    await expect(toggle).toHaveText('Save'); // local/optimistic UI flips back regardless of the bug

    await page.goto(`${BASE_URL}/en/customer/wishlist`);
    // The wishlist page renders a completely blank content area (no item, no empty-state copy)
    // for several seconds right after navigation before real data arrives (see
    // specs/exploratory-findings.md, 1.6). Asserting `toHaveCount(0)` directly is unsafe here: it
    // would be trivially (and WRONGLY) satisfied during that blank window, before the real item
    // data has even loaded - a false pass that would mask this exact defect. Wait for a definitive
    // signal first (either the item itself, or the genuine empty-state copy), then assert on
    // which one actually showed up.
    const itemLocator = page.getByText(LODGE_NAME, { exact: false });
    const emptyStateLocator = page.getByText(/your wishlist is empty/i);
    await expect(itemLocator.or(emptyStateLocator)).toBeVisible({ timeout: 15000 });

    // Expected (correct) behavior: the lodge should no longer be listed here (empty state shows).
    // Actual (buggy) behavior, per exploratory findings: it is still present, because the
    // detail-page toggle's remove path never persisted server-side.
    await expect(emptyStateLocator).toBeVisible();
  });
});
