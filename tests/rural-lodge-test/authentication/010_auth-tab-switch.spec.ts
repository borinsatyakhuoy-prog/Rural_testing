import { test, expect } from '@playwright/test';
import { BASE_URL } from '../helpers/auth';

/**
 * Closes the coverage gap noted in specs/exploratory-findings.md 1.6: switching to the Sign Up
 * tab reveals the full registration form, and switching back restores the original Sign In form
 * untouched. A real registration submission is out of scope (see the Sign-Up form note in
 * specs/planner/01-authentication.md) - this only covers the tab-switch UI itself.
 */
test.describe('Authentication', () => {
  test('Sign In / Sign Up tabs switch between the login form and the registration form', async ({ page }) => {
    await page.goto(`${BASE_URL}/en/auth`);

    await expect(page.getByRole('tab', { name: 'Sign In' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Password' })).toBeVisible();

    await page.getByRole('tab', { name: 'Sign Up' }).click();

    await expect(page.getByRole('textbox', { name: 'First name', exact: false })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Last name', exact: false })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Confirm password', exact: false })).toBeVisible();

    await page.getByRole('tab', { name: 'Sign In' }).click();

    await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Password' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'First name', exact: false })).not.toBeVisible();
  });
});
