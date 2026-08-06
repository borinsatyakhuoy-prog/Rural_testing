import { test, expect } from '@playwright/test';
import { BASE_URL } from '../helpers/auth';

test.describe('Authentication', () => {
  test('logout requires confirming a Confirm Logout dialog', async ({ page }) => {
    await page.goto(`${BASE_URL}/en/auth`);
    // pressSequentially, not fill: see the Cycle 4 note in 001_valid-login-redirects-home.spec.ts.
    await page.getByRole('textbox', { name: 'Email' }).pressSequentially(process.env.TEST_USER_EMAIL!);
    await page.getByRole('textbox', { name: 'Password' }).pressSequentially(process.env.TEST_USER_PASSWORD!);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.waitForURL(`${BASE_URL}/en`);

    // Right after the redirect, the header briefly renders the account button with no text/icon
    // while the user's profile loads asynchronously - clicking it during that window is a no-op
    // (no dropdown opens), which then hangs the next locator waiting for a menuitem that never
    // appears. Wait for the initials text to render before clicking.
    const accountButton = page.getByRole('banner').getByRole('button').last();
    // Bumped from 10s: observed to occasionally exceed 10s under slower staging load - the account
    // button/profile fetch itself isn't flaky, just sometimes slower than 10s end-to-end.
    await expect(accountButton).not.toHaveText('', { timeout: 20000 });
    await accountButton.click();
    await page.getByRole('menuitem', { name: 'Logout' }).click();

    const dialog = page.getByRole('alertdialog');
    await expect(dialog.getByRole('heading', { name: 'Confirm Logout' })).toBeVisible();
    await expect(
      dialog.getByText('Are you sure you want to log out of your account?')
    ).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible();

    await dialog.getByRole('button', { name: 'Logout' }).click();

    await expect(dialog).not.toBeVisible();
    // Header reverts to the logged-out state (generic login icon replaces the initials button).
    await expect(page.getByRole('banner').getByRole('button').last()).toBeVisible();
  });
});
