import { test, expect } from '@playwright/test';
import { BASE_URL } from '../helpers/auth';

test.describe('Top navigation bar', () => {
  test('Top nav reaches the Activity section', async ({ page }) => {
    await page.goto(`${BASE_URL}/en`);

    await page.getByRole('link', { name: 'Activity Activity' }).click();
    await expect(page).toHaveURL(`${BASE_URL}/en/activity`);
    await expect(page).toHaveTitle('Activities');
  });
});
