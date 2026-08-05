import { test, expect } from '@playwright/test';
import { BASE_URL } from '../helpers/auth';

/**
 * "Continue with Apple" cannot be fully automated end-to-end for the same reason as
 * "Continue with Google" (see 007_google-oauth-redirect.spec.ts): it hands off to Apple's own
 * appleid.apple.com sign-in page, which this suite has no dedicated test account for and which
 * has its own anti-bot protections. Per the user's explicit scoping decision, this test verifies
 * only the boundary this app actually controls: clicking the button kicks off a real OAuth
 * redirect to the correct provider, with the expected client_id/redirect_uri wired up. It
 * deliberately stops there - it never attempts to fill in Apple's own login form.
 */
test.describe('Authentication - OAuth', () => {
  test('Continue with Apple redirects to a real Apple ID sign-in page', async ({ page }) => {
    await page.goto(`${BASE_URL}/en/auth`);

    await page.getByRole('button', { name: 'Continue with Apple' }).click();
    await page.waitForURL(/appleid\.apple\.com/, { timeout: 15000 });

    expect(page.url()).toContain('appleid.apple.com');
    // Confirms this app's own OAuth wiring (client_id + redirect_uri pointing back at this app),
    // not just "some Apple page loaded".
    expect(page.url()).toContain('client_id=');
    expect(page.url()).toContain('redirect_uri=');
    await expect(page).toHaveTitle(/Sign in.*Apple/i);
  });
});
