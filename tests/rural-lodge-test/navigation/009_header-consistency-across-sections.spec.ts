import { test, expect, type Page } from '@playwright/test';
import { BASE_URL } from '../helpers/auth';

const LANG_TOGGLE_TIMEOUT = 15000;

async function expectHeaderConsistent(page: Page) {
  const banner = page.getByRole('banner');
  await expect(banner.getByRole('link').first()).toBeVisible(); // logo
  await expect(page.getByRole('link', { name: 'Stay Stay' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Offers Offers' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Activity Activity' })).toBeVisible();
  await expect(banner.getByRole('button', { name: 'Manage Your Lodge' })).toBeVisible();
  await expect(banner.getByRole('button', { name: 'EN', exact: true })).toBeVisible({ timeout: LANG_TOGGLE_TIMEOUT });
  await expect(banner.getByRole('button', { name: '$ USD' })).toBeVisible();
  await expect(banner.getByRole('button').last()).toBeVisible(); // account/login icon
}

test.describe('Header consistency', () => {
  test('Header utility icons render consistently across every top-nav section', async ({ page }) => {
    for (const path of ['/en', '/en/offers', '/en/activity']) {
      await page.goto(`${BASE_URL}${path}`);
      await expectHeaderConsistent(page);
    }
  });
});
