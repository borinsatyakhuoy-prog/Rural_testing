import { test, expect } from '@playwright/test';
import { BASE_URL } from '../helpers/auth';

/**
 * Error Handling / No-Silent-Failure cross-cutting checks.
 *
 * These tests overlap by nature with authentication/002_invalid-credentials-shows-error.spec.ts
 * but are framed from the "is the failure visible and specific?" angle per
 * specs/planner/03-error-handling.md. They intentionally do NOT re-cover the full login/logout
 * happy path, which is owned by the authentication/ domain.
 */
test.describe('Error Handling - no silent failure', () => {
  test('invalid login produces a specific, visible error message rather than a silent failure', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/en/auth`);

    const emailField = page.getByRole('textbox', { name: 'Email' });
    const passwordField = page.getByRole('textbox', { name: 'Password' });

    await emailField.fill('wrong.user@example.com');
    await passwordField.fill('WrongPassword123!');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();

    // .first() because the same text can also transiently appear in a toast notification in
    // addition to the inline form message (matches the pattern already documented in
    // authentication/002) - without it this is a strict-mode violation.
    await expect(
      page.getByText('Invalid email or password. Please try again.').first()
    ).toBeVisible();

    // Page must not go blank, throw an unhandled error overlay, or silently do nothing:
    // the form stays intact and usable so the user can correct and resubmit.
    await expect(emailField).toBeVisible();
    await expect(passwordField).toBeVisible();
    await expect(emailField).toBeEditable();
    await expect(passwordField).toBeEditable();
  });
});
