import { test, expect } from '@playwright/test';
import { BASE_URL } from '../helpers/auth';

// ROOT CAUSE of the original "EN"/"FR"/"KH" button timeouts (see specs/exploratory-findings.md):
// playwright.config.ts's per-project `use: { ...devices['Desktop Chrome'] }` (etc.) silently
// overrode the intended global 2000x1200 viewport with the device descriptor's own bundled
// 1280x720 viewport, because Playwright merges project-level `use` on top of top-level `use`.
// At 1280px, the header language-toggle's text label span (class `min-[1292px]:block hidden`)
// is deterministically CSS-hidden (1280 < 1292), so the button has NO accessible name at all -
// not a hydration-timing race. That has now been fixed at the source in playwright.config.ts
// (each project re-asserts viewport: 2000x1200 after the device spread). A small explicit
// timeout is kept below purely as defense-in-depth for ordinary network variance on this
// staging backend, matching the 15000ms pattern already used elsewhere in this suite.
const LANG_TOGGLE_TIMEOUT = 15000;

test.describe('Language toggle', () => {
  test('Language toggle switches the site to English', async ({ page }) => {
    await page.goto(`${BASE_URL}/km`);
    await page.getByRole('button', { name: 'KH', exact: true }).click({ timeout: LANG_TOGGLE_TIMEOUT });
    await expect(page.getByRole('button', { name: 'English English' })).toBeVisible();

    await page.getByRole('button', { name: 'English English' }).click();
    await expect(page).toHaveURL(`${BASE_URL}/en`);
    await expect(page.getByRole('link', { name: 'Stay Stay' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Offers Offers' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Activity Activity' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Where do you want to go next?' })).toBeVisible();
  });
});
