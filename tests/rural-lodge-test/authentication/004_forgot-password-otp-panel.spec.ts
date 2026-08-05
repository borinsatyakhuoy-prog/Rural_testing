import { test, expect } from '@playwright/test';
import { BASE_URL } from '../helpers/auth';

test.describe('Authentication', () => {
  test('Forgot password opens the in-place OTP reset panel and Back to login returns to the login form', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/en/auth`);

    await page.getByRole('button', { name: 'Forgot password?' }).click();

    // URL does not change; the login form is replaced in place by the reset panel.
    await expect(page).toHaveURL(`${BASE_URL}/en/auth`);
    await expect(page.getByRole('heading', { name: 'Reset password' })).toBeVisible();
    await expect(page.getByText('Enter your email to receive an OTP.')).toBeVisible();

    const sendOtpButton = page.getByRole('button', { name: 'Send OTP' });
    await expect(sendOtpButton).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Back to login' })).toBeVisible();

    // Enabling the button is verified but a real OTP send is never triggered.
    await page.getByRole('textbox', { name: 'Email *' }).fill(process.env.TEST_USER_EMAIL!);
    await expect(sendOtpButton).toBeEnabled();

    await page.getByRole('button', { name: 'Back to login' }).click();

    await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Password' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeVisible();
  });
});
