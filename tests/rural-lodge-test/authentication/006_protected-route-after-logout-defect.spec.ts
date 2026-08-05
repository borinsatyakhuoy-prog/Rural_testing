import { test, expect } from '@playwright/test';
import { BASE_URL } from '../helpers/auth';

test.describe('Authentication', () => {
  test('KNOWN DEFECT: protected route after logout should redirect to login, not render a broken dashboard', async ({
    page,
  }) => {
    // Known, confirmed defect (see specs/exploratory-findings.md, Authentication 1.8): the guard
    // on protected routes checks for the mere PRESENCE of a stale `user` cookie rather than
    // validating real session state. A truly fresh/never-authenticated context has no such
    // cookie and correctly redirects - the bug only reproduces after a real login+logout leaves
    // that stale cookie behind. So this test must log in and log out first, not just visit the
    // route cold, or it would silently test the wrong scenario and pass for the wrong reason.
    await page.goto(`${BASE_URL}/en/auth`);
    await page.getByRole('textbox', { name: 'Email' }).fill(process.env.TEST_USER_EMAIL!);
    await page.getByRole('textbox', { name: 'Password' }).fill(process.env.TEST_USER_PASSWORD!);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.waitForURL(`${BASE_URL}/en`);

    // See the comment on the same wait in the "logout requires confirming" test above: the
    // account button briefly renders with no text while the user's profile loads, and clicking
    // it during that window does not open the dropdown menu.
    const accountButton = page.getByRole('banner').getByRole('button').last();
    await expect(accountButton).not.toHaveText('', { timeout: 20000 });
    await accountButton.click();
    await page.getByRole('menuitem', { name: 'Logout' }).click();
    const dialog = page.getByRole('alertdialog');
    await dialog.getByRole('button', { name: 'Logout' }).click();
    await expect(dialog).not.toBeVisible();

    // Opening a protected route (e.g. /en/customer/dashboard) now silently renders a degraded
    // dashboard shell ("Hello,", "No stats available", "No bookings found") while the data layer
    // fails in the console with "Authentication token not found in cookies" tRPC errors that are
    // never surfaced to the user. This test asserts the CORRECT expected behavior (redirect to a
    // login/auth page) and is expected to FAIL until fixed.
    await page.goto(`${BASE_URL}/en/customer/dashboard`);

    await expect(page).toHaveURL(/\/(en\/)?(auth|login)/, { timeout: 10000 });
  });
});
