import { test, expect } from '@playwright/test';
import { BASE_URL } from '../helpers/auth';

test.describe('Top navigation bar', () => {
  test('Top nav reaches the Stay (home/search) section', async ({ page }) => {
    await page.goto(`${BASE_URL}/en`);

    await expect(page.getByRole('link', { name: 'Stay Stay' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Offers Offers' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Activity Activity' })).toBeVisible();

    // navigate away first so clicking "Stay" proves it returns to the home listing view
    await page.getByRole('link', { name: 'Activity Activity' }).click();
    await expect(page).toHaveURL(`${BASE_URL}/en/activity`);
    // Observed during Step 5 healing (rare, one-off): clicking "Stay" immediately after this nav
    // can race the client router's hydration on the new page, falling back to a hard navigation
    // to the raw "/" href - which then hits the server's default-locale redirect to "/km" instead
    // of preserving "/en". Wait for the page to finish loading before the next click.
    await page.waitForLoadState('load');

    // "Stay" links raw href is "/", but client-side navigation preserves the "/en" locale segment
    await page.getByRole('link', { name: 'Stay Stay' }).click();
    await expect(page).toHaveURL(`${BASE_URL}/en`);
    await expect(page.getByRole('heading', { name: 'Where do you want to go next?' })).toBeVisible();
  });
});
