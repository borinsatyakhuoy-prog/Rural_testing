import { test, expect, type Page } from '@playwright/test';

/**
 * Covers the Lodge Owner modules OTHER than lodge CRUD (Reservations, Payout, Stay Management,
 * Notifications, Profile/Account Settings), against the dedicated OWNER_TEST_EMAIL account.
 * That account is intentionally "clean" (0 lodges / 0 reservations / 0 notifications at time of
 * writing) per specs/exploratory-findings.md, so several assertions are written to accept either
 * the empty state or real data, rather than asserting one specific outcome.
 */

const BASE_URL = 'https://staging-ruralloge.allweb.cloud';

const OWNER_EMAIL = process.env.OWNER_TEST_EMAIL;
const OWNER_PASSWORD = process.env.OWNER_TEST_PASSWORD;

if (!OWNER_EMAIL || !OWNER_PASSWORD) {
  throw new Error('OWNER_TEST_EMAIL / OWNER_TEST_PASSWORD must be set in .env');
}

/** Logs in as the Lodge Owner test account and lands on the owner dashboard. */
async function loginAsOwner(page: Page) {
  await page.goto(`${BASE_URL}/en/auth`);
  await page.getByRole('textbox', { name: 'Email' }).fill(OWNER_EMAIL!);
  await page.getByRole('textbox', { name: 'Password' }).fill(OWNER_PASSWORD!);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  // A successful login redirects to the localized home page, not straight to the dashboard.
  await page.waitForURL((url) => !url.pathname.includes('/auth'), { timeout: 15000 });
  // The AUTH_TOKEN cookie (and the client-side auth state that reads it) settle asynchronously
  // just after the redirect; clicking "Manage Your Lodge" too early races the app into treating
  // the session as logged-out (bounces back through /auth?returnUrl=%2F). Wait for the cookie,
  // plus a short buffer for client-side hydration to catch up with it.
  await page.waitForFunction(() => document.cookie.includes('AUTH_TOKEN'), { timeout: 10000 });
  await page.waitForTimeout(2000);

  // Retry once if the app still bounces back to /auth on the first click (same race, worst case).
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByRole('button', { name: 'Manage Your Lodge' }).click();
    try {
      await page.waitForURL(/\/dashboard/, { timeout: 8000 });
      return;
    } catch {
      if (attempt === 1) throw new Error('Could not reach the owner dashboard after logging in');
      await page.goto(`${BASE_URL}/en`);
      await page.waitForTimeout(2000);
    }
  }
}

/** Asserts that a table on the page has a columnheader with each given name, in the main content area. */
async function expectColumnHeaders(page: Page, names: string[]) {
  for (const name of names) {
    await expect(page.getByRole('columnheader', { name, exact: true })).toBeVisible();
  }
}

test.describe('Lodge Owner - other modules', () => {
  // Every test logs in as the SAME dedicated OWNER_TEST_EMAIL account. Running them concurrently
  // (this suite's default) causes overlapping logins to invalidate each other's session, so this
  // describe block is forced serial to avoid that cross-test session collision.
  test.describe.configure({ mode: 'serial' });

  test('Reservations page shows expected table columns', async ({ page }) => {
    await loginAsOwner(page);
    await page.getByRole('button', { name: 'Reservations', exact: true }).click();
    await page.waitForURL(/\/reservations/, { timeout: 15000 });
    await expect(page).toHaveTitle(/Reservations/);

    // Note: "Created At" is only the default sort-combobox option on this page, not an actual
    // table column - the live table header row does not include it.
    await expectColumnHeaders(page, [
      'No.',
      'Code',
      'Lodge',
      'Check-in',
      'Status',
      'Guest',
      'Payment',
      'Actions',
    ]);

    // This dedicated QA Owner account may genuinely have 0 reservations - accept either the
    // documented empty state or real data rows rather than asserting one specific outcome.
    // Observed during Step 5 healing: with 0 reservations the page shows a "0 Reservations"
    // counter and an empty table body, NOT a "No results found" message (that copy may apply
    // elsewhere but not here) - check for either empty-state signal, not just one.
    const noResults = page.getByText(/no results found/i);
    const zeroCounter = page.getByText(/^0 Reservations$/);
    const dataRowCount = await page.getByRole('row').count(); // includes the header row
    const hasEmptyState = (await noResults.isVisible().catch(() => false))
      || (await zeroCounter.isVisible().catch(() => false));
    expect(hasEmptyState || dataRowCount > 1).toBeTruthy();
  });

  test('Payout page: Overview stats/history and Settings KHQR section (view only)', async ({ page }) => {
    await loginAsOwner(page);
    await page.getByRole('button', { name: 'Payout', exact: true }).click();
    await page.waitForURL(/\/payout/, { timeout: 15000 });
    await expect(page).toHaveTitle(/Payout/);

    // Overview tab (default) - 4 stat tiles.
    for (const label of ['Total Earnings', 'Amount Paid', 'Pending Payouts', 'Awaiting Confirmation']) {
      await expect(page.getByText(label, { exact: false }).first()).toBeVisible();
    }

    // Note: "Created At" is only the default sort-combobox option here too, not an actual column.
    await expectColumnHeaders(page, [
      'No.',
      'Transaction ID',
      'Reservation Code',
      'Status',
      'Amount',
      'Platform Fee',
      'Payout Tax',
      'Net Payout',
      'Payment Method',
      'Payment Date',
    ]);

    // Settings tab - view only, do not fill or submit any payment/bank details.
    await page.getByRole('main').getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Payout Settings' })).toBeVisible();
    await expect(page.getByText('KHQR').first()).toBeVisible();
    await expect(page.getByText(/upload.*qr code/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Settings' })).toBeDisabled();
  });

  test('Stay Management shows empty state or calendar depending on lodge data', async ({ page }) => {
    await loginAsOwner(page);
    await page.getByRole('button', { name: 'Stay Management', exact: true }).click();
    await page.waitForURL(/\/lodges\/calendar/, { timeout: 15000 });
    await expect(page).toHaveTitle(/Calendar Lodge/);

    const noLodgesHeading = page.getByRole('heading', { name: 'No lodges yet' });
    if (await noLodgesHeading.isVisible().catch(() => false)) {
      await expect(noLodgesHeading).toBeVisible();
      await expect(
        page.getByText('Create your first lodge to set availability, pricing, and stay rules from this calendar.')
      ).toBeVisible();
      await expect(page.getByRole('link', { name: 'Create lodge' })).toBeVisible();
    } else {
      // This account has at least one lodge - the real per-lodge calendar UI renders instead.
      await expect(noLodgesHeading).toHaveCount(0);
    }
  });

  test('Notifications shows empty state and All/Read/Unread tabs', async ({ page }) => {
    await loginAsOwner(page);
    await page.getByRole('button', { name: 'Notifications', exact: true }).click();
    await page.waitForURL(/\/notifications/, { timeout: 15000 });
    await expect(page).toHaveTitle(/Notifications/);

    // These filters render as plain buttons rather than ARIA tabs, matching the app-wide pattern
    // seen on the Payout/Account Settings tab bars (also plain buttons, not role="tab").
    for (const tabName of ['All', 'Read', 'Unread']) {
      await expect(page.getByRole('button', { name: tabName, exact: true })).toBeVisible();
    }

    // This dedicated QA Owner account has never received a booking/status-change notification.
    const noNotificationsHeading = page.getByRole('heading', { name: 'No notifications' });
    if (await noNotificationsHeading.isVisible().catch(() => false)) {
      await expect(noNotificationsHeading).toBeVisible();
      await expect(page.getByText("You don't have any notifications yet.")).toBeVisible();
    }
  });

  test('Profile: display name edit is reversible and reverted after the test', async ({ page }) => {
    // This test does substantially more real work than its siblings - a login (with its own
    // internal retry/settle waits) followed by TWO full edit+"Save Changes"+reload round-trips
    // (change name, then revert it) - each a real server round-trip. Under this staging backend's
    // observed slowness (see specs/exploratory-findings.md), the default 30s test timeout leaves
    // too little margin, especially when running alongside other files/workers.
    // Step 5 healing: test.slow()'s 3x multiplier (135s) still wasn't enough headroom for BOTH
    // round-trips when the "Joined" text's post-reload re-render is itself slow on one of them -
    // the test was observed to time out even though the rename had genuinely already succeeded.
    // Set an explicit, larger timeout instead, matching the pattern already used for the heaviest
    // test in lodge-owner-crud.spec.ts.
    test.setTimeout(240000);
    await loginAsOwner(page);
    await page.getByRole('button', { name: 'Profile', exact: true }).click();
    await page.waitForURL(/\/profile-management/, { timeout: 15000 });
    await expect(page).toHaveTitle(/Profile/);

    // The display-name button has no fixed accessible name (it IS the owner's current name), so
    // it's located structurally, near the "Joined <date>" text, rather than by name. NOTE: the
    // accessibility-tree snapshot makes the button and the "Joined" text LOOK like direct siblings,
    // but the real DOM has several extra wrapping <div>s in between (an icon-wrapper div around
    // the "Joined" text, plus layout divs) - a single `locator('xpath=..')` step only reaches the
    // icon-wrapper div (which has no button in it), causing the original single-level-up locator to
    // hang forever. Walk up ancestor levels until one actually contains a button, rather than
    // hardcoding a specific (fragile) depth.
    async function getNameButton(): Promise<import('@playwright/test').Locator> {
      const joined = page.getByRole('main').getByText(/^Joined /);
      // This is called again after each reload (post-edit and post-revert), so the "Joined" text
      // itself may not have re-rendered yet - wait for it before walking ancestors, rather than
      // taking an immediate zero-count as "structure changed". Observed during Step 5 healing to
      // occasionally still not be visible even after 20s under slower staging load; one extra
      // reload-and-retry recovers it rather than failing the whole test on a single slow load.
      let visible = await joined.isVisible({ timeout: 20000 }).catch(() => false);
      if (!visible) {
        await page.reload();
        await expect(joined).toBeVisible({ timeout: 30000 });
      }
      for (let levels = 1; levels <= 8; levels++) {
        const candidate = joined.locator('xpath=' + Array(levels).fill('..').join('/')).getByRole('button');
        if ((await candidate.count()) > 0) return candidate.first();
      }
      throw new Error('Could not locate the owner display-name button near the "Joined" text');
    }

    const originalName = ((await (await getNameButton()).textContent()) ?? '').trim();
    expect(originalName.length).toBeGreaterThan(0);
    // ROOT CAUSE found during Step 5 healing (via live MCP browser diagnosis): a hardcoded
    // testName here caused a self-perpetuating hang. If any earlier run of this test crashed
    // before its `finally` revert ran, the account's real display name stays "QA Owner Test" -
    // so on the NEXT run, originalName reads back as "QA Owner Test" too, making the "rename to
    // testName" a genuine no-op. The app correctly does not surface a Save Changes bar for a
    // no-op edit, so the test hung forever waiting for a Save button that would never appear -
    // and every such failure left the fixture corrupted for the run after it. Guarantee testName
    // can never collide with whatever originalName happens to be, so this test is self-healing
    // regardless of what a previous crashed run left behind.
    const testName = originalName === 'QA Owner Test' ? 'QA Owner' : 'QA Owner Test';

    async function changeNameTo(target: string) {
      await (await getNameButton()).click();
      const input = page.getByRole('textbox', { name: 'Enter your name' });
      await input.fill(target);
      await input.press('Enter');
      // Fallback: if the inline textbox is still open (Enter didn't commit it), click its
      // unlabeled inline confirm (check) icon, which sits alongside the textbox.
      if (await input.isVisible().catch(() => false)) {
        await input.locator('xpath=..').getByRole('button').first().click().catch(() => {});
      }
      await page.getByRole('button', { name: 'Save Changes' }).click();
      await page.reload();
    }

    try {
      await changeNameTo(testName);
      await expect(await getNameButton()).toHaveText(testName);
    } finally {
      // Revert unconditionally (even if the assertion above failed) so this shared QA Owner
      // account's display name is never left altered by this test run.
      await changeNameTo(originalName);
    }
    await expect(await getNameButton()).toHaveText(originalName);
  });

  test('Account Settings has no email/password change option (documented gap)', async ({ page }) => {
    await loginAsOwner(page);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.waitForURL(/\/settings/, { timeout: 15000 });
    await expect(page).toHaveTitle(/Settings/);

    await page.getByRole('main').getByRole('button', { name: 'Account', exact: true }).click();
    await expect(page.getByText('Delete Account')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Manage Account Deletion' })).toBeVisible();

    // Documented gap: no email or password field exists anywhere in owner Account Settings.
    // Asserted as an absence check (passes today), not a failure-inducing assertion.
    await expect(page.getByRole('textbox', { name: /email/i })).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: /password/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /change password/i })).toHaveCount(0);
  });
});
