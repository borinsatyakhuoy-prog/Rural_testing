import { test, expect } from '@playwright/test';
import { BASE_URL } from '../helpers/auth';

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
});
