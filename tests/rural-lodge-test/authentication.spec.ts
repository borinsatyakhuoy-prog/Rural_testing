import { test, expect } from '@playwright/test';

// APP_URL in .env is https://staging-ruralloge.allweb.cloud/km (includes a default locale suffix),
// so the origin is derived here to freely compose locale-prefixed paths (/en, /en/auth, ...).
const BASE_URL = new URL(process.env.APP_URL!).origin;

test.describe('Authentication', () => {
  test('valid login redirects to the public home page (not Dashboard)', async ({ page }) => {
    await page.goto(`${BASE_URL}/en/auth`);

    const emailField = page.getByRole('textbox', { name: 'Email' });
    const passwordField = page.getByRole('textbox', { name: 'Password' });
    const continueButton = page.getByRole('button', { name: 'Continue', exact: true });

    await expect(continueButton).toBeDisabled();

    await emailField.fill(process.env.TEST_USER_EMAIL!);
    await passwordField.fill(process.env.TEST_USER_PASSWORD!);
    await expect(continueButton).toBeEnabled();
    await continueButton.click();

    // Real behavior redirects to the public home page, not "/{locale}/customer/dashboard".
    await expect(page).toHaveURL(`${BASE_URL}/en`);
    await expect(page).toHaveTitle('Welcome to Rural Lodge');

    // Header's login icon is replaced by a user-initials button once authenticated.
    await expect(page.getByRole('banner').getByRole('button').last()).toBeVisible();
  });

  test('invalid credentials show a specific error message and stay on /auth', async ({ page }) => {
    await page.goto(`${BASE_URL}/en/auth`);

    const emailField = page.getByRole('textbox', { name: 'Email' });
    const passwordField = page.getByRole('textbox', { name: 'Password' });

    await emailField.fill('wrong.user@example.com');
    await passwordField.fill('WrongPassword123!');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();

    await expect(page).toHaveURL(/\/en\/auth/);
    // .first() because the same text can also transiently appear in a toast notification
    // in addition to the inline form message - the inline message is what we assert here.
    await expect(
      page.getByText('Invalid email or password. Please try again.').first()
    ).toBeVisible();
  });

  test('Continue button stays disabled while either field is empty', async ({ page }) => {
    await page.goto(`${BASE_URL}/en/auth`);

    const emailField = page.getByRole('textbox', { name: 'Email' });
    const passwordField = page.getByRole('textbox', { name: 'Password' });
    const continueButton = page.getByRole('button', { name: 'Continue', exact: true });

    await expect(continueButton).toBeDisabled();

    await emailField.fill('someone@example.com');
    await expect(continueButton).toBeDisabled(); // password still empty

    await emailField.clear();
    await passwordField.fill('SomePassword1!');
    await expect(continueButton).toBeDisabled(); // email still empty

    // Touch-then-clear-then-blur only produces a red/invalid outline; there is NO inline
    // "required" text message anywhere in the real UI (documented gap) - assert the
    // disabled-button behavior only, not any text.
    await passwordField.clear();
    await emailField.click();
    await emailField.fill('a');
    await emailField.clear();
    await passwordField.click(); // blur email
    await expect(continueButton).toBeDisabled();
  });

  test('Forgot password opens the in-place OTP reset panel and Back to login returns to the login form', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/en/auth`);

    await page.getByRole('button', { name: 'Forgot password?' }).click();

    // URL does not change; the login form is replaced in place by the reset panel.
    await expect(page).toHaveURL(`${BASE_URL}/en/auth`);
    await expect(page.getByRole('heading', { name: 'Reset password' })).toBeVisible();
    await expect(page.getByText('Enter your email to receive an OTP.')).toBeVisible();

    const sendOtpButton = page.getByRole('button', { name: 'Send OTP' });
    await expect(sendOtpButton).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Back to login' })).toBeVisible();

    // Enabling the button is verified but a real OTP send is never triggered.
    await page.getByRole('textbox', { name: 'Email *' }).fill(process.env.TEST_USER_EMAIL!);
    await expect(sendOtpButton).toBeEnabled();

    await page.getByRole('button', { name: 'Back to login' }).click();

    await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Password' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeVisible();
  });

  test('logout requires confirming a Confirm Logout dialog', async ({ page }) => {
    await page.goto(`${BASE_URL}/en/auth`);
    await page.getByRole('textbox', { name: 'Email' }).fill(process.env.TEST_USER_EMAIL!);
    await page.getByRole('textbox', { name: 'Password' }).fill(process.env.TEST_USER_PASSWORD!);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.waitForURL(`${BASE_URL}/en`);

    // Right after the redirect, the header briefly renders the account button with no text/icon
    // while the user's profile loads asynchronously - clicking it during that window is a no-op
    // (no dropdown opens), which then hangs the next locator waiting for a menuitem that never
    // appears. Wait for the initials text to render before clicking.
    const accountButton = page.getByRole('banner').getByRole('button').last();
    // Bumped from 10s: observed to occasionally exceed 10s under slower staging load during
    // Step 5 healing (see Report.md) - the account button/profile fetch itself isn't flaky,
    // just sometimes slower than 10s end-to-end.
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
    // Bumped from 10s: observed to occasionally exceed 10s under slower staging load during
    // Step 5 healing (see Report.md) - the account button/profile fetch itself isn't flaky,
    // just sometimes slower than 10s end-to-end.
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
