import { test, expect } from '@playwright/test';
import { BASE_URL } from '../helpers/auth';

/**
 * Closes the coverage gap noted in specs/exploratory-findings.md 1.9 (planner scenario 1.9):
 * unlike the customer dashboard route (see DEFECT-1), "Manage Your Lodge" correctly redirects an
 * unauthenticated user to login rather than rendering anything. Locks in this already-correct
 * auth-gating behavior as a regression test, and gives DEFECT-1 an explicit contrast case.
 */
test.describe('Authentication', () => {
  test('Manage Your Lodge redirects an unauthenticated user to login with a returnUrl', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto(`${BASE_URL}/en`, { waitUntil: 'load' });

    await page.getByRole('button', { name: 'Manage Your Lodge' }).click();

    await expect(page).toHaveURL(`${BASE_URL}/en/auth?returnUrl=%2F`, { timeout: 10_000 });
    await expect(page.getByText('Login to your account')).toBeVisible();
  });
});
