import { test, expect } from '@playwright/test';
import { BASE_URL } from '../helpers/auth';
import { attachMetrics, ratedLine, assertSLA, SLA } from '../helpers/performance';

/** Real click-to-visible timing for the top nav (Offers/Activity) and the language toggle. */
test.describe('Performance - Navigation', () => {
  test('top nav and language toggle respond within a generous budget', async ({ page }, testInfo) => {
    await page.goto(`${BASE_URL}/en`, { waitUntil: 'load' });

    const offersStart = Date.now();
    await page.getByRole('link', { name: 'Offers Offers' }).click();
    await expect(page).toHaveURL(`${BASE_URL}/en/offers`, { timeout: 10_000 });
    const offersMs = Date.now() - offersStart;

    await page.goto(`${BASE_URL}/en`, { waitUntil: 'load' });
    const activityStart = Date.now();
    await page.getByRole('link', { name: 'Activity Activity' }).click();
    await expect(page).toHaveURL(`${BASE_URL}/en/activity`, { timeout: 10_000 });
    const activityMs = Date.now() - activityStart;

    const langStart = Date.now();
    await page.getByRole('button', { name: 'EN', exact: true }).click({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Select Language' })).toBeVisible({ timeout: 10_000 });
    const langOpenMs = Date.now() - langStart;

    const summary = [
      ratedLine('Stay -> Offers nav click-to-visible', offersMs, 2000, 5000),
      assertSLA('SLA T2 - Offers nav', offersMs, SLA.NAVIGATION),
      ratedLine('Stay -> Activity nav click-to-visible', activityMs, 2000, 5000),
      assertSLA('SLA T2 - Activity nav', activityMs, SLA.NAVIGATION),
      ratedLine('Language toggle open', langOpenMs, 1000, 3000),
      assertSLA('SLA T5 - Language toggle open', langOpenMs, SLA.DIALOG_OPEN),
    ];
    console.log(`\n[PERF] Navigation:\n  ${summary.join('\n  ')}`);
    await attachMetrics(testInfo, 'navigation-performance-metrics', summary);
  });
});
