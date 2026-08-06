import { test, expect } from '@playwright/test';
import { BASE_URL } from '../helpers/auth';

test.describe('Error Handling - no silent failure', () => {
  test('no-data state: authenticated account with zero bookings shows explicit empty-state messaging, not a blank area', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/en/auth`);

    // pressSequentially, not fill: see the Cycle 4 note in
    // authentication/001_valid-login-redirects-home.spec.ts.
    await page.getByRole('textbox', { name: 'Email' }).pressSequentially(process.env.CUSTOMER_TEST_EMAIL!);
    await page.getByRole('textbox', { name: 'Password' }).pressSequentially(process.env.CUSTOMER_TEST_PASSWORD!);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();

    await page.waitForURL(`${BASE_URL}/en`);

    await page.goto(`${BASE_URL}/en/customer/dashboard`);

    // Corrected from the original assumption: "No stats available" is only ever rendered for the
    // BROKEN/unauthenticated shell (see the DEFECT test in 002) - a genuinely authenticated,
    // zero-booking account instead gets real stat tiles showing "0" (confirmed live: "Total
    // Bookings" / "Recent Bookings" / "Notification" tiles each read "0"). Assert that real,
    // populated-but-zero state here rather than text that never appears for a logged-in user.
    await expect(page.getByText('Total Bookings').locator('..')).toContainText('0');
    await expect(page.getByText('No bookings found')).toBeVisible();
    await expect(
      page.getByText('Please click the link below to explore lodge.')
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Explore Lodge' })).toBeVisible();
  });
});
