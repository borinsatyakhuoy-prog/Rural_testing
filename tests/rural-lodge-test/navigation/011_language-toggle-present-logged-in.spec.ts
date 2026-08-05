import { test, expect } from '@playwright/test';
import { BASE_URL, login } from '../helpers/auth';

const LANG_TOGGLE_TIMEOUT = 15000;

test.describe('Header consistency', () => {
  test('Language toggle remains present in the header once logged in', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(`${BASE_URL}/en`);
    await expect(page.getByRole('banner').getByRole('button', { name: 'EN', exact: true })).toBeVisible({ timeout: LANG_TOGGLE_TIMEOUT });
  });
});
