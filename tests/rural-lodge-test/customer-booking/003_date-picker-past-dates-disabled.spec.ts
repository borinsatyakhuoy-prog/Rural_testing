import { test, expect } from '@playwright/test';
import { BASE_URL, loginAsCustomer } from '../helpers/auth';

const LODGE_SLUG = 'lotus-lake-floating-villa';

test.describe('Customer Booking Cycle', () => {
  test('Date picker: past dates are disabled and cannot be selected', async ({ page }) => {
    await loginAsCustomer(page);
    await page.goto(`${BASE_URL}/en/lodges/${LODGE_SLUG}`);

    await page.getByRole('button', { name: 'Check-in — Check-out Select' }).click();
    const dateDialog = page.getByRole('dialog').filter({ hasText: 'Select your dates' });
    await expect(dateDialog).toBeVisible();

    // The calendar opens on the current month, so any day before "today" (e.g. the 1st-3rd of the
    // month if today is the 4th) is already in view without needing to navigate back a month.
    const pastDayButtons = dateDialog.getByRole('button', { name: /Not available, Price not available/ });
    expect(await pastDayButtons.count()).toBeGreaterThan(0);
    await expect(pastDayButtons.first()).toBeVisible();
    await expect(pastDayButtons.first()).toBeDisabled();
  });
});
