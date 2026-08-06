import { expect, type Page } from '@playwright/test';

export const BASE_URL = new URL(process.env.APP_URL!).origin;

/**
 * Types into a field with real keystrokes rather than `.fill()`. Confirmed via a WebKit-only
 * full-suite run (Cycle 4) that `.fill()` sets the DOM value but leaves this app's React
 * controlled-input state (and therefore the `Continue` button's disabled state) unchanged under
 * WebKit specifically - Chromium and Firefox don't exhibit this. `pressSequentially()` dispatches
 * one real keydown/input/keyup triplet per character, which the app's onChange handler picks up
 * consistently across all three engines.
 */
async function typeInto(page: Page, name: string, value: string) {
  const field = page.getByRole('textbox', { name });
  await field.pressSequentially(value);
}

/** Logs in as the main TEST_USER_EMAIL account and waits for the redirect off /auth. */
export async function login(page: Page) {
  await page.goto(`${BASE_URL}/en/auth`);
  await typeInto(page, 'Email', process.env.TEST_USER_EMAIL!);
  await typeInto(page, 'Password', process.env.TEST_USER_PASSWORD!);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes('/auth'));
}

/** Logs in as the dedicated customer test account and lands on the localized home page. */
export async function loginAsCustomer(page: Page) {
  await page.goto(`${BASE_URL}/en/auth`);
  await typeInto(page, 'Email', process.env.CUSTOMER_TEST_EMAIL!);
  await typeInto(page, 'Password', process.env.CUSTOMER_TEST_PASSWORD!);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  // A successful login redirects to the localized home page, not straight into /customer/*.
  await page.waitForURL((url) => !url.pathname.includes('/auth'), { timeout: 15000 });
}

/** Logs in as the Lodge Owner test account and lands on the owner dashboard. */
export async function loginAsOwner(page: Page) {
  await page.goto(`${BASE_URL}/en/auth`);
  await typeInto(page, 'Email', process.env.OWNER_TEST_EMAIL!);
  await typeInto(page, 'Password', process.env.OWNER_TEST_PASSWORD!);
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

/**
 * Opens the account menu and completes the Confirm Logout flow.
 * Right after login/redirect, the header briefly renders the account button with no text/icon
 * while the user's profile loads asynchronously - clicking it during that window is a no-op (no
 * dropdown opens), which then hangs the next locator waiting for a menuitem that never appears.
 * Wait for the initials text to render before clicking.
 */
export async function logout(page: Page) {
  const accountButton = page.getByRole('banner').getByRole('button').last();
  await expect(accountButton).not.toHaveText('', { timeout: 20000 });
  await accountButton.click();
  await page.getByRole('menuitem', { name: 'Logout' }).click();
  const dialog = page.getByRole('alertdialog');
  await dialog.getByRole('button', { name: 'Logout' }).click();
  await expect(dialog).not.toBeVisible();
}
