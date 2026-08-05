import { test, expect } from '@playwright/test';
import { loginAsOwner } from '../helpers/auth';

test.describe('Lodge Owner - other modules', () => {
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
