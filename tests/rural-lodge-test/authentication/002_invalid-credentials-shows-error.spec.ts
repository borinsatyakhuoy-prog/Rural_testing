import { test, expect } from '@playwright/test';
import { BASE_URL } from '../helpers/auth';

test.describe('Authentication', () => {
  test('invalid credentials show a specific error message and stay on /auth', async ({ page }) => {
    await page.goto(`${BASE_URL}/en/auth`);

    const emailField = page.getByRole('textbox', { name: 'Email' });
    const passwordField = page.getByRole('textbox', { name: 'Password' });

    // pressSequentially, not fill: see the Cycle 4 note in 001_valid-login-redirects-home.spec.ts
    // - WebKit's React controlled-input state doesn't pick up .fill()'s programmatic value set.
    await emailField.pressSequentially('wrong.user@example.com');
    await passwordField.pressSequentially('WrongPassword123!');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();

    await expect(page).toHaveURL(/\/en\/auth/);
    // .first() because the same text can also transiently appear in a toast notification
    // in addition to the inline form message - the inline message is what we assert here.
    await expect(
      page.getByText('Invalid email or password. Please try again.').first()
    ).toBeVisible();
  });
});
