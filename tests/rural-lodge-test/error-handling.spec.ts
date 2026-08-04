import { test, expect } from '@playwright/test';

/**
 * Error Handling / No-Silent-Failure cross-cutting checks.
 *
 * These tests overlap by nature with authentication.spec.ts but are framed from the
 * "is the failure visible and specific?" angle per specs/planner/error-handling.md.
 * They intentionally do NOT re-cover the full login/logout happy path, which is owned
 * by authentication.spec.ts.
 */

const APP_ORIGIN = new URL(process.env.APP_URL!).origin;

test.describe('Error Handling - no silent failure', () => {
  test('invalid login produces a specific, visible error message rather than a silent failure', async ({
    page,
  }) => {
    await page.goto(`${APP_ORIGIN}/en/auth`);

    const emailField = page.getByRole('textbox', { name: 'Email' });
    const passwordField = page.getByRole('textbox', { name: 'Password' });

    await emailField.fill('wrong.user@example.com');
    await passwordField.fill('WrongPassword123!');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();

    // .first() because the same text can also transiently appear in a toast notification in
    // addition to the inline form message (matches the pattern already documented in
    // authentication.spec.ts's equivalent test) - without it this is a strict-mode violation.
    await expect(
      page.getByText('Invalid email or password. Please try again.').first()
    ).toBeVisible();

    // Page must not go blank, throw an unhandled error overlay, or silently do nothing:
    // the form stays intact and usable so the user can correct and resubmit.
    await expect(emailField).toBeVisible();
    await expect(passwordField).toBeVisible();
    await expect(emailField).toBeEditable();
    await expect(passwordField).toBeEditable();
  });

  test('DEFECT: protected route after logout should redirect to login instead of silently rendering a broken dashboard shell', async ({
    page,
  }) => {
    // Known, confirmed defect (see specs/exploratory-findings.md, Error Handling 1.3 /
    // Authentication 1.8): the route guard checks for the mere PRESENCE of a stale `user`
    // cookie rather than validating real session state. A truly fresh/never-authenticated
    // context has no such cookie and correctly redirects - the bug only reproduces after a
    // real login+logout leaves that stale cookie behind, so this test logs in and out first
    // rather than visiting the route cold (which would silently test the wrong scenario).
    await page.goto(`${APP_ORIGIN}/en/auth`);
    await page.getByRole('textbox', { name: 'Email' }).fill(process.env.TEST_USER_EMAIL!);
    await page.getByRole('textbox', { name: 'Password' }).fill(process.env.TEST_USER_PASSWORD!);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.waitForURL(`${APP_ORIGIN}/en`);

    // The account button briefly renders with no text while the user's profile loads
    // asynchronously right after the redirect - clicking it during that window does not open
    // the dropdown menu, which then hangs the next locator forever. Wait for the initials to
    // render first (see the identical fix in authentication.spec.ts).
    const accountButton = page.getByRole('banner').getByRole('button').last();
    await expect(accountButton).not.toHaveText('', { timeout: 10000 });
    await accountButton.click();
    await page.getByRole('menuitem', { name: 'Logout' }).click();
    const dialog = page.getByRole('alertdialog');
    await dialog.getByRole('button', { name: 'Logout' }).click();
    await expect(dialog).not.toBeVisible();

    // Instead it silently renders a degraded dashboard shell ("Hello,", "No stats available",
    // "No bookings found") while the data layer fails in the console with "Authentication token
    // not found in cookies" tRPC errors that are never surfaced to the user. This test asserts
    // the CORRECT expected behavior (redirect to a login/auth page) and is expected to FAIL
    // until the defect is fixed.
    await page.goto(`${APP_ORIGIN}/en/customer/dashboard`);

    await expect(page).toHaveURL(/\/(en\/)?(auth|login)/, { timeout: 10000 });
  });

  test('no-data state: authenticated account with zero bookings shows explicit empty-state messaging, not a blank area', async ({
    page,
  }) => {
    await page.goto(`${APP_ORIGIN}/en/auth`);

    await page.getByRole('textbox', { name: 'Email' }).fill(process.env.CUSTOMER_TEST_EMAIL!);
    await page.getByRole('textbox', { name: 'Password' }).fill(process.env.CUSTOMER_TEST_PASSWORD!);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();

    await page.waitForURL(`${APP_ORIGIN}/en`);

    await page.goto(`${APP_ORIGIN}/en/customer/dashboard`);

    // Corrected from the original assumption: "No stats available" is only ever rendered for the
    // BROKEN/unauthenticated shell (see the DEFECT test above) - a genuinely authenticated,
    // zero-booking account instead gets real stat tiles showing "0" (confirmed live: "Total
    // Bookings" / "Recent Bookings" / "Notification" tiles each read "0"). Assert that real,
    // populated-but-zero state here rather than text that never appears for a logged-in user.
    await expect(page.getByText('Total Bookings').locator('..')).toContainText('0');
    await expect(page.getByText('No bookings found')).toBeVisible();
    await expect(
      page.getByText('Please click the link below to explore lodge.')
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Explore Lodge' })).toBeVisible();
  });
});
