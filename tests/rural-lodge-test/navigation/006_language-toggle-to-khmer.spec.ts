import { test, expect } from '@playwright/test';
import { BASE_URL } from '../helpers/auth';

const LANG_TOGGLE_TIMEOUT = 15000;

test.describe('Language toggle', () => {
  test('Language toggle switches the site to Khmer', async ({ page }) => {
    await page.goto(`${BASE_URL}/fr`);
    await page.getByRole('button', { name: 'FR', exact: true }).click({ timeout: LANG_TOGGLE_TIMEOUT });
    await page.getByRole('button', { name: 'Khmer ខ្មែរ' }).click();

    await expect(page).toHaveURL(`${BASE_URL}/km`);
    await expect(page.getByRole('link', { name: 'ស្នាក់នៅ ស្នាក់នៅ' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'សេវាកម្ម សេវាកម្ម' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'សកម្មភាព សកម្មភាព' })).toBeVisible();
  });
});
