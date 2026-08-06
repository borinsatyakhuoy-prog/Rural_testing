import { test, expect } from '@playwright/test';
import { BASE_URL } from '../helpers/auth';

/**
 * Closes the coverage gap noted in specs/exploratory-findings.md 1.5: the login form's Password
 * field has an icon-only show/hide toggle with no accessible name, so it's targeted by CSS
 * position (the single button inside the form with no text) rather than a role/name locator.
 */
test.describe('Authentication', () => {
  test('Password field visibility toggle switches between masked and plain text', async ({ page }) => {
    await page.goto(`${BASE_URL}/en/auth`);

    const passwordField = page.getByRole('textbox', { name: 'Password' });
    // pressSequentially, not fill: under WebKit, .fill()'s value never reaches this React
    // controlled input's own state, so a later re-render (triggered by the type-toggle click
    // below) snaps the DOM value back to the stale empty string (confirmed via a full WebKit
    // run, Cycle 4). Real keystrokes fix it everywhere.
    await passwordField.pressSequentially('Test1234!');
    await expect(passwordField).toHaveAttribute('type', 'password');

    const toggleButton = page.locator('form').getByRole('button').filter({ hasText: /^$/ });
    await toggleButton.click();
    await expect(passwordField).toHaveAttribute('type', 'text');
    await expect(passwordField).toHaveValue('Test1234!');

    await toggleButton.click();
    await expect(passwordField).toHaveAttribute('type', 'password');
  });
});
