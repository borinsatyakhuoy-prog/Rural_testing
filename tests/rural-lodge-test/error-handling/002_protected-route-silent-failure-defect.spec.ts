import { test, expect } from '@playwright/test';
import { BASE_URL } from '../helpers/auth';

test.describe('Error Handling - no silent failure', () => {
  test('DEFECT: protected route after logout should redirect to login instead of silently rendering a broken dashboard shell', async ({
    page,
  }) => {
    // Known, confirmed defect (see specs/exploratory-findings.md, Error Handling 1.3 /
    // Authentication 1.8): the route guard checks for the mere PRESENCE of a stale `user`
    // cookie rather than validating real session state. A truly fresh/never-authenticated
    // context has no such cookie and correctly redirects - the bug only reproduces after a
    // real login+logout leaves that stale cookie behind, so this test logs in and out first
    // rather than visiting the route cold (which would silently test the wrong scenario).
    await page.goto(`${BASE_URL}/en/auth`);
    // pressSequentially, not fill: see the Cycle 4 note in
    // authentication/001_valid-login-redirects-home.spec.ts.
    await page.getByRole('textbox', { name: 'Email' }).pressSequentially(process.env.TEST_USER_EMAIL!);
    await page.getByRole('textbox', { name: 'Password' }).pressSequentially(process.env.TEST_USER_PASSWORD!);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.waitForURL(`${BASE_URL}/en`);

    // The account button briefly renders with no text while the user's profile loads
    // asynchronously right after the redirect - clicking it during that window does not open
    // the dropdown menu, which then hangs the next locator forever. Wait for the initials to
    // render first (see the identical fix in authentication/005_logout-requires-confirmation).
    const accountButton = page.getByRole('banner').getByRole('button').last();
    await expect(accountButton).not.toHaveText('', { timeout: 20000 });
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
    await page.goto(`${BASE_URL}/en/customer/dashboard`);

    await expect(page).toHaveURL(/\/(en\/)?(auth|login)/, { timeout: 10000 });
  });
});
