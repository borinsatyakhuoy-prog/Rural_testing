import { test, expect } from '@playwright/test';
import { BASE_URL } from '../helpers/auth';

const LANG_TOGGLE_TIMEOUT = 15000;

test.describe('Header consistency', () => {
  test('Language toggle is present in the header on the login page (logged out)', async ({ page }) => {
    await page.goto(`${BASE_URL}/en/auth`);
    await expect(page.getByRole('button', { name: 'EN', exact: true })).toBeVisible({ timeout: LANG_TOGGLE_TIMEOUT });
  });
});
