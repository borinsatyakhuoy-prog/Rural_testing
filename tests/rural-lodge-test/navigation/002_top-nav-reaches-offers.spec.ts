import { test, expect } from '@playwright/test';
import { BASE_URL } from '../helpers/auth';

test.describe('Top navigation bar', () => {
  test('Top nav reaches the Offers section', async ({ page }) => {
    await page.goto(`${BASE_URL}/en`);

    await page.getByRole('link', { name: 'Offers Offers' }).click();
    await expect(page).toHaveURL(`${BASE_URL}/en/offers`);
    await expect(page).toHaveTitle('Offers');
  });
});
