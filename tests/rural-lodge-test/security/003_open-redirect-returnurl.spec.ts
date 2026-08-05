import { test, expect } from '@playwright/test';
import { BASE_URL } from '../helpers/auth';

/**
 * The auth page accepts a `returnUrl` query param (used legitimately for e.g. "Manage Your Lodge"
 * -> /en/auth?returnUrl=%2F, see specs/exploratory-findings.md 1.9). Confirmed on staging
 * (2026-08-05) that passing an absolute, off-site URL does NOT cause an open redirect - the app
 * stays on /auth rather than forwarding to the attacker-controlled host. This locks in that safe
 * behavior as a regression test.
 */
test.describe('Security - Open redirect', () => {
  test('returnUrl pointing at an external host does not redirect off-site', async ({ page }) => {
    await page.goto(`${BASE_URL}/en/auth?returnUrl=https://evil.example.com`, { waitUntil: 'load' });

    expect(page.url()).toContain(BASE_URL);
    expect(page.url()).not.toContain('evil.example.com');
    await expect(page.getByText('Login to your account')).toBeVisible();
  });
});
