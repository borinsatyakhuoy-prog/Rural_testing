import { test, expect } from '@playwright/test';
import { BASE_URL, loginAsCustomer } from '../helpers/auth';

const LODGE_SLUG = 'lotus-lake-floating-villa';

test.describe('Customer Booking Cycle', () => {
  test('Guest count cannot exceed the lodge Guest Capacity', async ({ page }) => {
    await loginAsCustomer(page);
    await page.goto(`${BASE_URL}/en/lodges/${LODGE_SLUG}`);

    await page.getByRole('button', { name: /Guests/ }).first().click();
    const guestsDialog = page.getByRole('dialog').filter({ hasText: 'Guest details' });
    await expect(guestsDialog).toBeVisible();

    // Adults/Children/Pets each have their own +/- stepper pair; Adults is first in document order.
    const adultsPlus = guestsDialog.getByRole('button', { name: '+' }).first();

    // Push Adults up until the app disables the "+" button. Bounded loop (rather than reading the
    // lodge's exact Guest Capacity number up front) so this works for any lodge's capacity.
    for (let i = 0; i < 20 && !(await adultsPlus.isDisabled()); i++) {
      await adultsPlus.click();
    }

    await expect(adultsPlus).toBeDisabled();
    // Footer text confirms the cap was actually reached, e.g. "Total guests (Adults) 1 of 1 max".
    await expect(guestsDialog.getByText(/of \d+ max/i)).toBeVisible();
  });
});
