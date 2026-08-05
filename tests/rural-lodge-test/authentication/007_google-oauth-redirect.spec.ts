import { test, expect } from '@playwright/test';
import { BASE_URL } from '../helpers/auth';

/**
 * "Continue with Google" cannot be fully automated end-to-end: it hands off to Google's own
 * accounts.google.com sign-in page, which has anti-bot protections (CAPTCHA, device verification)
 * that make a real, unattended login unreliable even with real test credentials - and this suite
 * doesn't have a dedicated Google test account. Per the user's explicit scoping decision, this
 * test verifies only the boundary this app actually controls: clicking the button kicks off a
 * real OAuth redirect to the correct provider, with the expected client_id/redirect_uri wired up.
 * It deliberately stops there - it never attempts to fill in Google's own login form.
 */
test.describe('Authentication - OAuth', () => {
  test('Continue with Google redirects to a real Google OAuth sign-in page', async ({ page }) => {
    await page.goto(`${BASE_URL}/en/auth`);

    await page.getByRole('button', { name: 'Continue with Google' }).click();
    await page.waitForURL(/accounts\.google\.com/, { timeout: 15000 });

    expect(page.url()).toContain('accounts.google.com');
    // Confirms this app's own OAuth wiring (client_id + redirect_uri pointing back at this app's
    // auth broker), not just "some Google page loaded".
    expect(page.url()).toContain('client_id=');
    expect(page.url()).toContain('redirect_uri=');
    await expect(page).toHaveTitle(/Sign in.*Google/i);
  });
});
