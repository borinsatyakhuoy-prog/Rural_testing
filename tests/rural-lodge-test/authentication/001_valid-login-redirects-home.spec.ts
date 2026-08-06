import { test, expect } from '@playwright/test';
import { BASE_URL } from '../helpers/auth';

test.describe('Authentication', () => {
  test('valid login redirects to the public home page (not Dashboard)', async ({ page }) => {
    await page.goto(`${BASE_URL}/en/auth`);

    const emailField = page.getByRole('textbox', { name: 'Email' });
    const passwordField = page.getByRole('textbox', { name: 'Password' });
    const continueButton = page.getByRole('button', { name: 'Continue', exact: true });

    await expect(continueButton).toBeDisabled();

    // pressSequentially, not fill: under WebKit specifically, .fill() sets the raw DOM value but
    // this app's React controlled-input state never picks it up, so Continue stays disabled
    // forever (confirmed via a full WebKit run, Cycle 4). Real keystroke events fix it everywhere.
    await emailField.pressSequentially(process.env.TEST_USER_EMAIL!);
    await passwordField.pressSequentially(process.env.TEST_USER_PASSWORD!);
    await expect(continueButton).toBeEnabled();
    await continueButton.click();

    // Real behavior redirects to the public home page, not "/{locale}/customer/dashboard".
    await expect(page).toHaveURL(`${BASE_URL}/en`);
    await expect(page).toHaveTitle('Welcome to Rural Lodge');

    // Header's login icon is replaced by a user-initials button once authenticated.
    await expect(page.getByRole('banner').getByRole('button').last()).toBeVisible();
  });
});
