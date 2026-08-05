import { test, expect } from '@playwright/test';
import { BASE_URL } from '../helpers/auth';

const LANG_TOGGLE_TIMEOUT = 15000;

test.describe('Language toggle', () => {
  test('Language toggle switches the site to French', async ({ page }) => {
    await page.goto(`${BASE_URL}/en`);
    await page.getByRole('button', { name: 'EN', exact: true }).click({ timeout: LANG_TOGGLE_TIMEOUT });
    await page.getByRole('button', { name: 'French Français' }).click();

    await expect(page).toHaveURL(`${BASE_URL}/fr`);
    await expect(page.getByRole('link', { name: 'Séjour Séjour' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Offres Offres' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Activité Activité' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Où voulez-vous aller ensuite ?' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Gérer votre Lodge' })).toBeVisible();
  });
});
