import { test, expect } from '@playwright/test';
import { BASE_URL } from '../helpers/auth';

const LANG_TOGGLE_TIMEOUT = 15000;

test.describe('Language toggle', () => {
  test('Language toggle is present and functional on the login page', async ({ page }) => {
    await page.goto(`${BASE_URL}/en/auth`);
    await expect(page.getByRole('button', { name: 'EN', exact: true })).toBeVisible({ timeout: LANG_TOGGLE_TIMEOUT });

    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Select Language' })).toBeVisible();
    await page.getByRole('button', { name: 'Khmer ខ្មែរ' }).click();

    await expect(page).toHaveURL(`${BASE_URL}/km/auth`);
    await expect(page.getByText('ចូលប្រើគណនីរបស់អ្នក')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'អ៊ីមែល' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'ពាក្យសម្ងាត់' })).toBeVisible();

    // reopening the panel should show Khmer as the already-checked radio option
    await page.getByRole('button', { name: 'KH', exact: true }).click({ timeout: LANG_TOGGLE_TIMEOUT });
    await expect(page.getByRole('button', { name: 'Khmer ខ្មែរ' }).getByRole('radio')).toBeChecked();
  });
});
