import { test, expect } from '@playwright/test';
import { BASE_URL } from '../helpers/auth';

test.describe('Authentication', () => {
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
});
