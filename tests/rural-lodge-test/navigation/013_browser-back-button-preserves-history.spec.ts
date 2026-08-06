import { test, expect } from '@playwright/test';
import { BASE_URL } from '../helpers/auth';

/**
 * Closes a real gap versus user-stories/SCRUM.md's Technical Notes ("Test navigation flow and
 * back button behavior") - no existing spec exercised the browser's own Back button, only
 * in-app link clicks. Confirmed live via Playwright MCP before automating: clicking Stay ->
 * Offers -> Activity then pressing Back twice correctly unwinds through /en/offers to /en,
 * exactly mirroring the forward-navigation history (not a defect - documented here as a
 * regression lock-in for real browser history behavior, which client-side routers can get wrong).
 */
test.describe('Navigation - browser Back button', () => {
  test('Back button unwinds Stay -> Offers -> Activity history correctly, preserving the locale segment', async ({ page }) => {
    await page.goto(`${BASE_URL}/en`);
    await expect(page).toHaveURL(/\/en$/);

    await page.getByRole('link', { name: 'Offers Offers' }).click();
    await expect(page).toHaveURL(/\/en\/offers$/);

    await page.getByRole('link', { name: 'Activity Activity' }).click();
    await expect(page).toHaveURL(/\/en\/activity$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/en\/offers$/);
    await expect(page.getByRole('heading', { name: 'Coming Soon' })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.getByRole('heading', { name: 'Where do you want to go next?' })).toBeVisible();

    // Forward should redo the same history, confirming Back didn't just re-fetch a fresh page.
    await page.goForward();
    await expect(page).toHaveURL(/\/en\/offers$/);
  });
});
